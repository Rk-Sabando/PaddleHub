import { CourtStatus, MatchStatus, Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { channels, events as pusherEvents } from "@/lib/pusher";
import { pusherServer } from "@/lib/pusher-server";
import type { CreateCourtInput, UpdateCourtInput } from "@/lib/validators/court";

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

export class CourtNameConflictError extends Error {
  status = 409;
}
export class CourtHasMatchesError extends Error {
  status = 409;
}
export class CourtNotFoundError extends Error {
  status = 404;
}

const courtListInclude = {
  manager: { select: { id: true, name: true, email: true } },
  _count: { select: { matches: true } },
} satisfies Prisma.CourtInclude;

export const courtService = {
  async list() {
    return db.court.findMany({
      include: courtListInclude,
      orderBy: { name: "asc" },
    });
  },

  async getById(id: string) {
    return db.court.findUnique({ where: { id }, include: courtListInclude });
  },

  async create(managerId: string, input: CreateCourtInput) {
    try {
      return await db.court.create({
        data: {
          name: input.name.trim(),
          location: input.location.trim(),
          surface: input.surface.trim(),
          status: input.status,
          managerId,
        },
        include: courtListInclude,
      });
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === "P2002"
      ) {
        throw new CourtNameConflictError("A court with that name already exists");
      }
      throw err;
    }
  },

  async update(id: string, input: UpdateCourtInput) {
    const existing = await db.court.findUnique({ where: { id } });
    if (!existing) throw new CourtNotFoundError("Court not found");

    // Side effect: leaving AVAILABLE while a match is live on this court
    // forces that match to end immediately. Players rejoin the signup pool
    // and can be picked up by endAndAdvance on a different court (or by an
    // explicit Assign action once the court returns to AVAILABLE).
    const leavingAvailable =
      input.status !== undefined &&
      input.status !== CourtStatus.AVAILABLE &&
      existing.status === CourtStatus.AVAILABLE;

    let endedEventIds: string[] = [];
    if (leavingAvailable) {
      const active = await db.match.findMany({
        where: { courtId: id, status: MatchStatus.CONFIRMED },
        select: { id: true, eventId: true },
      });
      if (active.length > 0) {
        await db.match.updateMany({
          where: { id: { in: active.map((m) => m.id) } },
          data: { status: MatchStatus.COMPLETED },
        });
        endedEventIds = Array.from(
          new Set(
            active
              .map((m) => m.eventId)
              .filter((e): e is string => e !== null),
          ),
        );
      }
    }

    let updated;
    try {
      updated = await db.court.update({
        where: { id },
        data: {
          name: input.name?.trim(),
          location: input.location?.trim(),
          surface: input.surface?.trim(),
          status: input.status,
        },
        include: courtListInclude,
      });
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === "P2002"
      ) {
        throw new CourtNameConflictError("A court with that name already exists");
      }
      throw err;
    }

    // Notify any open event detail / matches page that its match list changed.
    await Promise.all(
      endedEventIds.flatMap((eventId) => [
        broadcast(channels.event(eventId), pusherEvents.eventUpdated, {
          id: eventId,
          courtId: id,
          courtStatus: updated.status,
          matchAutoEnded: true,
        }),
        broadcast(channels.eventsFeed, pusherEvents.eventUpdated, { id: eventId }),
      ]),
    );

    return updated;
  },

  // Refuses to delete if matches reference this court — admin should mark it
  // CLOSED instead. We could cascade, but losing match history silently is a
  // bigger footgun than the friction here.
  async delete(id: string) {
    const court = await db.court.findUnique({
      where: { id },
      include: { _count: { select: { matches: true } } },
    });
    if (!court) throw new CourtNotFoundError("Court not found");
    if (court._count.matches > 0) {
      throw new CourtHasMatchesError(
        `Court has ${court._count.matches} match(es) referencing it. Set status to CLOSED instead.`,
      );
    }
    await db.court.delete({ where: { id } });
    return { ok: true };
  },
};
