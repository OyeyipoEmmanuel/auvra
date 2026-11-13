import type { PrismaClient } from "@prisma/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { planBuyerJob } from "../apps/worker/src/marketplace/plan-buyer-job";
import {
  hireBuyerJob,
  prepareBuyerDraft,
} from "../apps/worker/src/marketplace/prepare-buyer-draft";

const previousMode = process.env.AUVRA_RUNTIME_MODE;
const previousBuyer = process.env.NEAR_MARKET_BUYER_ACCOUNT_ID;
const previousWrites = process.env.MARKETPLACE_WRITES_ENABLED;
const previousPrepare = process.env.AUVRA_M8_PREPARE_ENABLED;
const previousDirectHire = process.env.AUVRA_M8_DIRECT_HIRE_ENABLED;

afterEach(() => {
  const restore = (key: string, value: string | undefined) => {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  };
  restore("AUVRA_RUNTIME_MODE", previousMode);
  restore("NEAR_MARKET_BUYER_ACCOUNT_ID", previousBuyer);
  restore("MARKETPLACE_WRITES_ENABLED", previousWrites);
  restore("AUVRA_M8_PREPARE_ENABLED", previousPrepare);
  restore("AUVRA_M8_DIRECT_HIRE_ENABLED", previousDirectHire);
});

describe("real-customer marketplace gates", () => {
  it("will not propose a supplier from a sandbox project", async () => {
    process.env.AUVRA_RUNTIME_MODE = "DEMO_SANDBOX";
    process.env.NEAR_MARKET_BUYER_ACCOUNT_ID = "buyer-1";
    const projectLookup = vi.fn();
    const db = { project: { findUnique: projectLookup } } as unknown as PrismaClient;
    await expect(planBuyerJob(db, "project-1", "requirements")).rejects.toThrow("Live mode");
    expect(projectLookup).not.toHaveBeenCalled();
  });

  it("will not contact the marketplace without a verified live Bachs payment", async () => {
    process.env.AUVRA_RUNTIME_MODE = "LIVE_MARKET";
    process.env.NEAR_MARKET_BUYER_ACCOUNT_ID = "buyer-1";
    const db = {
      project: {
        findUnique: vi.fn().mockResolvedValue({
          state: "PLANNING",
          tasks: [{ status: "READY", budgetCurrency: "USD" }],
          request: {
            quotes: [{ id: "quote-1", currency: "USD", customerTotalMinor: 100n }],
            supplierMatches: [
              {
                serviceObservation: {
                  externalAgentId: "agent-1",
                  expiresAt: new Date(Date.now() + 60_000),
                },
              },
            ],
          },
          payments: [
            {
              provider: "BACHS_SANDBOX",
              quoteId: "quote-1",
              currency: "USD",
              amountMinor: 100n,
              verifiedAt: new Date(),
              state: "ALLOCATED",
            },
          ],
        }),
      },
    } as unknown as PrismaClient;
    await expect(planBuyerJob(db, "project-1", "requirements")).rejects.toThrow(
      "Verified live customer payment",
    );
  });

  it("will not prepare a marketplace draft while writes are disabled", async () => {
    process.env.AUVRA_RUNTIME_MODE = "LIVE_MARKET";
    process.env.NEAR_MARKET_BUYER_ACCOUNT_ID = "buyer-1";
    process.env.MARKETPLACE_WRITES_ENABLED = "false";
    process.env.AUVRA_M8_PREPARE_ENABLED = "true";
    const projectLookup = vi.fn();
    const db = { project: { findUnique: projectLookup } } as unknown as PrismaClient;
    await expect(
      prepareBuyerDraft(db, "project-1", "requirements", "approval-1", true),
    ).rejects.toThrow("Live buyer action");
    expect(projectLookup).not.toHaveBeenCalled();
  });

  it("will not hire when the separate paid hire flag is disabled", async () => {
    process.env.AUVRA_RUNTIME_MODE = "LIVE_MARKET";
    process.env.NEAR_MARKET_BUYER_ACCOUNT_ID = "buyer-1";
    process.env.MARKETPLACE_WRITES_ENABLED = "true";
    process.env.AUVRA_M8_DIRECT_HIRE_ENABLED = "false";
    const projectLookup = vi.fn();
    const db = { project: { findUnique: projectLookup } } as unknown as PrismaClient;
    await expect(hireBuyerJob(db, "project-1", "requirements", undefined, true)).rejects.toThrow(
      "Live buyer action",
    );
    expect(projectLookup).not.toHaveBeenCalled();
  });

  it("will not run draft and paid paths simultaneously", async () => {
    process.env.AUVRA_RUNTIME_MODE = "LIVE_MARKET";
    process.env.NEAR_MARKET_BUYER_ACCOUNT_ID = "buyer-1";
    process.env.MARKETPLACE_WRITES_ENABLED = "true";
    process.env.AUVRA_M8_PREPARE_ENABLED = "true";
    process.env.AUVRA_M8_DIRECT_HIRE_ENABLED = "true";
    const projectLookup = vi.fn();
    const db = { project: { findUnique: projectLookup } } as unknown as PrismaClient;
    await expect(hireBuyerJob(db, "project-1", "requirements", undefined, true)).rejects.toThrow(
      "Live buyer action",
    );
    expect(projectLookup).not.toHaveBeenCalled();
  });
});
