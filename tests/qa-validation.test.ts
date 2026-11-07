import { describe, expect, it } from "vitest";

import { validateArtifact } from "../apps/worker/src/qa/validate-artifact";

describe("M9 deterministic artifact validation", () => {
  it("requires a nonempty deliverable and explicit acceptance checks", () => {
    expect(validateArtifact({}, ["Contains the approved report"]).violations).toContain(
      "EMPTY_DELIVERABLE",
    );
    expect(validateArtifact({ text: "Report" }, []).violations).toContain(
      "ACCEPTANCE_CHECKS_MISSING",
    );
  });

  it("checks file integrity without claiming semantic QA passed", () => {
    const bytes = new TextEncoder().encode("report");
    const valid = validateArtifact(
      { bytes, expectedSha256: "845e91831319e89c4d656bdb80c278ac09a7230d61e5dfd2e1b1fbb436ac8917" },
      ["Answers the customer's questions"],
    );
    expect(valid.result).toBe("NEEDS_QUALITATIVE_REVIEW");
    expect(valid.violations).toEqual([]);
    expect(
      validateArtifact({ bytes, expectedSha256: "0".repeat(64) }, ["Check"]).violations,
    ).toContain("CHECKSUM_MISMATCH");
  });

  it("rejects unsafe links and malformed MIME values", () => {
    const result = validateArtifact(
      { externalUrl: "http://example.com/file", mimeType: "not a type" },
      ["Review output"],
    );
    expect(result.violations).toEqual(["UNSAFE_EXTERNAL_URL", "INVALID_MIME_TYPE"]);
  });
});
