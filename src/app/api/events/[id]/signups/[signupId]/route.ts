import { NextResponse } from "next/server";
import { z } from "zod";
import { Role, SignupStatus } from "@prisma/client";
import {
  ForbiddenError,
  UnauthorizedError,
  requireRole,
} from "@/lib/auth";
import {
  EventCapacityError,
  SignupNotFoundError,
  eventService,
} from "@/server/services/eventService";

const patchSchema = z.object({
  status: z.enum([SignupStatus.CONFIRMED, SignupStatus.DECLINED]),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; signupId: string }> },
) {
  try {
    const admin = await requireRole(Role.ADMIN);
    const { signupId } = await params;
    const body = await req.json();
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", issues: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const signup =
      parsed.data.status === SignupStatus.CONFIRMED
        ? await eventService.confirmSignup(admin.id, signupId)
        : await eventService.declineSignup(admin.id, signupId);

    return NextResponse.json({ signup });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: err.message }, { status: 401 });
    }
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    if (err instanceof EventCapacityError || err instanceof SignupNotFoundError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("[events.signups.patch] failed", err);
    return NextResponse.json({ error: "Could not update signup" }, { status: 500 });
  }
}
