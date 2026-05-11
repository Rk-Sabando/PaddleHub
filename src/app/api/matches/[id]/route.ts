import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { matchService } from "@/server/services/matchService";
import { updateMatchSchema } from "@/lib/validators/match";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const match = await matchService.getById(params.id);
  if (!match) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ match });
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const user = await requireAuth();
  const body = updateMatchSchema.parse(await req.json());
  const match = await matchService.update(user.id, params.id, body);
  return NextResponse.json({ match });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const user = await requireAuth();
  await matchService.cancel(user.id, params.id);
  return NextResponse.json({ ok: true });
}
