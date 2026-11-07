import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

import type { PrismaClient } from "@prisma/client";
import type {
  OAuthDiscoveryState,
  StoredOAuthClientInformation,
  StoredOAuthTokens,
} from "@modelcontextprotocol/client";

const CONNECTION_ID = "primary";

export type BuyerOAuthSnapshot = {
  clientInfo?: StoredOAuthClientInformation | undefined;
  tokens?: StoredOAuthTokens | undefined;
  discovery?: OAuthDiscoveryState | undefined;
  verifier?: string | undefined;
};

export type BuyerOAuthState = {
  accountId: string | null;
  snapshot: BuyerOAuthSnapshot;
  version: number;
};

/** Require an independent 256-bit key; never fall back to a public app setting. */
export function buyerCredentialKey(encoded = process.env.NEAR_MARKET_CREDENTIAL_KEY): Buffer {
  if (!encoded || !/^[A-Za-z0-9_-]{43}=?$/.test(encoded)) {
    throw new Error("NEAR_MARKET_CREDENTIAL_KEY must be a base64url-encoded 32-byte key.");
  }
  const key = Buffer.from(encoded, "base64url");
  if (key.length !== 32) throw new Error("Invalid buyer credential key length.");
  return key;
}

export function encryptBuyerState(snapshot: BuyerOAuthSnapshot, key: Buffer): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(Buffer.from("auvra:near-market-buyer:v1"));
  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify(snapshot), "utf8"),
    cipher.final(),
  ]);
  return [
    "v1",
    iv.toString("base64url"),
    cipher.getAuthTag().toString("base64url"),
    ciphertext.toString("base64url"),
  ].join(".");
}

export function decryptBuyerState(value: string, key: Buffer): BuyerOAuthSnapshot {
  const parts = value.split(".");
  if (parts.length !== 4 || parts[0] !== "v1")
    throw new Error("Unsupported buyer credential format.");
  const iv = Buffer.from(parts[1]!, "base64url");
  const tag = Buffer.from(parts[2]!, "base64url");
  if (iv.length !== 12 || tag.length !== 16) throw new Error("Invalid buyer credential envelope.");
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAAD(Buffer.from("auvra:near-market-buyer:v1"));
  decipher.setAuthTag(tag);
  const raw = Buffer.concat([
    decipher.update(Buffer.from(parts[3]!, "base64url")),
    decipher.final(),
  ]).toString("utf8");
  const snapshot: unknown = JSON.parse(raw);
  if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) {
    throw new Error("Invalid buyer credential state.");
  }
  return snapshot as BuyerOAuthSnapshot;
}

export async function loadBuyerOAuthState(
  db: PrismaClient,
  key: Buffer,
  connectionId = CONNECTION_ID,
): Promise<BuyerOAuthState> {
  const row = await db.marketplaceBuyerConnection.findUnique({ where: { id: connectionId } });
  return row
    ? {
        accountId: row.accountId,
        snapshot: decryptBuyerState(row.encryptedState, key),
        version: row.version,
      }
    : { accountId: null, snapshot: {}, version: 0 };
}

/** Optimistic versioning prevents a stale worker from overwriting a rotated refresh token. */
export async function saveBuyerOAuthState(
  db: PrismaClient,
  key: Buffer,
  previous: BuyerOAuthState,
  next: Omit<BuyerOAuthState, "version">,
  connectionId = CONNECTION_ID,
): Promise<BuyerOAuthState> {
  const encryptedState = encryptBuyerState(next.snapshot, key);
  if (previous.version === 0) {
    await db.marketplaceBuyerConnection.create({
      data: {
        id: connectionId,
        accountId: next.accountId,
        encryptedState,
        version: 1,
        connectedAt: next.accountId ? new Date() : null,
      },
    });
    return { ...next, version: 1 };
  }
  const updated = await db.marketplaceBuyerConnection.updateMany({
    where: { id: connectionId, version: previous.version },
    data: {
      accountId: next.accountId,
      encryptedState,
      version: { increment: 1 },
      ...(next.accountId && !previous.accountId ? { connectedAt: new Date() } : {}),
    },
  });
  if (updated.count !== 1)
    throw new Error("Buyer credentials changed concurrently; reload required.");
  return { ...next, version: previous.version + 1 };
}

export async function markBuyerVerified(db: PrismaClient, accountId: string): Promise<void> {
  await db.marketplaceBuyerConnection.updateMany({
    where: { id: CONNECTION_ID, accountId },
    data: { lastVerifiedAt: new Date() },
  });
}
