import { NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { requireRole, UnauthorizedError, ForbiddenError } from "@/lib/auth";
import { createEventSchema } from "@/lib/validators/event";
import { eventService } from "@/server/services/eventService";

export async function POST(req: Request) {
  try {
    const admin = await requireRole(Role.ADMIN);
    const body = await req.json();
    const parsed = createEventSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", issues: parsed.error.flatten() },
        { status: 400 },
      );
    }
    const event = await eventService.create(admin.id, parsed.data);
    return NextResponse.json({ event }, { status: 201 });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: err.message }, { status: 401 });
    }
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    console.error("[events.create] failed", err);
    return NextResponse.json({ error: "Could not create event" }, { status: 500 });
  }
}
