import { createHmac } from "node:crypto";

import { describe, expect, it } from "vitest";

import {
  bachsReturnUrls,
  isBachsCheckoutUrl,
  matchesBachsPayment,
  verifyBachsSignature,
  usdDecimalToMinor,
  usdMinorToDecimal,
} from "../apps/web/lib/bachs";
import { bachsPaymentMode, liveUsdRailEnabled } from "../apps/web/lib/payment-config";
import { evaluateSpend, spendPolicySchema } from "../apps/worker/src/policy/spend-policy";
import { canonicalJson, sha256Canonical } from "../apps/worker/src/receipts/canonical";

const policy = spendPolicySchema.parse({
  schemaVersion: 1,
  paused: false,
  allowedCurrencies: ["USDC"],
  allowedServices: ["service-1"],
  perJobCapMinor: "100",
  projectCapMinor: "150",
  dailyCapMinor: "200",
  autoApprovalCeilingMinor: "50",
  contributionFloorMinor: "20",
  firstLiveHireRequiresApproval: true,
});

const context = {
  amountMinor: 60n,
  currency: "USDC",
  serviceId: "service-1",
  projectCommittedMinor: 0n,
  dailyCommittedMinor: 0n,
  customerPaidMinor: 200n,
  supplierCapMinor: 150n,
  firstLiveHire: true,
  approvalValid: true,
  fundingVerified: true,
  marketplaceFundingVerified: true,
  paymentProvider: "BACHS",
  paymentAsset: "USDC",
};

