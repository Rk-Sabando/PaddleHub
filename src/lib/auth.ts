import { auth, currentUser } from "@clerk/nextjs/server";
import { Role } from "@prisma/client";
import { db } from "./db";

export class UnauthorizedError extends Error {
  status = 401;
}

export class ForbiddenError extends Error {
  status = 403;
}

// Resolves the Clerk-authenticated user to our DB user, creating one if needed.
export async function requireAuth() {
  const { userId } = await auth();
  if (!userId) throw new UnauthorizedError("Not signed in");

  let user = await db.user.findUnique({ where: { clerkId: userId } });
  if (!user) {
    const clerkUser = await currentUser();
    if (!clerkUser) throw new UnauthorizedError("No Clerk user");
    user = await db.user.create({
      data: {
        clerkId: userId,
        email: clerkUser.emailAddresses[0]?.emailAddress ?? "",
        name: [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ") || "Player",
        avatarUrl: clerkUser.imageUrl,
      },
    });
  }
  return user;
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
