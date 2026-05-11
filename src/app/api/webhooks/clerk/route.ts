import { NextResponse } from "next/server";
import { Webhook } from "svix";
import { headers } from "next/headers";
import { db } from "@/lib/db";

// Syncs Clerk user lifecycle events into our User table.
// TODO: install `svix` and set CLERK_WEBHOOK_SECRET in env.
export async function POST(req: Request) {
  const secret = process.env.CLERK_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ error: "Missing webhook secret" }, { status: 500 });

  const payload = await req.text();
  const h = await headers();
  const wh = new Webhook(secret);

  let evt: { type: string; data: Record<string, unknown> };
  try {
    evt = wh.verify(payload, {
      "svix-id": h.get("svix-id") ?? "",
      "svix-timestamp": h.get("svix-timestamp") ?? "",
      "svix-signature": h.get("svix-signature") ?? "",
    }) as typeof evt;
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  if (evt.type === "user.created" || evt.type === "user.updated") {
    const u = evt.data as {
      id: string;
      email_addresses: { email_address: string }[];
      first_name?: string;
      last_name?: string;
      image_url?: string;
    };
    const email = u.email_addresses[0]?.email_address ?? "";
    const name = [u.first_name, u.last_name].filter(Boolean).join(" ") || email;
    await db.user.upsert({
      where: { clerkId: u.id },
      update: { email, name, avatarUrl: u.image_url },
      create: { clerkId: u.id, email, name, avatarUrl: u.image_url },
    });
  }

  return NextResponse.json({ ok: true });
}
