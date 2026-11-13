import { describe, expect, it } from "vitest";

import { parseCreatedMarketJob } from "../apps/worker/src/marketplace/job-contract";

const jobId = "3ad99da0-3a81-4a0f-94c3-f9c9e14b290b";
const assignmentId = "e45282e2-038e-4119-a063-69b2ddb02023";

describe("paid NEAR Market hire response", () => {
  it("accepts an exact escrowed USD price with provider IDs", () => {
    expect(
      parseCreatedMarketJob(
        {
          job_id: jobId,
          assignment_id: assignmentId,
          price: { amount: "15.00", token: "USD" },
          replayed: true,
        },
        "USD",
      ),
    ).toEqual({ jobId, assignmentId, chargedMinor: 1500n, currency: "USD", replayed: true });
  });

  it("rejects a missing assignment, malformed price, or wrong rail", () => {
    expect(
      parseCreatedMarketJob({ job_id: jobId, price: "15.00", token: "USD" }, "USD"),
    ).toBeNull();
    expect(
      parseCreatedMarketJob(
        { job_id: jobId, assignment_id: assignmentId, price: "15.001", token: "USD" },
        "USD",
      ),
    ).toBeNull();
    expect(
      parseCreatedMarketJob(
        { job_id: jobId, assignment_id: assignmentId, price: "15.00", token: "USDC" },
        "USD",
      ),
    ).toBeNull();
  });
});
