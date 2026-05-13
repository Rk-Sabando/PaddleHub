import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const isPublicRoute = createRouteMatcher([
  "/",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/api/webhooks/(.*)",
]);

// Routes a signed-in but not-yet-onboarded user is allowed to hit. Everything
// else funnels them to /onboarding.
const isOnboardingExempt = createRouteMatcher([
  "/onboarding(.*)",
  "/api/onboarding(.*)",
  "/api/webhooks/(.*)",
]);

const isAdminRoute = createRouteMatcher(["/admin(.*)"]);
const isPlayerRoute = createRouteMatcher(["/player(.*)"]);

// Role and onboarded flag are mirrored from the User table into Clerk's
// publicMetadata so they're available in sessionClaims at the edge without a
// DB round-trip.
type Role = "ADMIN" | "PLAYER";
type SessionMetadata = { role?: Role; onboarded?: boolean };

function getMetadata(sessionClaims: Record<string, unknown> | null | undefined): SessionMetadata {
  return (sessionClaims?.metadata ?? sessionClaims?.publicMetadata ?? {}) as SessionMetadata;
}

export default clerkMiddleware(async (auth, req) => {
  if (isPublicRoute(req)) return;

  const { userId, sessionClaims, redirectToSignIn } = await auth();
  if (!userId) return redirectToSignIn({ returnBackUrl: req.url });

  const metadata = getMetadata(sessionClaims as Record<string, unknown> | null);

  console.log('sessionClaims', sessionClaims);
  console.log('metadata', metadata);

  if (!metadata.onboarded && !isOnboardingExempt(req)) {
    return NextResponse.redirect(new URL("/onboarding", req.url));
  }

  if (isAdminRoute(req) && metadata.role !== "ADMIN") {
    return NextResponse.redirect(new URL("/player", req.url));
  }

  if (isPlayerRoute(req) && metadata.role !== "PLAYER") {
    return NextResponse.redirect(new URL("/admin", req.url));
  }
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
