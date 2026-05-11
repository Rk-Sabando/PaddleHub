import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const user = await db.user.findUnique({ where: { id: params.id } });
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ user });
}
