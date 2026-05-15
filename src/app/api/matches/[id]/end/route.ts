import { NextResponse } from "next/server";
import { Role } from "@prisma/client";
import {
  ForbiddenError,
  UnauthorizedError,
  requireRole,
} from "@/lib/auth";
import { eventService } from "@/server/services/eventService";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireRole(Role.ADMIN);
    const { id } = await params;
    const result = await eventService.endAndAdvanceMatch(id);
    return NextResponse.json({
      ok: true,
      endedMatchId: result.ended.id,
      nextMatchId: result.next?.id ?? null,
      nextParticipants:
        result.next?.participants.map((p) => ({
          userId: p.userId,
          name: p.user.name,
        })) ?? [],
    });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: err.message }, { status: 401 });
    }
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    const message = err instanceof Error ? err.message : "End match failed";
    console.error("[matches.end] failed", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
