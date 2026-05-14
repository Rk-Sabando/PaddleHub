import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const isPublicRoute = createRouteMatcher([
  "/",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/api/webhooks/(.*)",
  // Dev-only routes guarded by their own DEV_API_TOKEN bearer auth + a
  // NODE_ENV check; Clerk session isn't relevant.
  "/api/dev/(.*)",
]);

// Routes a signed-in but not-yet-onboarded user is allowed to hit. Everything
// else funnels them to /onboarding.
const isOnboardingExempt = createRouteMatcher([
  "/onboarding(.*)",
  "/api/onboarding(.*)",
  "/api/webhooks/(.*)",
]);

// Legacy URLs from before the IA flattened to shared routes. Map them to the
// new /dashboard so existing bookmarks / saved links don't 404.
const isLegacyRoleRoute = createRouteMatcher(["/admin(.*)", "/player(.*)"]);

// Onboarded flag is mirrored from the User table into Clerk's publicMetadata
// so it's available in sessionClaims at the edge without a DB round-trip.
// Role-based access is enforced at the page level via requireRole().
type SessionMetadata = { onboarded?: boolean };

function getMetadata(sessionClaims: Record<string, unknown> | null | undefined): SessionMetadata {
  return (sessionClaims?.metadata ?? sessionClaims?.publicMetadata ?? {}) as SessionMetadata;
}

export default clerkMiddleware(async (auth, req) => {
  if (isPublicRoute(req)) return;

  const { userId, redirectToSignIn, sessionClaims } = await auth();
  if (!userId) return redirectToSignIn({ returnBackUrl: req.url });

  if (isLegacyRoleRoute(req)) {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  const metadata = getMetadata(sessionClaims as Record<string, unknown> | null);
  if (!metadata.onboarded && !isOnboardingExempt(req)) {
    return NextResponse.redirect(new URL("/onboarding", req.url));
  }
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
