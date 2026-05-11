import { PrismaClient } from "@prisma/client";

// Reuse Prisma in dev to avoid exhausting connections on hot reload.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const db = globalForPrisma.prisma ?? new PrismaClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
