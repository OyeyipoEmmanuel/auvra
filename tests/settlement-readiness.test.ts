import { describe, expect, it } from "vitest";

import { settlementReadiness, type SettlementEvidence } from "../apps/web/lib/settlement-readiness";

const evidence: SettlementEvidence = {
  quote: { id: "quote-1", currency: "USD", customerTotalMinor: 2000n, supplierCapMinor: 1200n },
  payments: [
    {
      quoteId: "quote-1",
      provider: "BACHS",
      state: "RECONCILED",
      currency: "USD",
      amountMinor: 2000n,
      verifiedAt: new Date(),
      reconciledAt: new Date(),
      providerChargeId: "charge-1",
    },
  ],
  jobs: [
    {
      id: "job-1",
      provider: "NEAR_AGENT_MARKET",
      state: "ACCEPTED",
      currency: "USD",
      externalJobId: "market-job-1",
      authorizedMinor: 1000n,
      committedMinor: 1000n,
      settledMinor: 1000n,
    },
  ],
  journals: [
    {
      transactionType: "CUSTOMER_COLLECTION",
      asset: "USD",
      supplierJobId: null,
      externalReference: "charge-1",
      entries: [
        { side: "DEBIT", amountMinor: 2000n },
        { side: "CREDIT", amountMinor: 2000n },
      ],
    },
    {
      transactionType: "SUPPLIER_SETTLEMENT",
      asset: "USD",
      supplierJobId: "job-1",
      externalReference: "market-receipt-1",
      entries: [
        { side: "DEBIT", amountMinor: 1000n },
        { side: "CREDIT", amountMinor: 1000n },
      ],
    },
  ],
};

describe("M10 settlement evidence gate", () => {
  it("reports local evidence readiness without claiming provider confirmation", () => {
    expect(settlementReadiness(evidence)).toEqual({
      readyForProviderConfirmation: true,
      blockers: [],
      settledSupplierMinor: 1000n,
    });
  });

  it("rejects sandbox payment, missing supplier receipt, and unbalanced journal", () => {
    const result = settlementReadiness({
      ...evidence,
      payments: [{ ...evidence.payments[0]!, provider: "BACHS_SANDBOX" }],
      journals: [
        {
          ...evidence.journals[1]!,
          externalReference: null,
          entries: [
            { side: "DEBIT", amountMinor: 1000n },
            { side: "CREDIT", amountMinor: 999n },
          ],
        },
      ],
    });
    expect(result.readyForProviderConfirmation).toBe(false);
    expect(result.blockers).toContain("LIVE_CUSTOMER_PAYMENT_NOT_RECONCILED");
    expect(result.blockers).toContain("UNBALANCED_JOURNAL");
    expect(result.blockers).toContain("SUPPLIER_JOB_job-1_SETTLEMENT_JOURNAL_MISSING");
  });

  it("never treats a quote or empty project as realized work", () => {
    const result = settlementReadiness({ ...evidence, jobs: [], journals: [] });
    expect(result.blockers).toContain("NO_LIVE_SUPPLIER_JOB");
    expect(result.readyForProviderConfirmation).toBe(false);
  });
});
