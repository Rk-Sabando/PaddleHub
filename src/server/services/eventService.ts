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
import { sendPushToUser, sendPushToUsers } from "@/lib/push";
import type { CreateEventInput } from "@/lib/validators/event";

// Per-event transaction lock. Serializes mutations of one event's match queue
// (court ends, manual assignments, queue top-ups) so two parallel "End game"
// clicks can't both claim the same queued match or both pull the same players
// from the signup pool. Released automatically when the transaction commits or
// rolls back. Different events are unaffected — they hash to different lock IDs.
async function lockEvent(tx: Prisma.TransactionClient, eventId: string): Promise<void> {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${eventId}, 0))`;
}

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

type MatchAssignmentNotificationTarget = {
  id: string;
  eventId: string | null;
  court: { name: string } | null;
  participants: Array<{ userId: string }>;
};

async function notifyPlayersAssignedToCourt(match: MatchAssignmentNotificationTarget) {
  if (!match.court) return;
  const courtName = match.court.name;
  const message = `Proceed to ${courtName} for your next match`;
  await Promise.all(
    match.participants.flatMap((participant) => [
      broadcast(channels.user(participant.userId), pusherEvents.userNotification, {
        type: "court-assignment",
        eventId: match.eventId,
        matchId: match.id,
        courtName,
        title: "Paddle up!",
        message,
      }),
      // Background push — fires even if the player has the tab closed. The
      // tag collapses repeated assignments for the same event into one badge.
      sendPushToUser(participant.userId, {
        type: "court-assignment",
        title: "Paddle up!",
        body: message,
        url: match.eventId ? `/events/${match.eventId}` : "/dashboard",
        tag: `court-assignment:${match.eventId ?? match.id}`,
      }),
    ]),
  );
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
const SKILL_MATCH_DELTA = 1;

type SignupWithUser = Prisma.EventSignupGetPayload<{
  include: { user: true };
}>;
type QueuePlayer = SignupWithUser & { gamesPlayed: number };
type QueueMatchTeams<T> = { teamA: T[]; teamB: T[] };

function compareScore(a: number[], b: number[]) {
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    if (a[i] !== b[i]) return a[i]! - b[i]!;
  }
  return a.length - b.length;
}

function sortQueueByPriority(players: QueuePlayer[]) {
  return [...players].sort((a, b) => {
    // Priority 1: FIFO by signup time.
    const fifo = a.createdAt.getTime() - b.createdAt.getTime();
    if (fifo !== 0) return fifo;
    // Priority 2 (tie-breaker): fewer completed games first.
    const games = a.gamesPlayed - b.gamesPlayed;
    if (games !== 0) return games;
    // Deterministic tie-breaker.
    return a.userId.localeCompare(b.userId);
  });
}

function isSkillCompatible(a: QueuePlayer, b: QueuePlayer, maxDelta: number) {
  return Math.abs(a.user.skillRating - b.user.skillRating) <= maxDelta;
}

function hasSkillPeer(player: QueuePlayer, pool: QueuePlayer[], maxDelta: number) {
  return pool.some((p) => p.userId !== player.userId && isSkillCompatible(player, p, maxDelta));
}

function chooseBalancedDoublesTeams(
  players: QueuePlayer[],
  maxDelta: number,
): QueueMatchTeams<QueuePlayer> | null {
  if (players.length !== 4) return null;
  // Overall max-min spread guard. Pair-wise + team-average checks below can
  // still let through a group like (1, 2, 2, 3) where every pair is ≤ 1 but
  // the highest and lowest player are 2.0 apart. Reject the whole group here.
  const allRatings = players.map((p) => p.user.skillRating);
  if (Math.max(...allRatings) - Math.min(...allRatings) > maxDelta) return null;
  const anchor = players[0]!;
  const others = players.slice(1);
  let best: { teams: QueueMatchTeams<QueuePlayer>; score: number[]; tieKey: string } | null = null;

  for (let i = 0; i < others.length; i++) {
    const teammate = others[i]!;
    const teamB = others.filter((_, idx) => idx !== i);
    if (teamB.length !== 2) continue;
    if (!isSkillCompatible(anchor, teammate, maxDelta)) continue;
    if (!isSkillCompatible(teamB[0]!, teamB[1]!, maxDelta)) continue;

    const teamA = [anchor, teammate];
    const avgA = (teamA[0]!.user.skillRating + teamA[1]!.user.skillRating) / 2;
    const avgB = (teamB[0]!.user.skillRating + teamB[1]!.user.skillRating) / 2;
    if (Math.abs(avgA - avgB) > maxDelta) continue;

    // Priority 2: lower games first. Priority 3: tighter skill pairing.
    const gamesA = teamA[0]!.gamesPlayed + teamA[1]!.gamesPlayed;
    const gamesB = teamB[0]!.gamesPlayed + teamB[1]!.gamesPlayed;
    const score = [
      gamesA,
      gamesB,
      Math.abs(gamesA - gamesB),
      Math.abs(teamA[0]!.user.skillRating - teamA[1]!.user.skillRating),
      Math.abs(avgA - avgB),
    ];
    const tieKey = [...teamA, ...teamB]
      .map((p) => p.userId)
      .sort((a, b) => a.localeCompare(b))
      .join("|");
    if (
      !best ||
      compareScore(score, best.score) < 0 ||
      (compareScore(score, best.score) === 0 && tieKey.localeCompare(best.tieKey) < 0)
    ) {
      best = {
        teams: { teamA, teamB },
        score,
        tieKey,
      };
    }
  }

  return best?.teams ?? null;
}

// Pick the tightest-skill group of `perMatch` players from the pool.
// The optimum k-element subset of a sorted-by-skill list (minimising max - min)
// is always a *consecutive* window — proof: any non-consecutive selection has
// an inner gap that can be tightened by swapping for an adjacent value. So we
// sort once and slide.
//
// Among windows that satisfy spread ≤ maxDelta, we prefer fewer total games
// played (starvation prevention), then tighter spread, then earliest signup
// (FIFO). If *no* window satisfies the strict spread, we widen to all windows
// and surface the looser choice via the `widened` flag so callers can log it.
type TightGroupPlayer = {
  userId: string;
  user: { skillRating: number };
  createdAt: Date;
  gamesPlayed: number;
};
function pickTightestSkillGroup<T extends TightGroupPlayer>(
  pool: T[],
  perMatch: number,
  maxDelta: number,
): { group: T[]; spread: number; widened: boolean } | null {
  if (pool.length < perMatch) return null;
  const sorted = [...pool].sort((a, b) => a.user.skillRating - b.user.skillRating);

  type Win = { players: T[]; spread: number; totalGames: number; firstSignup: number };
  const windows: Win[] = [];
  for (let i = 0; i + perMatch <= sorted.length; i++) {
    const players = sorted.slice(i, i + perMatch);
    const spread =
      players[perMatch - 1]!.user.skillRating - players[0]!.user.skillRating;
    const totalGames = players.reduce((s, p) => s + p.gamesPlayed, 0);
    const firstSignup = Math.min(...players.map((p) => p.createdAt.getTime()));
    windows.push({ players, spread, totalGames, firstSignup });
  }

  const tight = windows.filter((w) => w.spread <= maxDelta);
  const widened = tight.length === 0;
  const candidates = widened ? windows : tight;

  candidates.sort((a, b) => {
    if (a.totalGames !== b.totalGames) return a.totalGames - b.totalGames;
    if (a.spread !== b.spread) return a.spread - b.spread;
    return a.firstSignup - b.firstSignup;
  });

  const best = candidates[0]!;
  return { group: best.players, spread: best.spread, widened };
}

function combinations<T>(arr: T[], pick: number): T[][] {
  if (pick === 0) return [[]];
  if (arr.length < pick) return [];
  if (arr.length === pick) return [arr];
  const head = arr[0]!;
  const tail = arr.slice(1);
  const withHead = combinations(tail, pick - 1).map((rest): T[] => [head, ...rest]);
  const withoutHead = combinations(tail, pick);
  return [...withHead, ...withoutHead];
}

function selectMatchForAnchor(
  queue: QueuePlayer[],
  format: MatchFormat,
  maxDelta: number,
): { selectedIds: Set<string>; teams: QueueMatchTeams<QueuePlayer> } | null {
  const anchor = queue[0];
  if (!anchor) return null;
  if (format === MatchFormat.SINGLES) {
    const opponent = queue
      .slice(1)
      .filter((p) => isSkillCompatible(anchor, p, maxDelta))
      .sort((a, b) => {
        const games = a.gamesPlayed - b.gamesPlayed;
        if (games !== 0) return games;
        const skill = Math.abs(anchor.user.skillRating - a.user.skillRating)
          - Math.abs(anchor.user.skillRating - b.user.skillRating);
        if (skill !== 0) return skill;
        return a.userId.localeCompare(b.userId);
      })[0];
    if (!opponent) return null;
    return {
      selectedIds: new Set([anchor.userId, opponent.userId]),
      teams: { teamA: [anchor], teamB: [opponent] },
    };
  }

  const idx = new Map(queue.map((p, i) => [p.userId, i]));
  let best: {
    selectedIds: Set<string>;
    teams: QueueMatchTeams<QueuePlayer>;
    score: number[];
    tieKey: string;
  } | null = null;
  for (const combo of combinations(queue.slice(1), 3)) {
    const players = [anchor, ...combo];
    const teams = chooseBalancedDoublesTeams(players, maxDelta);
    if (!teams) continue;
    const totalGames = players.reduce((sum, p) => sum + p.gamesPlayed, 0);
    const queuePositionSum = combo.reduce((sum, p) => sum + (idx.get(p.userId) ?? 0), 0);
    const maxSpread =
      Math.max(...players.map((p) => p.user.skillRating)) -
      Math.min(...players.map((p) => p.user.skillRating));
    const score = [totalGames, queuePositionSum, maxSpread];
    const selectedIds = new Set(players.map((p) => p.userId));
    const tieKey = [...selectedIds].sort((a, b) => a.localeCompare(b)).join("|");
    if (
      !best ||
      compareScore(score, best.score) < 0 ||
      (compareScore(score, best.score) === 0 && tieKey.localeCompare(best.tieKey) < 0)
    ) {
      best = { selectedIds, teams, score, tieKey };
    }
  }

  return best ? { selectedIds: best.selectedIds, teams: best.teams } : null;
}

function formatTeams(teams: QueueMatchTeams<QueuePlayer>) {
  return {
    teamA: teams.teamA.map((p) => ({
      userId: p.userId,
      name: p.user.name,
      skillRating: p.user.skillRating,
      gamesPlayed: p.gamesPlayed,
    })),
    teamB: teams.teamB.map((p) => ({
      userId: p.userId,
      name: p.user.name,
      skillRating: p.user.skillRating,
      gamesPlayed: p.gamesPlayed,
    })),
  };
}

// Forms one OPEN queued match (no court yet) from the signup pool if there
// are enough confirmed players not currently in another active/queued match.
// Called from inside a transaction.
async function formOneQueuedMatch(
  tx: Prisma.TransactionClient,
  eventId: string,
  format: MatchFormat,
): Promise<boolean> {
  // Check if matchmaking is disabled for this event
  const event = await tx.event.findUnique({ where: { id: eventId }, select: { matchmakingDisabled: true } });
  if (event?.matchmakingDisabled) return false;
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
      optedOut: false,
      userId: { notIn: Array.from(taken) },
    },
    include: { user: true },
  });
  if (pool.length < perMatch) return false;

  // Count COMPLETED matches per pool player. Used as a tie-breaker so players
  // who've played fewer games get into the next match first when multiple
  // tight-skill windows are available.
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

  const enriched = pool.map((p) => ({ ...p, gamesPlayed: playCount.get(p.userId) ?? 0 }));
  const pick = pickTightestSkillGroup(enriched, perMatch, SKILL_MATCH_DELTA);
  if (!pick) return false;
  if (pick.widened) {
    console.warn(
      `[matchmaking] event=${eventId} formed queued match with spread=${pick.spread.toFixed(
        2,
      )} > ${SKILL_MATCH_DELTA} — no tighter skill window available in pool of ${pool.length}`,
    );
  }
  const group = pick.group;
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
  // Check if matchmaking is disabled for this event
  const event = await tx.event.findUnique({ where: { id: eventId }, select: { matchmakingDisabled: true } });
  if (event?.matchmakingDisabled) return 0;
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
    const pushNotice =
      next === EventStatus.IN_PROGRESS
        ? { title: "Event started", body: `${updated.name} is now live.` }
        : next === EventStatus.CANCELLED
          ? { title: "Event cancelled", body: `${updated.name} was cancelled.` }
          : null;
    let signupUserIds: string[] = [];
    if (pushNotice) {
      const signups = await db.eventSignup.findMany({
        where: {
          eventId,
          status: { in: [SignupStatus.CONFIRMED, SignupStatus.PENDING] },
        },
        select: { userId: true },
      });
      signupUserIds = signups.map((s) => s.userId);
    }
    await Promise.all([
      broadcast(channels.event(eventId), pusherEvents.eventUpdated, {
        id: eventId,
        status: next,
      }),
      broadcast(channels.eventsFeed, pusherEvents.eventUpdated, { id: eventId }),
      pushNotice
        ? sendPushToUsers(signupUserIds, {
            type: `event-${next.toLowerCase()}`,
            title: pushNotice.title,
            body: pushNotice.body,
            url: `/events/${eventId}`,
            tag: `event-status:${eventId}`,
          })
        : Promise.resolve(),
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

  // Player sits out / resumes mid-event. Unlike withdraw this preserves the
  // signup row + match history; the flag just excludes the player from future
  // matchmaking pool reads. Matches the player is *already* in are unaffected
  // — they play those out and only stop getting paired up once the current
  // ones complete. Reversible while the event is live.
  async setOptOut(userId: string, eventId: string, optedOut: boolean) {
    const signup = await db.eventSignup.findUnique({
      where: { eventId_userId: { eventId, userId } },
      include: { event: { select: { format: true, status: true } } },
    });
    if (!signup) throw new SignupNotFoundError("You're not signed up for this event");
    if (signup.status !== SignupStatus.CONFIRMED) {
      throw new InvalidStatusTransitionError(
        "Only confirmed signups can sit out — withdraw the pending request instead.",
      );
    }
    if (signup.optedOut === optedOut) return signup;

    const updated = await db.$transaction(async (tx) => {
      await lockEvent(tx, eventId);
      const row = await tx.eventSignup.update({
        where: { id: signup.id },
        data: { optedOut },
      });
      // Resuming reopens the pool — top up the queue in case a fresh match
      // can now be formed including this player.
      if (!optedOut) {
        await topUpQueue(tx, eventId, signup.event.format);
      }
      return row;
    });

    await Promise.all([
      broadcast(channels.event(eventId), pusherEvents.eventUpdated, {
        eventId,
        signupId: signup.id,
        optedOut,
      }),
      // List view doesn't change — confirmed count is unaffected.
    ]);
    return updated;
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
    const eventName = await db.event
      .findUnique({ where: { id: result.eventId }, select: { name: true } })
      .then((e) => e?.name ?? "your event");
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
      sendPushToUser(result.signup.userId, {
        type: "signup-confirmed",
        title: "You're in!",
        body: `Your signup for ${eventName} was confirmed.`,
        url: `/events/${result.eventId}`,
        tag: `signup-confirmed:${result.eventId}`,
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

  // Auto-pair confirmed signups into Match records with deterministic
  // priority ordering: FIFO queue age, then fewer games played, then skill fit.
  // One-shot — refuses to run if any matches already exist for the event so we
  // don't silently duplicate.
  async matchmake(eventId: string) {
    const event = await db.event.findUnique({
      where: { id: eventId },
      include: {
        signups: {
          where: { status: SignupStatus.CONFIRMED, optedOut: false },
          include: { user: true },
          orderBy: [{ createdAt: "asc" }, { userId: "asc" }],
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

    const completedCounts = await db.matchParticipant.groupBy({
      by: ["userId"],
      where: {
        match: { eventId, status: MatchStatus.COMPLETED },
        userId: { in: event.signups.map((s) => s.userId) },
      },
      _count: { _all: true },
    });
    const gamesPlayed = new Map(completedCounts.map((c) => [c.userId, c._count._all]));
    let queue = sortQueueByPriority(
      event.signups.map((signup) => ({
        ...signup,
        gamesPlayed: gamesPlayed.get(signup.userId) ?? 0,
      })),
    );
    const initialQueue = [...queue];

    // Cap pre-formed matches to courts + MAX_QUEUED_MATCHES. Anyone beyond
    // that stays in the signup pool as "waiting to be paired" — the queue
    // refills from this pool whenever a queued match is promoted onto a court.
    const maxMatches = courts.length + MAX_QUEUED_MATCHES;
    const planned: Array<{
      players: QueuePlayer[];
      teams: QueueMatchTeams<QueuePlayer>;
    }> = [];
    const rotated = new Map<string, number>();
    let attemptsWithoutProgress = 0;

    while (queue.length >= perMatch && planned.length < maxMatches) {
      // Priority 1: oldest waiting player is always the anchor candidate.
      const plan = selectMatchForAnchor(queue, event.format, SKILL_MATCH_DELTA);
      if (plan) {
        const players = queue.filter((p) => plan.selectedIds.has(p.userId));
        planned.push({ players, teams: plan.teams });
        queue = queue.filter((p) => !plan.selectedIds.has(p.userId));
        attemptsWithoutProgress = 0;
        continue;
      }

      // Starvation prevention: rotate one unmatchable anchor so others can play.
      const anchor = queue.shift()!;
      rotated.set(anchor.userId, (rotated.get(anchor.userId) ?? 0) + 1);
      queue.push(anchor);
      attemptsWithoutProgress += 1;
      if (attemptsWithoutProgress >= queue.length) {
        break;
      }
    }
    const leftover = queue;
    const noSkillMatch = initialQueue.filter((p) => !hasSkillPeer(p, initialQueue, SKILL_MATCH_DELTA));

    // Pre-form ALL possible matches. First N groups (where N = available
    // courts) get a court and start running immediately (status=CONFIRMED,
    // startedAt=now). The rest queue up with no court and status=OPEN — they
    // get promoted onto a court via endAndAdvanceMatch when one frees up.
    const now = new Date();
    const created = await db.$transaction(async (tx) => {
      const matches = [];
      for (let i = 0; i < planned.length; i++) {
        const group = planned[i]!;
        const court = i < courts.length ? courts[i]! : null;
        const participants = [...group.teams.teamA, ...group.teams.teamB];
        const ratings = participants.map((g) => g.user.skillRating);
        const match = await tx.match.create({
          data: {
            eventId,
            hostId: group.teams.teamA[0]!.userId,
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
              create: participants.map((g) => ({ userId: g.userId })),
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
      ...created
        .filter((m) => m.court !== null && m.status === MatchStatus.CONFIRMED)
        .map((m) => notifyPlayersAssignedToCourt(m)),
    ]);

    return {
      matches: created,
      matchObjects: planned.map((p) => formatTeams(p.teams)),
      leftover: leftover.map((s) => ({
        userId: s.userId,
        name: s.user.name,
      })),
      validation: {
        oddPlayersInQueue: event.signups.length % 2 !== 0,
        playersWithoutSkillMatch: noSkillMatch.map((p) => ({
          userId: p.userId,
          name: p.user.name,
          skillRating: p.user.skillRating,
        })),
        starvationPrevented: [...rotated.keys()].map((userId) => {
          const player = initialQueue.find((p) => p.userId === userId)!;
          return {
            userId,
            name: player.user.name,
            rotations: rotated.get(userId) ?? 0,
          };
        }),
      },
      perMatch,
      courtsUsed: Math.min(courts.length, planned.length),
    };
  },

  // Admin clicks "End game" on the courts board. Marks the active match
  // COMPLETED and frees the court. If a queued OPEN match exists, promote it;
  // otherwise keep the court idle.
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
    const result = await db.$transaction(async (tx) => {
      // Serialize all queue mutations for this event. Without this, two
      // simultaneous End-game clicks race on the "oldest queued match" lookup
      // and either double-assign one match (last write wins) or duplicate
      // queued matches by topping up from the same player pool twice.
      await lockEvent(tx, eventId);

      // 1. End the current match.
      const ended = await tx.match.update({
        where: { id: matchId },
        // Explicitly release the court from the ended match so the court is
        // immediately represented as idle when no replacement match is created.
        data: { status: MatchStatus.COMPLETED, courtId: null },
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

      return { ended, next: null };
    });

    await Promise.all([
      broadcast(channels.event(eventId), pusherEvents.eventUpdated, {
        id: eventId,
        matchEnded: matchId,
        nextMatch: result.next?.id ?? null,
      }),
      broadcast(channels.eventsFeed, pusherEvents.eventUpdated, { id: eventId }),
      ...(result.next ? [notifyPlayersAssignedToCourt(result.next)] : []),
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
          where: { status: SignupStatus.CONFIRMED, optedOut: false },
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
      // Same per-event serialization as endAndAdvanceMatch — protects against
      // a parallel End-game claiming the queued match this call was about to
      // promote, and against duplicate top-ups from the same signup pool.
      await lockEvent(tx, eventId);

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

      // 2. Fallback: form a fresh group from the signup pool. Same tight-
      // skill logic as the queued top-up so manual court assignments aren't
      // worse than the auto-formed queue.
      const inOtherMatch = await tx.matchParticipant.findMany({
        where: {
          match: { eventId, status: { in: [MatchStatus.CONFIRMED, MatchStatus.OPEN] } },
        },
        select: { userId: true },
      });
      const taken = new Set(inOtherMatch.map((p) => p.userId));

      const completedHere = await tx.matchParticipant.findMany({
        where: {
          match: { eventId, status: MatchStatus.COMPLETED },
          userId: { in: event.signups.map((s) => s.userId) },
        },
        select: { userId: true },
      });
      const playCount = new Map<string, number>();
      for (const p of completedHere) {
        playCount.set(p.userId, (playCount.get(p.userId) ?? 0) + 1);
      }

      const enriched = event.signups
        .filter((s) => !taken.has(s.userId))
        .map((s) => ({ ...s, gamesPlayed: playCount.get(s.userId) ?? 0 }));

      const pick = pickTightestSkillGroup(enriched, perMatch, SKILL_MATCH_DELTA);
      if (!pick) return null;
      if (pick.widened) {
        console.warn(
          `[matchmaking] event=${eventId} court=${courtId} fallback group spread=${pick.spread.toFixed(
            2,
          )} > ${SKILL_MATCH_DELTA}`,
        );
      }
      const group = pick.group;
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
        notifyPlayersAssignedToCourt(next),
      ]);
    }

    return next;
  },
};
