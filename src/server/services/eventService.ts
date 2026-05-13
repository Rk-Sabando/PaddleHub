import { EventStatus, Prisma, SignupStatus } from "@prisma/client";
import { db } from "@/lib/db";
import type { CreateEventInput } from "@/lib/validators/event";

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
  OPEN: [EventStatus.MATCHMAKING, EventStatus.CANCELLED],
  MATCHMAKING: [EventStatus.OPEN, EventStatus.IN_PROGRESS, EventStatus.CANCELLED],
  IN_PROGRESS: [EventStatus.COMPLETED, EventStatus.CANCELLED],
  COMPLETED: [],
  CANCELLED: [],
};

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
      where: { status: { in: [EventStatus.OPEN, EventStatus.MATCHMAKING] } },
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
        status: {
          in: [EventStatus.OPEN, EventStatus.MATCHMAKING, EventStatus.IN_PROGRESS],
        },
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
    return db.event.create({
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
    return db.event.update({
      where: { id: eventId },
      data: { status: next },
      include: adminEventInclude,
    });
  },

  // Player requests to join — always lands as PENDING. No capacity check;
  // admin curates the roster.
  async requestSignup(userId: string, eventId: string) {
    return db.$transaction(async (tx) => {
      const event = await tx.event.findUnique({ where: { id: eventId } });
      if (!event) throw new Error("Event not found");
      if (event.status !== EventStatus.OPEN) {
        throw new EventClosedError("Event is not open for signups");
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
  },

  // Player withdraws — removes their row outright.
  async withdraw(userId: string, eventId: string) {
    await db.eventSignup.deleteMany({
      where: { eventId, userId },
    });
    return { ok: true };
  },

  async confirmSignup(adminId: string, signupId: string) {
    return db.$transaction(async (tx) => {
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
      if (signup.status === SignupStatus.CONFIRMED) return signup;
      if (signup.event._count.signups >= signup.event.capacity) {
        throw new EventCapacityError("Event is at capacity");
      }
      return tx.eventSignup.update({
        where: { id: signupId },
        data: {
          status: SignupStatus.CONFIRMED,
          decidedAt: new Date(),
          decidedById: adminId,
        },
      });
    });
  },

  async declineSignup(adminId: string, signupId: string) {
    const signup = await db.eventSignup.findUnique({ where: { id: signupId } });
    if (!signup) throw new SignupNotFoundError("Signup not found");
    return db.eventSignup.update({
      where: { id: signupId },
      data: {
        status: SignupStatus.DECLINED,
        decidedAt: new Date(),
        decidedById: adminId,
      },
    });
  },
};
