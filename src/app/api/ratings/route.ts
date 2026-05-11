import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { ratingService } from "@/server/services/ratingService";
import { createRatingSchema } from "@/lib/validators/rating";

export async function POST(req: Request) {
  const user = await requireAuth();
  const body = createRatingSchema.parse(await req.json());
  const rating = await ratingService.submit(user.id, body);
  return NextResponse.json({ rating }, { status: 201 });
}
