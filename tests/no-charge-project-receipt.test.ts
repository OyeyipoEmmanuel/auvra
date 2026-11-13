import { describe, expect, it } from "vitest";

import { noChargeProjectProof } from "../src/receipts/no-charge-project";

const quote = {
  id: "quote-1",
  version: 1,
  currency: "USD",
  customerTotalMinor: 18688n,
  supplierCapMinor: 14950n,
  scopeJson: { outcome: "Landing page" },
  assumptionsJson: ["Customer supplies logo"],
  exclusionsJson: [],
  termsJson: {},
  acceptedAt: new Date("2026-11-12T10:00:00.000Z"),
};

describe("no-charge project receipt", () => {
  it("produces a deterministic hash without private scope content on chain", () => {
    const first = noChargeProjectProof("project-1", quote);
    expect(noChargeProjectProof("project-1", quote)).toEqual(first);
    expect(first.referenceHash).toMatch(/^[a-f0-9]{64}$/);
    expect(first.canonicalRecordHash).toMatch(/^[a-f0-9]{64}$/);
    expect(JSON.stringify(first)).not.toContain("Landing page");
    expect(JSON.stringify(first)).not.toContain("Customer supplies logo");
  });

  it("changes the record hash when the accepted quote changes", () => {
    const first = noChargeProjectProof("project-1", quote);
    const changed = noChargeProjectProof("project-1", { ...quote, customerTotalMinor: 18689n });
    expect(changed.referenceHash).toBe(first.referenceHash);
    expect(changed.canonicalRecordHash).not.toBe(first.canonicalRecordHash);
  });
});
