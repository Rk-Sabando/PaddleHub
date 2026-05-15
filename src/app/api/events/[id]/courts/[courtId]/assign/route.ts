import { NextResponse } from "next/server";
import { Role } from "@prisma/client";
import {
  ForbiddenError,
  UnauthorizedError,
  requireRole,
} from "@/lib/auth";
import { EventClosedError, eventService } from "@/server/services/eventService";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string; courtId: string }> },
) {
  try {
    await requireRole(Role.ADMIN);
    const { id, courtId } = await params;
    const next = await eventService.assignNextMatchToCourt(id, courtId);
    if (!next) {
      return NextResponse.json(
        { ok: true, assigned: false, message: "No queued match or players available." },
        { status: 200 },
      );
    }
    return NextResponse.json({
      ok: true,
      assigned: true,
      matchId: next.id,
      participants: next.participants.map((p) => ({
        userId: p.userId,
        name: p.user.name,
      })),
    });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: err.message }, { status: 401 });
    }
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    if (err instanceof EventClosedError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    const message = err instanceof Error ? err.message : "Assign failed";
    console.error("[events.assignToCourt] failed", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
