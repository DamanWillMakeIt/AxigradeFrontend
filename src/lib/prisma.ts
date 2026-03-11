import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

// Singleton works in both dev and prod — prevents connection pool exhaustion (#7)
export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

// Always assign to global — fixes the prod hot-reload bug (#7)
globalForPrisma.prisma = prisma;
