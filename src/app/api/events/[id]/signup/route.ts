import { NextResponse } from "next/server";
import { requireAuth, UnauthorizedError } from "@/lib/auth";
import {
  AlreadySignedUpError,
  EventClosedError,
  eventService,
} from "@/server/services/eventService";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAuth();
    const { id } = await params;
    const signup = await eventService.requestSignup(user.id, id);
    return NextResponse.json({ signup }, { status: 201 });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: err.message }, { status: 401 });
    }
    if (err instanceof EventClosedError || err instanceof AlreadySignedUpError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("[events.signup] failed", err);
    return NextResponse.json({ error: "Could not sign up" }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAuth();
    const { id } = await params;
    await eventService.withdraw(user.id, id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: err.message }, { status: 401 });
    }
    console.error("[events.withdraw] failed", err);
    return NextResponse.json({ error: "Could not withdraw" }, { status: 500 });
  }
}
