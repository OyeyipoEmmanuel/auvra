import { describe, expect, it } from "vitest";

import {
  parseMarketAssignmentStatus,
  parseMarketDraftStatus,
  parseMarketResultPage,
  parsePreparedMarketDraft,
} from "../apps/worker/src/marketplace/job-contract";

const draftId = "197ecb2b-dd82-4cf9-abce-52f1d705eaf6";
const jobId = "7e61230c-94aa-44d4-adfe-1b7a5b17ce78";

describe("M8 marketplace job contract", () => {
  it("separates a no-charge draft from an approved hire", () => {
    expect(
      parsePreparedMarketDraft(
        {
          draft_id: draftId,
          approval_url: `https://market.near.ai/hiring/drafts/${draftId}`,
          quoted_price: { amount: "15.00", token: "USD" },
        },
        "USD",
      ),
    ).toMatchObject({ draftId, quotedPriceMinor: 1500n });
    expect(parseMarketDraftStatus({ approved: false })).toEqual({
      approved: false,
      jobId: null,
      jobUrl: null,
    });
    expect(
      parseMarketDraftStatus({
        approved: true,
        job_id: jobId,
        job_url: `https://market.near.ai/hiring/jobs/${jobId}`,
      }),
    ).toMatchObject({ approved: true, jobId });
  });

  it("rejects a price/asset mismatch and an untrusted approval URL", () => {
    expect(
      parsePreparedMarketDraft(
        {
          draft_id: draftId,
          approval_url: "https://evil.example/pay",
          quoted_price: "15.00",
          token: "USD",
        },
        "USD",
      ),
    ).toBeNull();
    expect(
      parsePreparedMarketDraft(
        {
          draft_id: draftId,
          approval_url: "https://market.near.ai/approve",
          quoted_price: "15.00",
          token: "USDC",
        },
        "USD",
      ),
    ).toBeNull();
    expect(
      parseMarketDraftStatus({ approved: true, job_id: jobId, job_url: "https://evil.example" }),
    ).toBeNull();
  });

  it("requires assignment state and review deadlines instead of guessing from job status", () => {
    expect(
      parseMarketAssignmentStatus({
        worker_state: "submitted",
        result_available: true,
        auto_accept_at: "2026-11-12T12:00:00Z",
        expected_by: null,
      }),
    ).toMatchObject({ workerState: "submitted", resultAvailable: true });
    expect(parseMarketAssignmentStatus({ status: "completed" })).toBeNull();
    expect(
      parseMarketAssignmentStatus({
        worker_state: "submitted",
        result_available: true,
        auto_accept_at: "not a date",
      }),
    ).toBeNull();
  });

  it("bounds result pages and refuses unsafe external deliverables", () => {
    expect(
      parseMarketResultPage({
        status: "delivered",
        content_chunk: "Report",
        next_offset: null,
        files: [],
      }),
    ).toMatchObject({ status: "delivered", contentChunk: "Report", fileCount: 0 });
    expect(
      parseMarketResultPage({
        status: "external",
        deliverable_url: "https://market.near.ai/files/report",
      }),
    ).toMatchObject({ status: "external" });
    expect(
      parseMarketResultPage({ status: "external", deliverable_url: "http://evil.example/report" }),
    ).toBeNull();
    expect(
      parseMarketResultPage({ status: "delivered", content_chunk: "x", next_offset: -1 }),
    ).toBeNull();
  });
});
