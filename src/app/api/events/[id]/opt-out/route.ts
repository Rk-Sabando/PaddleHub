import { NextResponse } from "next/server";
import { z } from "zod";
import { UnauthorizedError, requireAuth } from "@/lib/auth";
import {
  InvalidStatusTransitionError,
  SignupNotFoundError,
  eventService,
} from "@/server/services/eventService";

const patchSchema = z.object({
  optedOut: z.boolean(),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireAuth();
    const { id } = await params;
    const parsed = patchSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", issues: parsed.error.flatten() },
        { status: 400 },
      );
    }
    const signup = await eventService.setOptOut(user.id, id, parsed.data.optedOut);
    return NextResponse.json({ signup });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: err.message }, { status: 401 });
    }
    if (
      err instanceof SignupNotFoundError ||
      err instanceof InvalidStatusTransitionError
    ) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("[events.opt-out] failed", err);
    return NextResponse.json({ error: "Could not update opt-out" }, { status: 500 });
  }
}
