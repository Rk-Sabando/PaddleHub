import {
  CourtStatus,
  EventStatus,
  MatchFormat,
  MatchStatus,
  Prisma,
  SignupStatus,
} from "@prisma/client";
import { db } from "@/lib/db";
import { channels, events as pusherEvents } from "@/lib/pusher";
import { pusherServer } from "@/lib/pusher-server";
import type { CreateEventInput } from "@/lib/validators/event";

// Wraps pusher triggers so a delivery failure can't bubble back into the
// route handler — the DB write has already succeeded.
async function broadcast(
  channel: string,
  eventName: string,
  payload: Record<string, unknown>,
): Promise<void> {
  try {
    await pusherServer.trigger(channel, eventName, payload);
  } catch (err) {
    console.error(`[realtime] failed to trigger ${eventName} on ${channel}`, err);
  }
}

const adminEventInclude = {
  host: true,
  _count: {
    select: {
      matches: true,
      signups: { where: { status: SignupStatus.CONFIRMED } },
    },
  },
} satisfies Prisma.EventInclude;

const playerBrowseInclude = (userId: string) =>
  ({
    host: true,
    _count: {
      select: {
        matches: true,
        signups: { where: { status: SignupStatus.CONFIRMED } },
      },
    },
    signups: { where: { userId }, select: { id: true, status: true } },
  }) satisfies Prisma.EventInclude;

export class EventCapacityError extends Error {
  status = 409;
}
export class EventClosedError extends Error {
  status = 409;
}
export class AlreadySignedUpError extends Error {
  status = 409;
}
export class InvalidStatusTransitionError extends Error {
  status = 409;
}
export class SignupNotFoundError extends Error {
  status = 404;
}
export class MatchmakingAlreadyRunError extends Error {
  status = 409;
}
export class NotEnoughPlayersError extends Error {
  status = 409;
}
export class NoAvailableCourtsError extends Error {
  status = 409;
}
export class EventTerminalError extends Error {
  status = 409;
}

// Forward transitions only; admin can also CANCEL from anywhere except COMPLETED.
const allowedTransitions: Record<EventStatus, EventStatus[]> = {
  OPEN: [EventStatus.IN_PROGRESS, EventStatus.CANCELLED],
  IN_PROGRESS: [EventStatus.COMPLETED, EventStatus.CANCELLED],
  COMPLETED: [],
  CANCELLED: [],
};

// Signups are accepted whenever the event hasn't ended yet.
const ACCEPTING_SIGNUPS: EventStatus[] = [EventStatus.OPEN, EventStatus.IN_PROGRESS];

// Cap how many pre-formed matches sit in the queue at any time. Confirmed
// players beyond what fills the courts + this many queued matches stay in the
// "waiting to be paired" pool until a slot opens up.
export const MAX_QUEUED_MATCHES = 5;

