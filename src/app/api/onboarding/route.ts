import { NextResponse } from "next/server";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { ensureUserFromClerk, UnauthorizedError } from "@/lib/auth";
import { onboardingSchema } from "@/lib/validators/user";

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Not signed in" }, { status: 401 });
    }

    await ensureUserFromClerk(userId);

    const body = await req.json();
    const parsed = onboardingSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", issues: parsed.error.flatten() },
        { status: 400 },
      );
    }
    const { name, bio, skillLevel, skillRating, preferredFormat } = parsed.data;

    const user = await db.user.update({
      where: { clerkId: userId },
      data: {
        name,
        bio: bio?.trim() ? bio.trim() : null,
        skillLevel,
        skillRating,
        preferredFormat,
        onboardedAt: new Date(),
      },
    });

    // Mirror to Clerk so middleware can read it from sessionClaims without a
    // DB hit. NOTE: for this to surface as `sessionClaims.metadata` (or
    // .publicMetadata) in middleware, the Clerk session token template MUST
    // include publicMetadata — see Dashboard → Sessions → Customize session
    // token. Without that template the user record IS updated but the JWT
    // never carries the claim.
    const client = await clerkClient();
    let updatedClerkUser;
    try {
      updatedClerkUser = await client.users.updateUserMetadata(userId, {
        publicMetadata: { onboarded: true, role: user.role },
      });
    } catch (err) {
      console.error("[onboarding] Clerk updateUserMetadata failed", err);
      return NextResponse.json(
        {
          error:
            "Saved your profile, but could not sync to Clerk. Check CLERK_SECRET_KEY and server logs.",
        },
        { status: 500 },
      );
    }
    console.log("[onboarding] Clerk publicMetadata after update", updatedClerkUser.publicMetadata);

    return NextResponse.json({
      ok: true,
      user,
      clerkPublicMetadata: updatedClerkUser.publicMetadata,
    });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: err.message }, { status: 401 });
    }
    console.error("onboarding failed", err);
    return NextResponse.json({ error: "Onboarding failed" }, { status: 500 });
  }
}
