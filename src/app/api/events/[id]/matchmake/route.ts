import { NextResponse } from "next/server";
import { Role } from "@prisma/client";
import {
  ForbiddenError,
  UnauthorizedError,
  requireRole,
} from "@/lib/auth";
import {
  EventTerminalError,
  MatchmakingAlreadyRunError,
  NoAvailableCourtsError,
  NotEnoughPlayersError,
  eventService,
} from "@/server/services/eventService";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireRole(Role.ADMIN);
    const { id } = await params;
    const result = await eventService.matchmake(id);
    return NextResponse.json({
      ok: true,
      created: result.matches.length,
      matchObjects: result.matchObjects,
      leftover: result.leftover,
      validation: result.validation,
      perMatch: result.perMatch,
      courtsUsed: result.courtsUsed,
    });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: err.message }, { status: 401 });
    }
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    if (
      err instanceof MatchmakingAlreadyRunError ||
      err instanceof NotEnoughPlayersError ||
      err instanceof NoAvailableCourtsError ||
      err instanceof EventTerminalError
    ) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("[events.matchmake] failed", err);
    return NextResponse.json({ error: "Matchmaking failed" }, { status: 500 });
  }
}
