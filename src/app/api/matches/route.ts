import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { matchService } from "@/server/services/matchService";
import { createMatchSchema, listMatchesQuerySchema } from "@/lib/validators/match";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const query = listMatchesQuerySchema.parse(Object.fromEntries(searchParams));
  const matches = await matchService.list(query);
  return NextResponse.json({ matches });
}

export async function POST(req: Request) {
  const user = await requireAuth();
  const body = createMatchSchema.parse(await req.json());
  const match = await matchService.create(user.id, body);
  return NextResponse.json({ match }, { status: 201 });
}
