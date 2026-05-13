import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, UnauthorizedError } from "@/lib/auth";
import { onboardingSchema } from "@/lib/validators/user";

export async function PATCH(req: Request) {
  try {
    const user = await requireAuth();
    const body = await req.json();
    const parsed = onboardingSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", issues: parsed.error.flatten() },
        { status: 400 },
      );
    }
    const { name, bio, skillLevel, skillRating, preferredFormat } = parsed.data;

    const updated = await db.user.update({
      where: { id: user.id },
      data: {
        name,
        bio: bio?.trim() ? bio.trim() : null,
        skillLevel,
        skillRating,
        preferredFormat,
      },
    });
    return NextResponse.json({ user: updated });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: err.message }, { status: 401 });
    }
    console.error("[profile.update] failed", err);
    return NextResponse.json({ error: "Could not update profile" }, { status: 500 });
  }
}
