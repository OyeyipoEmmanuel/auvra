import { config } from "dotenv";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

import { configuredBuyerFundingProbe } from "./buyer-funding.js";

if (!process.env.DATABASE_URL) {
  config({ path: "../../.env.local", quiet: true });
}

const asset = process.argv[2] === "USDC" ? "USDC" : "USD";
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required.");
const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});
const proof = await configuredBuyerFundingProbe(db, asset)().finally(() => db.$disconnect());
if (!proof) {
  console.error(
    "Buyer wallet could not be verified. Check encrypted OAuth enrollment and account ID.",
  );
  process.exitCode = 1;
} else {
  console.log(
    JSON.stringify({
      verified: true,
      accountId: process.env.NEAR_MARKET_BUYER_ACCOUNT_ID,
      asset: proof.asset,
      availableMinor: proof.availableMinor.toString(),
      observedAt: proof.observedAt.toISOString(),
    }),
  );
}