// Forms one OPEN queued match (no court yet) from the signup pool if there
// are enough confirmed players not currently in another active/queued match.
// Called from inside a transaction.
async function formOneQueuedMatch(
  tx: Prisma.TransactionClient,
  eventId: string,
  format: MatchFormat,
): Promise<boolean> {
  const perMatch = format === MatchFormat.DOUBLES ? 4 : 2;
  const inMatch = await tx.matchParticipant.findMany({
    where: {
      match: {
        eventId,
        status: { in: [MatchStatus.CONFIRMED, MatchStatus.OPEN] },
      },
    },
    select: { userId: true },
  });
  const taken = new Set(inMatch.map((p) => p.userId));
  const pool = await tx.eventSignup.findMany({
    where: {
      eventId,
      status: SignupStatus.CONFIRMED,
      userId: { notIn: Array.from(taken) },
    },
    include: { user: true },
  });
  if (pool.length < perMatch) return false;

  // Count COMPLETED matches per pool player. Players who've played less get
  // priority — fixes the starvation case where high-skill "leftovers" from
  // the initial chunking never enter a match because every refill cycle keeps
  // grabbing the lowest-skill players who just finished.
  const completed = await tx.matchParticipant.findMany({
    where: {
      match: { eventId, status: MatchStatus.COMPLETED },
      userId: { in: pool.map((p) => p.userId) },
    },
    select: { userId: true },
  });
  const playCount = new Map<string, number>();
  for (const p of completed) {
    playCount.set(p.userId, (playCount.get(p.userId) ?? 0) + 1);
  }

  // Improved: Always guarantee the highest-skill, never-played player is included in the next group if possible.
  // 1. Bucket by playCount (fewest played first).
  // 2. For the lowest playCount bucket, always include both the lowest and highest skill players in the group if possible.
  // 3. Fill remaining slots with alternation as before, then move to next bucket if needed.
  const buckets = new Map<number, typeof pool>();
  for (const p of pool) {
    const c = playCount.get(p.userId) ?? 0;
    const bucket = buckets.get(c);
    if (bucket) bucket.push(p);
    else buckets.set(c, [p]);
  }
  for (const b of buckets.values()) {
    b.sort((a, b2) => a.user.skillRating - b2.user.skillRating);
  }

  const group: typeof pool = [];
  const sortedCounts = [...buckets.keys()].sort((a, b) => a - b);
  for (const c of sortedCounts) {
    const bucket = buckets.get(c)!;
    let lo = 0;
    let hi = bucket.length - 1;
    // Always include lowest and highest skill in the lowest playCount bucket if possible
    if (group.length < perMatch && bucket.length > 0 && group.length === 0) {
      if (lo === hi) {
        group.push(bucket[lo]!); // only one player left
        lo++;
        hi--;
      } else if (lo < hi) {
        group.push(bucket[lo]!); // lowest skill
        group.push(bucket[hi]!); // highest skill
        lo++;
        hi--;
      }
    }
    // Fill remaining slots with alternation
    let pickLow = true;
    while (group.length < perMatch && lo <= hi) {
      group.push(pickLow ? bucket[lo++]! : bucket[hi--]!);
      pickLow = !pickLow;
    }
    // Do NOT break here; continue to next bucket if group still not filled
    if (group.length >= perMatch) break;
  }
  const ratings = group.map((g) => g.user.skillRating);
  await tx.match.create({
    data: {
      eventId,
      hostId: group[0]!.userId,
      courtId: null,
      scheduledAt: new Date(),
      startedAt: null,
      format,
      capacity: perMatch,
      skillMin: Math.min(...ratings),
      skillMax: Math.max(...ratings),
      status: MatchStatus.OPEN,
      notes: "Queued — waiting for a court.",
      participants: { create: group.map((g) => ({ userId: g.userId })) },
    },
  });
  return true;
}

// Keep the queue topped up to MAX_QUEUED_MATCHES whenever a queued match is
// consumed (promoted to a court) or a new player is confirmed. Returns how
// many fresh queued matches were added.
async function topUpQueue(
  tx: Prisma.TransactionClient,
  eventId: string,
  format: MatchFormat,
): Promise<number> {
  let added = 0;
  while (true) {
    const queued = await tx.match.count({
      where: { eventId, status: MatchStatus.OPEN, courtId: null },
    });
    if (queued >= MAX_QUEUED_MATCHES) return added;
    const formed = await formOneQueuedMatch(tx, eventId, format);
    if (!formed) return added;
    added += 1;
  }
}

