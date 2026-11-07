import { randomBytes } from "node:crypto";

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { afterAll, describe, expect, it } from "vitest";

import {
  loadBuyerOAuthState,
  saveBuyerOAuthState,
} from "../apps/worker/src/marketplace/buyer-oauth-store";

const enabled = process.env.AUVRA_M7_DB_TEST === "1";
const db = enabled
  ? new PrismaClient({
      adapter: new PrismaPg({
        connectionString: "postgresql://auvra:auvra_local@localhost:55432/auvra?schema=public",
      }),
    })
  : null;

afterAll(async () => db?.$disconnect());

describe.skipIf(!enabled)("encrypted marketplace buyer credential persistence", () => {
  it("survives a reload and rejects stale refresh-token writes", async () => {
    if (!db) throw new Error("Local database required.");
    const id = `m7-fixture-${crypto.randomUUID()}`;
    const key = randomBytes(32);
    try {
      const empty = await loadBuyerOAuthState(db, key, id);
      expect(empty.version).toBe(0);
      const first = await saveBuyerOAuthState(
        db,
        key,
        empty,
        {
          accountId: crypto.randomUUID(),
          snapshot: { tokens: { access_token: "secret-fixture", token_type: "Bearer" } },
        },
        id,
      );
      const reloaded = await loadBuyerOAuthState(db, key, id);
      expect(reloaded).toEqual(first);
      const second = await saveBuyerOAuthState(
        db,
        key,
        reloaded,
        {
          accountId: reloaded.accountId,
          snapshot: { tokens: { access_token: "rotated-fixture", token_type: "Bearer" } },
        },
        id,
      );
      expect(second.version).toBe(2);
      await expect(
        saveBuyerOAuthState(
          db,
          key,
          reloaded,
          { accountId: reloaded.accountId, snapshot: reloaded.snapshot },
          id,
        ),
      ).rejects.toThrow(/concurrently/);
      expect((await loadBuyerOAuthState(db, key, id)).snapshot.tokens?.access_token).toBe(
        "rotated-fixture",
      );
    } finally {
      await db.marketplaceBuyerConnection.deleteMany({ where: { id } });
    }
  });
});
