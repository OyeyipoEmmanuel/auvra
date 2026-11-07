import { prisma } from "@/lib/prisma";

/** Atomic, database-backed per-user limit shared by every web instance. */
export async function withinRateLimit(
  action: string,
  userId: string,
  maxAttempts: number,
  windowMs = 15 * 60_000,
) {
  const now = Date.now();
  const window = Math.floor(now / windowMs);
  const bucket = await prisma.apiRateLimit.upsert({
    where: { key: `${action}:${userId}:${window}` },
    create: {
      key: `${action}:${userId}:${window}`,
      count: 1,
      expiresAt: new Date((window + 1) * windowMs),
    },
    update: { count: { increment: 1 } },
    select: { count: true },
  });
  return bucket.count <= maxAttempts;
}
