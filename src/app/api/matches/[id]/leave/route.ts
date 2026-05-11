import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { matchService } from "@/server/services/matchService";

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const user = await requireAuth();
  const result = await matchService.leave(user.id, params.id);
  return NextResponse.json(result);
}
