import { PrismaClient } from "@prisma/client";

/**
 * Prisma client singleton.
 *
 * Next.js in dev hot-reloads modules, which would otherwise create a new
 * PrismaClient (and a new DB connection pool) on every reload and exhaust
 * Postgres connections. We cache the instance on globalThis so there is exactly
 * one client per process. In production a single instance is created normally.
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
