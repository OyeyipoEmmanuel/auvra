import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

const connectionString =
  process.env.DATABASE_URL_POOLED ||
  process.env.DATABASE_URL ||
  (process.env.NODE_ENV === "production"
    ? undefined
    : "postgresql://auvra:auvra_local@localhost:55432/auvra?schema=public");
if (!connectionString) throw new Error("DATABASE_URL is required in production.");
const adapter = new PrismaPg({ connectionString });

export const prisma = globalForPrisma.prisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