describe("M6 payment and spend gates", () => {
  it("opens the USD rail only with explicit live mode and live provider configuration", () => {
    const configured = {
      AUVRA_RUNTIME_MODE: "LIVE_MARKET",
      BACHS_USD_ENABLED: "true",
      BACHS_API_KEY: "sk_live_fixture",
      BACHS_WEBHOOK_SECRET: "whsec_fixture",
    } as NodeJS.ProcessEnv;
    expect(liveUsdRailEnabled(configured)).toBe(true);
    expect(liveUsdRailEnabled({ ...configured, AUVRA_RUNTIME_MODE: "DEMO_SANDBOX" })).toBe(false);
    expect(liveUsdRailEnabled({ ...configured, BACHS_USD_ENABLED: "false" })).toBe(false);
    expect(liveUsdRailEnabled({ ...configured, BACHS_API_KEY: "sk_sandbox_fixture" })).toBe(false);
    expect(
      bachsPaymentMode({
        ...configured,
        AUVRA_RUNTIME_MODE: "DEMO_SANDBOX",
        BACHS_API_KEY: "sk_sandbox_fixture",
      }),
    ).toBe("SANDBOX");
  });

  it("rejects forged and stale webhook signatures", () => {
    const secret = "whsec_test_secret";
    const body = '{"type":"collection.succeeded"}';
    const signature = createHmac("sha256", secret).update(`1000.${body}`).digest("hex");
    const header = `t=1000,v1=${signature}`;
    expect(verifyBachsSignature(body, header, secret, 1000)).toBe(true);
    expect(
      verifyBachsSignature(body, `t=1000,v1=${"0".repeat(64)},v1=${signature}`, secret, 1000),
    ).toBe(true);
    expect(verifyBachsSignature(Buffer.from(body), header, secret, 1000)).toBe(true);
    expect(verifyBachsSignature(`${body} `, header, secret, 1000)).toBe(false);
    expect(verifyBachsSignature(body, header, secret, 1301)).toBe(false);
    expect(verifyBachsSignature(body, `${header},t=1000`, secret, 1000)).toBe(false);
    expect(verifyBachsSignature(body, "t=1000,v1=deadbeef", secret, 1000)).toBe(false);
  });

  it("requires an exact verified reference, checkout, charge, asset, and amount", () => {
    const payment = {
      reference: "ref-1",
      payment_id: "ch_1",
      checkout_id: "chk_1",
      status: "succeeded",
      amount: "10.00",
      amount_paid: "10.00",
      currency: "USD",
    };
    const expected = {
      reference: "ref-1",
      checkoutId: "chk_1",
      chargeId: "ch_1",
      amountMinor: 1000n,
    };
    expect(matchesBachsPayment(payment, expected)).toBe(true);
    expect(matchesBachsPayment({ ...payment, currency: "NGN" }, expected)).toBe(false);
    expect(matchesBachsPayment({ ...payment, amount: "9.99" }, expected)).toBe(false);
    expect(matchesBachsPayment({ ...payment, amount_paid: "9.99" }, expected)).toBe(false);
    expect(matchesBachsPayment({ ...payment, checkout_id: "chk_other" }, expected)).toBe(false);
    expect(matchesBachsPayment({ ...payment, status: "refunded" }, expected)).toBe(false);
    expect(usdMinorToDecimal(1001n)).toBe("10.01");
    expect(usdDecimalToMinor("10.01")).toBe(1001n);
    expect(isBachsCheckoutUrl("https://checkout.bachs.io/c/fixture", "SANDBOX")).toBe(true);
    expect(isBachsCheckoutUrl("https://sandbox-checkout.bachs.io/c/fixture", "SANDBOX")).toBe(true);
    expect(isBachsCheckoutUrl("https://sandbox-checkout.bachs.io/c/fixture", "LIVE")).toBe(false);
    expect(isBachsCheckoutUrl("https://checkout.bachs.io.evil.example/c/fixture", "LIVE")).toBe(
      false,
    );
  });

  it("uses only a public HTTPS Auvra origin for Bachs checkout returns", () => {
    expect(bachsReturnUrls("quote-1", "request-1", "https://auvra.example.com")).toEqual({
      success_url: "https://auvra.example.com/app/checkout/return/quote-1",
      cancel_url: "https://auvra.example.com/app/requests/request-1",
    });
    expect(bachsReturnUrls("quote-1", "request-1", "http://localhost:3000")).toBeNull();
    expect(bachsReturnUrls("quote-1", "request-1", "https://127.0.0.1:3000")).toBeNull();
    expect(
      bachsReturnUrls("quote-1", "request-1", "https://user:pass@auvra.example.com"),
    ).toBeNull();
  });

  it("requires operator approval for first live hire and blocks demo funding", () => {
    expect(evaluateSpend(policy, context)).toEqual([]);
    expect(evaluateSpend(policy, { ...context, approvalValid: false })).toContain(
      "APPROVAL_REQUIRED",
    );
    expect(
      evaluateSpend(policy, {
        ...context,
        paymentProvider: "DEMO_SANDBOX",
        paymentAsset: "DEMO_USDC",
      }),
    ).toContain("CUSTOMER_FUNDING_UNVERIFIED");
    expect(evaluateSpend(policy, { ...context, paymentProvider: "BACHS_SANDBOX" })).toContain(
      "CUSTOMER_FUNDING_UNVERIFIED",
    );
  });

  it("blocks pause, cap breaches, and missing buyer funds", () => {
    expect(evaluateSpend({ ...policy, paused: true }, context)).toContain("PAUSED");
    expect(evaluateSpend(policy, { ...context, projectCommittedMinor: 100n })).toContain(
      "PROJECT_CAP_EXCEEDED",
    );
    expect(evaluateSpend(policy, { ...context, dailyCommittedMinor: 160n })).toContain(
      "DAILY_CAP_EXCEEDED",
    );
    expect(evaluateSpend(policy, { ...context, marketplaceFundingVerified: false })).toContain(
      "MARKETPLACE_FUNDING_UNVERIFIED",
    );
  });
});

describe("M6A canonical receipts", () => {
  it("matches the Rust golden vector and key ordering", () => {
    const record = {
      scopeHash: "a".repeat(64),
      schemaVersion: 1,
      quoteVersion: 1,
      projectReference: "project-demo-1",
      kind: "PROJECT",
    };
    expect(canonicalJson(record)).toBe(
      '{"kind":"PROJECT","projectReference":"project-demo-1","quoteVersion":1,"schemaVersion":1,"scopeHash":"' +
        "a".repeat(64) +
        '"}',
    );
    expect(sha256Canonical(record)).toBe(
      "27c375b605e6dd27dc8bdd8e2db4bf354177f18542beb71917dd0d4254788d44",
    );
    expect(() => canonicalJson({ amount: 0.5 })).toThrow();
  });
});
