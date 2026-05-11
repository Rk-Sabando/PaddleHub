import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const isPublicRoute = createRouteMatcher([
  "/",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/api/webhooks/(.*)",
]);

const isAdminRoute = createRouteMatcher(["/admin(.*)"]);
const isPlayerRoute = createRouteMatcher(["/player(.*)"]);

// Role is mirrored from the User table into Clerk's publicMetadata so it's
// available in sessionClaims at the edge without a DB round-trip.
type Role = "ADMIN" | "PLAYER";

function getRole(sessionClaims: Record<string, unknown> | null | undefined): Role | null {
  const metadata = (sessionClaims?.metadata ?? sessionClaims?.publicMetadata) as
    | { role?: Role }
    | undefined;
  return metadata?.role ?? null;
}

export default clerkMiddleware(async (auth, req) => {
  if (isPublicRoute(req)) return;

  const { userId, sessionClaims, redirectToSignIn } = await auth();
  if (!userId) return redirectToSignIn({ returnBackUrl: req.url });

  const role = getRole(sessionClaims as Record<string, unknown> | null);

  if (isAdminRoute(req) && role !== "ADMIN") {
    return NextResponse.redirect(new URL("/player", req.url));
  }

  if (isPlayerRoute(req) && role !== "PLAYER") {
    return NextResponse.redirect(new URL("/admin", req.url));
  }
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