export const eventService = {
  async listForAdmin() {
    return db.event.findMany({
      include: adminEventInclude,
      orderBy: { scheduledAt: "asc" },
      take: 100,
    });
  },

  async listForPlayer(userId: string) {
    return db.event.findMany({
      where: { status: { in: ACCEPTING_SIGNUPS } },
      include: playerBrowseInclude(userId),
      orderBy: { scheduledAt: "asc" },
      take: 100,
    });
  },

  // The single "current" event for a player: the soonest event they're either
  // pending on or confirmed for that isn't completed/cancelled.
  async getCurrentForPlayer(userId: string) {
    return db.event.findFirst({
      where: {
        status: { in: ACCEPTING_SIGNUPS },
        signups: {
          some: {
            userId,
            status: { in: [SignupStatus.PENDING, SignupStatus.CONFIRMED] },
          },
        },
      },
      include: {
        host: true,
        _count: {
          select: {
            matches: true,
            signups: { where: { status: SignupStatus.CONFIRMED } },
          },
        },
        signups: {
          where: { userId },
          select: { id: true, status: true },
        },
        matches: {
          where: { participants: { some: { userId } } },
          include: { court: true, participants: { include: { user: true } } },
        },
      },
      orderBy: { scheduledAt: "asc" },
    });
  },

  // Full detail for the /events/[id] page. Admins see every signup; players
  // only need their own row but we still return event-level counts.
  async getById(eventId: string) {
    return db.event.findUnique({
      where: { id: eventId },
      include: {
        host: true,
        _count: {
          select: {
            matches: true,
            signups: { where: { status: SignupStatus.CONFIRMED } },
          },
        },
        signups: {
          include: { user: true },
          orderBy: [{ status: "asc" }, { createdAt: "asc" }],
        },
        matches: {
          include: { court: true, participants: { include: { user: true } } },
          orderBy: { scheduledAt: "asc" },
        },
      },
    });
  },

  async create(hostId: string, input: CreateEventInput) {
    const event = await db.event.create({
      data: {
        hostId,
        name: input.name,
        description: input.description?.trim() ? input.description.trim() : null,
        scheduledAt: input.scheduledAt,
        endsAt: input.endsAt ?? null,
        format: input.format,
        capacity: input.capacity,
        skillMin: input.skillMin,
        skillMax: input.skillMax,
      },
      include: adminEventInclude,
    });
    await broadcast(channels.eventsFeed, pusherEvents.eventCreated, {
      id: event.id,
      name: event.name,
    });
    return event;
  },

  async updateStatus(eventId: string, next: EventStatus) {
    const event = await db.event.findUnique({ where: { id: eventId } });
    if (!event) throw new Error("Event not found");
    if (event.status === next) return event;
    if (!allowedTransitions[event.status].includes(next)) {
      throw new InvalidStatusTransitionError(
        `Cannot move event from ${event.status} to ${next}`,
      );
    }
    const updated = await db.event.update({
      where: { id: eventId },
      data: { status: next },
      include: adminEventInclude,
    });
    await Promise.all([
      broadcast(channels.event(eventId), pusherEvents.eventUpdated, {
        id: eventId,
        status: next,
      }),
      broadcast(channels.eventsFeed, pusherEvents.eventUpdated, { id: eventId }),
    ]);
    return updated;
  },

  // Player requests to join — always lands as PENDING. No capacity check;
  // admin curates the roster.
  async requestSignup(userId: string, eventId: string) {
    const signup = await db.$transaction(async (tx) => {
      const event = await tx.event.findUnique({ where: { id: eventId } });
      if (!event) throw new Error("Event not found");
      if (!ACCEPTING_SIGNUPS.includes(event.status)) {
        throw new EventClosedError("Event has ended");
      }
      const existing = await tx.eventSignup.findUnique({
        where: { eventId_userId: { eventId, userId } },
      });
      if (existing) {
        if (existing.status === SignupStatus.DECLINED) {
          // Allow re-request after decline by resetting back to pending.
          return tx.eventSignup.update({
            where: { id: existing.id },
            data: {
              status: SignupStatus.PENDING,
              decidedAt: null,
              decidedById: null,
            },
          });
        }
        throw new AlreadySignedUpError("Already requested or signed up");
      }
      return tx.eventSignup.create({
        data: { eventId, userId, status: SignupStatus.PENDING },
      });
    });
    // Detail page (admin) needs the new request; list pages don't change
    // — confirmed count is unaffected by PENDING.
    await broadcast(channels.event(eventId), pusherEvents.signupRequested, {
      eventId,
      signupId: signup.id,
      userId,
    });
    return signup;
  },

  // Player withdraws — removes their row outright.
  async withdraw(userId: string, eventId: string) {
    // Capture whether the row was CONFIRMED so we know whether confirmed count
    // (and thus the list view) needs to update.
    const existing = await db.eventSignup.findUnique({
      where: { eventId_userId: { eventId, userId } },
    });
    await db.eventSignup.deleteMany({ where: { eventId, userId } });
    if (existing) {
      await broadcast(channels.event(eventId), pusherEvents.signupDecided, {
        eventId,
        signupId: existing.id,
        withdrew: true,
      });
      if (existing.status === SignupStatus.CONFIRMED) {
        await broadcast(channels.eventsFeed, pusherEvents.eventUpdated, {
          id: eventId,
        });
      }
    }
    return { ok: true };
  },

  async confirmSignup(adminId: string, signupId: string) {
    const result = await db.$transaction(async (tx) => {
      const signup = await tx.eventSignup.findUnique({
        where: { id: signupId },
        include: {
          event: {
            include: {
              _count: {
                select: {
                  signups: { where: { status: SignupStatus.CONFIRMED } },
                },
              },
            },
          },
        },
      });
      if (!signup) throw new SignupNotFoundError("Signup not found");
      if (signup.status === SignupStatus.CONFIRMED) return { signup, eventId: signup.eventId };
      if (signup.event._count.signups >= signup.event.capacity) {
        throw new EventCapacityError("Event is at capacity");
      }
      const updated = await tx.eventSignup.update({
        where: { id: signupId },
        data: {
          status: SignupStatus.CONFIRMED,
          decidedAt: new Date(),
          decidedById: adminId,
        },
      });
      // New confirmation may unlock a queued match if the queue had room and
      // was previously short of perMatch players in the waiting pool.
      await topUpQueue(tx, signup.eventId, signup.event.format);
      return { signup: updated, eventId: signup.eventId };
    });
    await Promise.all([
      broadcast(channels.event(result.eventId), pusherEvents.signupDecided, {
        eventId: result.eventId,
        signupId,
        status: SignupStatus.CONFIRMED,
      }),
      // Confirmed count changed → list view needs to update.
      broadcast(channels.eventsFeed, pusherEvents.eventUpdated, {
        id: result.eventId,
      }),
    ]);
    return result.signup;
  },

  async declineSignup(adminId: string, signupId: string) {
    const existing = await db.eventSignup.findUnique({ where: { id: signupId } });
    if (!existing) throw new SignupNotFoundError("Signup not found");
    const updated = await db.eventSignup.update({
      where: { id: signupId },
      data: {
        status: SignupStatus.DECLINED,
        decidedAt: new Date(),
        decidedById: adminId,
      },
    });
    await broadcast(channels.event(existing.eventId), pusherEvents.signupDecided, {
      eventId: existing.eventId,
      signupId,
      status: SignupStatus.DECLINED,
    });
    // If we just declined someone who was CONFIRMED (admin removes them), the
    // confirmed count drops — list view needs updating.
    if (existing.status === SignupStatus.CONFIRMED) {
      await broadcast(channels.eventsFeed, pusherEvents.eventUpdated, {
        id: existing.eventId,
      });
    }
    return updated;
  },

  // Auto-pair confirmed signups into Match records. v1: skill-sorted chunks
  // of 2 (singles) or 4 (doubles); round-robin across AVAILABLE courts;
  // leftovers reported back to the caller. One-shot — refuses to run if any
  // matches already exist for the event so we don't silently duplicate.
  async matchmake(eventId: string) {
    const event = await db.event.findUnique({
      where: { id: eventId },
      include: {
        signups: {
          where: { status: SignupStatus.CONFIRMED },
          include: { user: true },
        },
        _count: { select: { matches: true } },
      },
    });
    if (!event) throw new Error("Event not found");
    if (
      event.status === EventStatus.COMPLETED ||
      event.status === EventStatus.CANCELLED
    ) {
      throw new EventTerminalError("Event is not active");
    }
    if (event._count.matches > 0) {
      throw new MatchmakingAlreadyRunError(
        "Matches already exist for this event. Delete them first to re-run.",
      );
    }

    const perMatch = event.format === MatchFormat.DOUBLES ? 4 : 2;
    if (event.signups.length < perMatch) {
      throw new NotEnoughPlayersError(
        `Need at least ${perMatch} confirmed players, have ${event.signups.length}`,
      );
    }

    const courts = await db.court.findMany({
      where: { status: CourtStatus.AVAILABLE },
      orderBy: { name: "asc" },
    });
    if (courts.length === 0) {
      throw new NoAvailableCourtsError(
        "No AVAILABLE courts. Add or reopen one in Court management first.",
      );
    }

    // Sort by skill so chunks of consecutive players have similar ratings.
    const sorted = [...event.signups].sort(
      (a, b) => a.user.skillRating - b.user.skillRating,
    );

    // Cap pre-formed matches to courts + MAX_QUEUED_MATCHES. Anyone beyond
    // that stays in the signup pool as "waiting to be paired" — the queue
    // refills from this pool whenever a queued match is promoted onto a court.
    const maxMatches = courts.length + MAX_QUEUED_MATCHES;
    const fullGroups: typeof sorted[] = [];
    for (
      let i = 0;
      i + perMatch <= sorted.length && fullGroups.length < maxMatches;
      i += perMatch
    ) {
      fullGroups.push(sorted.slice(i, i + perMatch));
    }
    const leftover = sorted.slice(fullGroups.length * perMatch);

    // Pre-form ALL possible matches. First N groups (where N = available
    // courts) get a court and start running immediately (status=CONFIRMED,
    // startedAt=now). The rest queue up with no court and status=OPEN — they
    // get promoted onto a court via endAndAdvanceMatch when one frees up.
    const now = new Date();
    const created = await db.$transaction(async (tx) => {
      const matches = [];
      for (let i = 0; i < fullGroups.length; i++) {
        const group = fullGroups[i]!;
        const court = i < courts.length ? courts[i]! : null;
        const ratings = group.map((g) => g.user.skillRating);
        const match = await tx.match.create({
          data: {
            eventId,
            hostId: group[0]!.userId,
            courtId: court?.id ?? null,
            scheduledAt: event.scheduledAt,
            startedAt: court ? now : null,
            format: event.format,
            capacity: perMatch,
            skillMin: Math.min(...ratings),
            skillMax: Math.max(...ratings),
            status: court ? MatchStatus.CONFIRMED : MatchStatus.OPEN,
            notes: "Auto-paired from event matchmaking.",
            participants: {
              create: group.map((g) => ({ userId: g.userId })),
            },
          },
          include: {
            court: true,
            participants: { include: { user: true } },
          },
        });
        matches.push(match);
      }
      return matches;
    });

    await Promise.all([
      broadcast(channels.event(eventId), pusherEvents.eventUpdated, {
        id: eventId,
        matchesCreated: created.length,
      }),
      broadcast(channels.eventsFeed, pusherEvents.eventUpdated, { id: eventId }),
    ]);

    return {
      matches: created,
      leftover: leftover.map((s) => ({
        userId: s.userId,
        name: s.user.name,
      })),
      perMatch,
      courtsUsed: Math.min(courts.length, fullGroups.length),
    };
  },

  // Admin clicks "End game" on the courts board. Marks the active match
  // COMPLETED and frees the court for the next match. Preference order for
  // what to put on the freed court:
  //   1. The oldest queued match in this event (status=OPEN, courtId=null) —
  //      this is the normal path post-matchmaking. We just promote it: set
  //      courtId, startedAt=now, status=CONFIRMED.
  //   2. If the queue is empty, fall back to forming a fresh group from the
  //      remaining signup pool (confirmed signups not currently in another
  //      active match). Useful when late confirmations land after matchmaking
  //      already drained the queue.
  // Returns the new active match or null if neither path can produce one.
  async endAndAdvanceMatch(matchId: string) {
    const match = await db.match.findUnique({
      where: { id: matchId },
      include: {
        event: {
          include: {
            signups: {
              where: { status: SignupStatus.CONFIRMED },
              include: { user: true },
            },
          },
        },
      },
    });
    if (!match) throw new Error("Match not found");
    if (!match.eventId || !match.event) {
      throw new Error("Match is not tied to an event");
    }
    if (match.status === MatchStatus.COMPLETED) {
      throw new Error("Match already ended");
    }
    if (!match.courtId) {
      // Refusing to "end" a queued match — it never started. Admin should
      // cancel it instead (not yet exposed in UI).
      throw new Error("Cannot end a queued match (no court assigned)");
    }

    const eventId = match.eventId;
    const freedCourtId = match.courtId;
    const perMatch = match.event.format === MatchFormat.DOUBLES ? 4 : 2;

    const result = await db.$transaction(async (tx) => {
      // 1. End the current match.
      const ended = await tx.match.update({
        where: { id: matchId },
        data: { status: MatchStatus.COMPLETED },
        include: {
          court: true,
          participants: { include: { user: true } },
        },
      });

      // 2. Preferred: promote the oldest queued match for this event.
      const queued = await tx.match.findFirst({
        where: {
          eventId,
          status: MatchStatus.OPEN,
          courtId: null,
        },
        orderBy: { createdAt: "asc" },
      });
      if (queued) {
        const promoted = await tx.match.update({
          where: { id: queued.id },
          data: {
            courtId: freedCourtId,
            status: MatchStatus.CONFIRMED,
            startedAt: new Date(),
          },
          include: {
            court: true,
            participants: { include: { user: true } },
          },
        });
        // Queue just lost a slot — refill from the waiting pool.
        await topUpQueue(tx, eventId, match.event!.format);
        return { ended, next: promoted };
      }

      // 3. Fallback: form a fresh group from the signup pool.
      const currentlyPlaying = await tx.matchParticipant.findMany({
        where: { match: { eventId, status: MatchStatus.CONFIRMED } },
        select: { userId: true },
      });
      const inAnotherMatch = new Set(currentlyPlaying.map((p) => p.userId));

      const pool = match.event!.signups
        .filter((s) => !inAnotherMatch.has(s.userId))
        .sort((a, b) => a.user.skillRating - b.user.skillRating);

      if (pool.length < perMatch) {
        return { ended, next: null as null | typeof ended };
      }

      const group = pool.slice(0, perMatch);
      const ratings = group.map((g) => g.user.skillRating);
      const next = await tx.match.create({
        data: {
          eventId,
          hostId: group[0]!.userId,
          courtId: freedCourtId,
          scheduledAt: new Date(),
          startedAt: new Date(),
          format: match.event!.format,
          capacity: perMatch,
          skillMin: Math.min(...ratings),
          skillMax: Math.max(...ratings),
          status: MatchStatus.CONFIRMED,
          notes: "Auto-paired after previous match ended.",
          participants: { create: group.map((g) => ({ userId: g.userId })) },
        },
        include: {
          court: true,
          participants: { include: { user: true } },
        },
      });
      // Try to repopulate the queue from any remaining waiting players.
      await topUpQueue(tx, eventId, match.event!.format);

      return { ended, next };
    });

    await Promise.all([
      broadcast(channels.event(eventId), pusherEvents.eventUpdated, {
        id: eventId,
        matchEnded: matchId,
        nextMatch: result.next?.id ?? null,
      }),
      broadcast(channels.eventsFeed, pusherEvents.eventUpdated, { id: eventId }),
    ]);

    return result;
  },

  // Put a match on a court that's currently sitting idle — used when admin
  // marks a court AVAILABLE again and clicks "Assign next match." Same
  // preference order as endAndAdvanceMatch:
  //   1. Promote the oldest queued OPEN match in this event.
  //   2. Fall back to forming a fresh group from the signup pool (confirmed
  //      signups not currently in another active match for this event).
  // Returns the new active match or null when neither path can produce one.
  async assignNextMatchToCourt(eventId: string, courtId: string) {
    const event = await db.event.findUnique({
      where: { id: eventId },
      include: {
        signups: {
          where: { status: SignupStatus.CONFIRMED },
          include: { user: true },
        },
      },
    });
    if (!event) throw new Error("Event not found");

    const court = await db.court.findUnique({ where: { id: courtId } });
    if (!court) throw new Error("Court not found");
    if (court.status !== CourtStatus.AVAILABLE) {
      throw new EventClosedError(
        "Court is not AVAILABLE — change its status before assigning.",
      );
    }

    const perMatch = event.format === MatchFormat.DOUBLES ? 4 : 2;

    const next = await db.$transaction(async (tx) => {
      // Refuse if this court already has a CONFIRMED match. Stops double-
      // assignment if the admin clicks the button twice quickly.
      const busy = await tx.match.findFirst({
        where: { courtId, status: MatchStatus.CONFIRMED },
      });
      if (busy) return null;

      // 1. Promote the oldest queued match.
      const queued = await tx.match.findFirst({
        where: {
          eventId,
          status: MatchStatus.OPEN,
          courtId: null,
        },
        orderBy: { createdAt: "asc" },
      });
      if (queued) {
        const promoted = await tx.match.update({
          where: { id: queued.id },
          data: {
            courtId,
            status: MatchStatus.CONFIRMED,
            startedAt: new Date(),
          },
          include: {
            court: true,
            participants: { include: { user: true } },
          },
        });
        // Queue just lost a slot — refill from the waiting pool.
        await topUpQueue(tx, eventId, event.format);
        return promoted;
      }

      // 2. Fallback: form a fresh group from the signup pool.
      const currentlyPlaying = await tx.matchParticipant.findMany({
        where: { match: { eventId, status: MatchStatus.CONFIRMED } },
        select: { userId: true },
      });
      const inAnotherMatch = new Set(currentlyPlaying.map((p) => p.userId));

      const pool = event.signups
        .filter((s) => !inAnotherMatch.has(s.userId))
        .sort((a, b) => a.user.skillRating - b.user.skillRating);

      if (pool.length < perMatch) return null;

      const group = pool.slice(0, perMatch);
      const ratings = group.map((g) => g.user.skillRating);
      const fresh = await tx.match.create({
        data: {
          eventId,
          hostId: group[0]!.userId,
          courtId,
          scheduledAt: new Date(),
          startedAt: new Date(),
          format: event.format,
          capacity: perMatch,
          skillMin: Math.min(...ratings),
          skillMax: Math.max(...ratings),
          status: MatchStatus.CONFIRMED,
          notes: "Auto-paired on court assignment.",
          participants: { create: group.map((g) => ({ userId: g.userId })) },
        },
        include: {
          court: true,
          participants: { include: { user: true } },
        },
      });
      await topUpQueue(tx, eventId, event.format);
      return fresh;
    });

    if (next) {
      await Promise.all([
        broadcast(channels.event(eventId), pusherEvents.eventUpdated, {
          id: eventId,
          matchAssigned: next.id,
          courtId,
        }),
        broadcast(channels.eventsFeed, pusherEvents.eventUpdated, { id: eventId }),
      ]);
    }

    return next;
  },
};
