import { db } from "@/lib/db";
import { pusherServer, channels, events } from "@/lib/pusher";
import type { CreateMatchInput, ListMatchesQuery } from "@/lib/validators/match";

// Business logic for matches. Keep route handlers thin; test these in Vitest.
export const matchService = {
  async list(query: ListMatchesQuery) {
    return db.match.findMany({
      where: {
        status: query.status,
        format: query.format,
        skillMin: query.skillMax ? { lte: query.skillMax } : undefined,
        skillMax: query.skillMin ? { gte: query.skillMin } : undefined,
      },
      include: { host: true, participants: { include: { user: true } } },
      orderBy: { scheduledAt: "asc" },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    });
  },

  async getById(id: string) {
    return db.match.findUnique({
      where: { id },
      include: { host: true, participants: { include: { user: true } } },
    });
  },

  async create(userId: string, input: CreateMatchInput) {
    const match = await db.match.create({
      data: {
        hostId: userId,
        scheduledAt: input.scheduledAt,
        format: input.format,
        skillMin: input.skillMin,
        skillMax: input.skillMax,
        capacity: input.capacity,
        notes: input.notes,
        participants: { create: [{ userId }] },
      },
      include: { host: true, participants: true },
    });
    return match;
  },

  async update(userId: string, id: string, input: Partial<CreateMatchInput>) {
    const match = await db.match.findUnique({ where: { id } });
    if (!match || match.hostId !== userId) throw new Error("Not allowed");
    return db.match.update({ where: { id }, data: input });
  },

  async cancel(userId: string, id: string) {
    const match = await db.match.findUnique({ where: { id } });
    if (!match || match.hostId !== userId) throw new Error("Not allowed");
    return db.match.update({ where: { id }, data: { status: "CANCELLED" } });
  },

  // TODO: wrap in a transaction so capacity / waitlist decisions are race-safe.
  async join(userId: string, matchId: string) {
    const match = await db.match.findUnique({
      where: { id: matchId },
      include: { participants: true },
    });
    if (!match) throw new Error("Match not found");
    const active = match.participants.filter((p) => !p.waitlist);
    const onWaitlist = active.length >= match.capacity;
    const participant = await db.matchParticipant.create({
      data: { matchId, userId, waitlist: onWaitlist },
    });
    if (!onWaitlist && active.length + 1 === match.capacity) {
      await db.match.update({ where: { id: matchId }, data: { status: "CONFIRMED" } });
    }
    await pusherServer.trigger(channels.match(matchId), events.participantJoined, { userId });
    return { participant, waitlist: onWaitlist };
  },

  async leave(userId: string, matchId: string) {
    await db.matchParticipant.delete({ where: { matchId_userId: { matchId, userId } } });
    await pusherServer.trigger(channels.match(matchId), events.participantLeft, { userId });
    return { ok: true };
  },
};
