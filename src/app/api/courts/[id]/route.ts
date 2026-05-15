import { NextResponse } from "next/server";
import { Role } from "@prisma/client";
import {
  ForbiddenError,
  UnauthorizedError,
  requireRole,
} from "@/lib/auth";
import { updateCourtSchema } from "@/lib/validators/court";
import {
  CourtHasMatchesError,
  CourtNameConflictError,
  CourtNotFoundError,
  courtService,
} from "@/server/services/courtService";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireRole(Role.ADMIN);
    const { id } = await params;
    const body = await req.json();
    const parsed = updateCourtSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", issues: parsed.error.flatten() },
        { status: 400 },
      );
    }
    const court = await courtService.update(id, parsed.data);
    return NextResponse.json({ court });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: err.message }, { status: 401 });
    }
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    if (err instanceof CourtNotFoundError || err instanceof CourtNameConflictError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("[courts.update] failed", err);
    return NextResponse.json({ error: "Could not update court" }, { status: 500 });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireRole(Role.ADMIN);
    const { id } = await params;
    await courtService.delete(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: err.message }, { status: 401 });
    }
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    if (err instanceof CourtNotFoundError || err instanceof CourtHasMatchesError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("[courts.delete] failed", err);
    return NextResponse.json({ error: "Could not delete court" }, { status: 500 });
  }
}
