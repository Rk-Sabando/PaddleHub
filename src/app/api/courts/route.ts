import { NextResponse } from "next/server";
import { Role } from "@prisma/client";
import {
  ForbiddenError,
  UnauthorizedError,
  requireRole,
} from "@/lib/auth";
import { createCourtSchema } from "@/lib/validators/court";
import {
  CourtNameConflictError,
  courtService,
} from "@/server/services/courtService";

export async function POST(req: Request) {
  try {
    const admin = await requireRole(Role.ADMIN);
    const body = await req.json();
    const parsed = createCourtSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", issues: parsed.error.flatten() },
        { status: 400 },
      );
    }
    const court = await courtService.create(admin.id, parsed.data);
    return NextResponse.json({ court }, { status: 201 });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: err.message }, { status: 401 });
    }
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    if (err instanceof CourtNameConflictError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("[courts.create] failed", err);
    return NextResponse.json({ error: "Could not create court" }, { status: 500 });
  }
}
