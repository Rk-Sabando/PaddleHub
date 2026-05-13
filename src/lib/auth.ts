import { auth, currentUser } from "@clerk/nextjs/server";
import type { User as ClerkUser } from "@clerk/nextjs/server";
import { Role } from "@prisma/client";
import { db } from "./db";

export class UnauthorizedError extends Error {
  status = 401;
}

export class ForbiddenError extends Error {
  status = 403;
}

function primaryEmail(clerkUser: ClerkUser): string {
  const primary = clerkUser.emailAddresses.find(
    (e) => e.id === clerkUser.primaryEmailAddressId,
  );
  return primary?.emailAddress ?? clerkUser.emailAddresses[0]?.emailAddress ?? "";
}

function displayName(clerkUser: ClerkUser, fallbackEmail: string): string {
  const joined = [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ").trim();
  if (joined) return joined;
  if (clerkUser.username) return clerkUser.username;
  const local = fallbackEmail.split("@")[0];
  return local || "Player";
}

// Creates a DB row mirroring whatever Clerk knows (email, name, avatar). Safe
// to call repeatedly — returns the existing row if one exists.
export async function ensureUserFromClerk(clerkId: string) {
  const existing = await db.user.findUnique({ where: { clerkId } });
  if (existing) return existing;

  const clerkUser = await currentUser();
  if (!clerkUser) throw new UnauthorizedError("No Clerk user");

  const email = primaryEmail(clerkUser);
  if (!email) {
    throw new UnauthorizedError("Clerk user has no email address");
  }

  return db.user.create({
    data: {
      clerkId,
      email,
      name: displayName(clerkUser, email),
      avatarUrl: clerkUser.imageUrl ?? null,
    },
  });
}

// Resolves the Clerk-authenticated user to our DB user, creating one if needed.
export async function requireAuth() {
  const { userId } = await auth();
  if (!userId) throw new UnauthorizedError("Not signed in");
  return ensureUserFromClerk(userId);
}

export async function requireRole(...allowed: Role[]) {
  const user = await requireAuth();
  if (!allowed.includes(user.role)) {
    throw new ForbiddenError(`Requires role: ${allowed.join(" or ")}`);
  }
  return user;
}

export const requireAdmin = () => requireRole(Role.ADMIN);
export const requirePlayer = () => requireRole(Role.PLAYER);
