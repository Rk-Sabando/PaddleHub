import { NextResponse } from "next/server";
import { z } from "zod";
import { UnauthorizedError, requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";

const subscribeSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1),
  }),
  userAgent: z.string().optional().nullable(),
  origin: z.string().url().optional().nullable(),
});

const unsubscribeSchema = z.object({
  endpoint: z.string().url(),
});

// Upsert by endpoint. Browsers can re-issue the same endpoint for the same
// device, and we don't want duplicates per (user, device).
export async function POST(req: Request) {
  try {
    const user = await requireAuth();
    const parsed = subscribeSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid subscription", issues: parsed.error.flatten() },
        { status: 400 },
      );
    }
    const { endpoint, keys, userAgent, origin } = parsed.data;
    await db.$transaction(async (tx) => {
      await tx.pushSubscription.upsert({
        where: { endpoint },
        create: {
          userId: user.id,
          endpoint,
          p256dh: keys.p256dh,
          auth: keys.auth,
          userAgent: userAgent ?? null,
          origin: origin ?? null,
        },
        update: {
          userId: user.id,
          p256dh: keys.p256dh,
          auth: keys.auth,
          userAgent: userAgent ?? null,
          origin: origin ?? null,
        },
      });
      // Prune subscriptions for this user that came from a different page
      // origin (e.g. an old dev tunnel URL still pushing notifications to a
      // stale service worker). NULL-origin rows are also dropped here — they
      // pre-date this column and can't be safely attributed.
      if (origin) {
        await tx.pushSubscription.deleteMany({
          where: {
            userId: user.id,
            endpoint: { not: endpoint },
            OR: [{ origin: null }, { origin: { not: origin } }],
          },
        });
      }
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: err.message }, { status: 401 });
    }
    console.error("[push.subscribe] failed", err);
    return NextResponse.json({ error: "Subscribe failed" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const user = await requireAuth();
    const parsed = unsubscribeSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid endpoint" }, { status: 400 });
    }
    // Scope delete by userId so a malicious caller can't drop someone else's row.
    await db.pushSubscription.deleteMany({
      where: { endpoint: parsed.data.endpoint, userId: user.id },
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: err.message }, { status: 401 });
    }
    console.error("[push.unsubscribe] failed", err);
    return NextResponse.json({ error: "Unsubscribe failed" }, { status: 500 });
  }
}
