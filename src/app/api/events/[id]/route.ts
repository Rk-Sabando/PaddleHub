import { NextResponse } from "next/server";
import { z } from "zod";
import { EventStatus, Role } from "@prisma/client";
import {
  ForbiddenError,
  UnauthorizedError,
  requireRole,
} from "@/lib/auth";
import {
  InvalidStatusTransitionError,
  eventService,
} from "@/server/services/eventService";

const patchSchema = z.object({
  status: z.nativeEnum(EventStatus),
});

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireRole(Role.ADMIN);
    const { id } = await params;
    const body = await req.json();
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", issues: parsed.error.flatten() },
        { status: 400 },
      );
    }
    const event = await eventService.updateStatus(id, parsed.data.status);
    return NextResponse.json({ event });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: err.message }, { status: 401 });
    }
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    if (err instanceof InvalidStatusTransitionError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("[events.patch] failed", err);
    return NextResponse.json({ error: "Could not update event" }, { status: 500 });
  }
}
