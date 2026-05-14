import { NextResponse } from "next/server";
import { z } from "zod";
import { EventStatus, SignupStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { channels, events as pusherEvents } from "@/lib/pusher";
import { pusherServer } from "@/lib/pusher-server";

// Dev utility — bulk-confirm signups for seeded users so we can test the
// admin/player UX without manually requesting + confirming each one.
//
// Auth: Authorization: Bearer <DEV_API_TOKEN>. Set DEV_API_TOKEN in your
// local .env to anything (e.g. a long random string).
//
// Blocked in production via NODE_ENV check so this can't escape into a real
// deploy by accident.

const bodySchema = z
  .object({
    // Pick the first N seeded users that aren't already signed up. Easiest
    // for quick testing.
    count: z.coerce.number().int().min(1).max(100).optional(),
    // Or: explicit user ids.
    userIds: z.array(z.string()).optional(),
    // Or: explicit emails.
    userEmails: z.array(z.string().email()).optional(),
    // Skip the event-capacity check (useful when reseeding past capacity).
    force: z.boolean().optional(),
  })
  .refine((v) => v.count || v.userIds?.length || v.userEmails?.length, {
    message: "Provide one of: count, userIds, or userEmails",
  });

function unauthorized(message = "Unauthorized") {
  return NextResponse.json({ error: message }, { status: 401 });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Disabled in production" }, { status: 404 });
  }

  const token = process.env.DEV_API_TOKEN;
  if (!token) {
    return NextResponse.json(
      { error: "DEV_API_TOKEN not set in environment" },
      { status: 500 },
    );
  }
  const auth = req.headers.get("authorization") ?? "";
  if (auth !== `Bearer ${token}`) return unauthorized();

  const { id: eventId } = await params;
  const body = await req.json().catch(() => ({}));
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const event = await db.event.findUnique({
    where: { id: eventId },
    include: {
      _count: {
        select: { signups: { where: { status: SignupStatus.CONFIRMED } } },
      },
    },
  });
  if (!event) return NextResponse.json({ error: "Event not found" }, { status: 404 });

  // Resolve which users to confirm.
  let userIds: string[] = parsed.data.userIds ?? [];
  if (parsed.data.userEmails?.length) {
    const byEmail = await db.user.findMany({
      where: { email: { in: parsed.data.userEmails } },
      select: { id: true },
    });
    userIds = userIds.concat(byEmail.map((u) => u.id));
  }
  if (parsed.data.count) {
    const alreadyConfirmed = await db.eventSignup.findMany({
      where: { eventId, status: SignupStatus.CONFIRMED },
      select: { userId: true },
    });
    const seeded = await db.user.findMany({
      where: {
        email: { startsWith: "seed-" },
        id: { notIn: alreadyConfirmed.map((s) => s.userId) },
      },
      orderBy: { createdAt: "asc" },
      take: parsed.data.count,
      select: { id: true },
    });
    userIds = userIds.concat(seeded.map((u) => u.id));
  }

  // De-dupe.
  userIds = Array.from(new Set(userIds));
  if (userIds.length === 0) {
    return NextResponse.json({ error: "No users matched" }, { status: 400 });
  }

  if (!parsed.data.force) {
    const remaining = event.capacity - event._count.signups;
    if (userIds.length > remaining) {
      return NextResponse.json(
        {
          error: `Would exceed capacity (${event._count.signups + userIds.length}/${event.capacity}). Pass force:true to override.`,
        },
        { status: 409 },
      );
    }
  }

  // Upsert each signup as CONFIRMED. Done sequentially to stay race-free —
  // this is a dev tool, throughput doesn't matter.
  const confirmed: Array<{ userId: string; signupId: string }> = [];
  const skipped: Array<{ userId: string; reason: string }> = [];
  const now = new Date();
  for (const userId of userIds) {
    try {
      const signup = await db.eventSignup.upsert({
        where: { eventId_userId: { eventId, userId } },
        update: {
          status: SignupStatus.CONFIRMED,
          decidedAt: now,
          decidedById: null,
        },
        create: {
          eventId,
          userId,
          status: SignupStatus.CONFIRMED,
          decidedAt: now,
          decidedById: null,
        },
      });
      confirmed.push({ userId, signupId: signup.id });
    } catch (err) {
      skipped.push({ userId, reason: (err as Error).message });
    }
  }

  // Broadcast — single feed event covers list refresh; per-event events let
  // detail page reflect each new confirmation.
  try {
    await pusherServer.trigger(channels.eventsFeed, pusherEvents.eventUpdated, {
      id: eventId,
    });
    for (const c of confirmed) {
      await pusherServer.trigger(channels.event(eventId), pusherEvents.signupDecided, {
        eventId,
        signupId: c.signupId,
        status: SignupStatus.CONFIRMED,
      });
    }
  } catch (err) {
    console.error("[dev.seed-signups] pusher broadcast failed", err);
  }

  return NextResponse.json({
    ok: true,
    eventId,
    eventStatus: event.status,
    capacity: event.capacity,
    confirmedBefore: event._count.signups,
    confirmedAdded: confirmed.length,
    skipped,
    confirmed,
    note:
      event.status !== EventStatus.OPEN && event.status !== EventStatus.IN_PROGRESS
        ? "Event is no longer accepting signups in the regular flow; this route bypasses that for testing."
        : undefined,
  });
}
