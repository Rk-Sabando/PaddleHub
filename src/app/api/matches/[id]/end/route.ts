import { NextResponse } from "next/server";
import { Role } from "@prisma/client";
import {
  ForbiddenError,
  UnauthorizedError,
  requireAuth,
} from "@/lib/auth";
import { db } from "@/lib/db";
import { eventService } from "@/server/services/eventService";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireAuth();
    const { id: matchId } = await params;

    // Admins can end any match. Players can end a match they're a participant
    // in — useful when the group finishes a game and wants the queue to move
    // forward without flagging down an admin.
    if (user.role !== Role.ADMIN) {
      const participant = await db.matchParticipant.findFirst({
        where: { matchId, userId: user.id },
        select: { id: true },
      });
      if (!participant) {
        throw new ForbiddenError("You can only end matches you're part of");
      }
    }

    const result = await eventService.endAndAdvanceMatch(matchId);
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
