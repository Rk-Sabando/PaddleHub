import { NextResponse } from "next/server";
import { z } from "zod";
import { EventStatus, Role } from "@prisma/client";
import {
  ForbiddenError,
  UnauthorizedError,
  requireRole,
} from "@/lib/auth";
import {
  EventCapacityError,
  EventNotEditableError,
  EventNotFoundError,
  InvalidStatusTransitionError,
  eventService,
} from "@/server/services/eventService";
import { updateEventSchema } from "@/lib/validators/event";

const statusSchema = z.object({
  status: z.nativeEnum(EventStatus),
});

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireRole(Role.ADMIN);
    const { id } = await params;
    const body = await req.json();

    // Status transitions and field edits share the same endpoint but are
    // distinct operations. Discriminate on whether `status` is the only key.
    if (
      body &&
      typeof body === "object" &&
      "status" in body &&
      Object.keys(body).length === 1
    ) {
      const parsed = statusSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          { error: "Invalid input", issues: parsed.error.flatten() },
          { status: 400 },
        );
      }
      const event = await eventService.updateStatus(id, parsed.data.status);
      return NextResponse.json({ event });
    }

    const parsed = updateEventSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", issues: parsed.error.flatten() },
        { status: 400 },
      );
    }
    const event = await eventService.update(id, parsed.data);
    return NextResponse.json({ event });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: err.message }, { status: 401 });
    }
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    if (
      err instanceof InvalidStatusTransitionError ||
      err instanceof EventNotEditableError ||
      err instanceof EventCapacityError
    ) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    if (err instanceof EventNotFoundError) {
      return NextResponse.json({ error: err.message }, { status: 404 });
    }
    console.error("[events.patch] failed", err);
    return NextResponse.json({ error: "Could not update event" }, { status: 500 });
  }
}
