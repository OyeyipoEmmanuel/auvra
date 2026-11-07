import { describe, expect, it } from "vitest";

import { draftRequestSchema, serviceRequestSchema } from "../packages/contracts/src/index.js";

describe("universal request input", () => {
  it("allows incomplete drafts without changing the raw brief", () => {
    const parsed = draftRequestSchema.parse({ rawBrief: "  landing page idea  " });
    expect(parsed.rawBrief).toBe("  landing page idea  ");
  });

  it("rejects whitespace-only briefs, expired deadlines, and nonpositive budgets", () => {
    const base = { rawBrief: "Build a landing page.", consentToExternalAgentProcessing: true };
    expect(serviceRequestSchema.safeParse({ ...base, rawBrief: "              " }).success).toBe(
      false,
    );
    expect(
      serviceRequestSchema.safeParse({ ...base, preferredDeadline: "2020-01-01T00:00:00.000Z" })
        .success,
    ).toBe(false);
    expect(
      serviceRequestSchema.safeParse({ ...base, budgetMinor: "0", budgetCurrency: "USD" }).success,
    ).toBe(false);
  });

  it("keeps the same payload shape for unrelated services and attachments", () => {
    const fileId = "11111111-1111-4111-8111-111111111111";
    const base = { consentToExternalAgentProcessing: true, attachmentIds: [fileId] };
    expect(
      serviceRequestSchema.safeParse({ ...base, rawBrief: "Design a logo for my business." })
        .success,
    ).toBe(true);
    expect(
      serviceRequestSchema.safeParse({ ...base, rawBrief: "Research competitors for my business." })
        .success,
    ).toBe(true);
  });
});
