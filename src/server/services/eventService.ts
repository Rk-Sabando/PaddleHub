import { EventStatus, Prisma, SignupStatus } from "@prisma/client";
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

// Forward transitions only; admin can also CANCEL from anywhere except COMPLETED.
const allowedTransitions: Record<EventStatus, EventStatus[]> = {
  OPEN: [EventStatus.IN_PROGRESS, EventStatus.CANCELLED],
  IN_PROGRESS: [EventStatus.COMPLETED, EventStatus.CANCELLED],
  COMPLETED: [],
  CANCELLED: [],
};

// Signups are accepted whenever the event hasn't ended yet.
const ACCEPTING_SIGNUPS: EventStatus[] = [EventStatus.OPEN, EventStatus.IN_PROGRESS];

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
};
