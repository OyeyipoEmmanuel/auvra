import { exactMinor } from "./live-hire-preflight.js";

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function marketUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname === "market.near.ai" ? url.toString() : null;
  } catch {
    return null;
  }
}

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type PreparedMarketDraft = {
  draftId: string;
  approvalUrl: string;
  quotedPriceMinor: bigint;
  currency: "USD" | "USDC";
};

/** A provider draft is not a hire. A human must approve on the marketplace page. */
export function parsePreparedMarketDraft(
  value: unknown,
  currency: "USD" | "USDC",
): PreparedMarketDraft | null {
  const body = record(value);
  if (!body || typeof body.draft_id !== "string" || !uuid.test(body.draft_id)) return null;
  const approvalUrl = marketUrl(body.approval_url);
  if (!approvalUrl) return null;
  const quoted = record(body.quoted_price);
  const amount = quoted ? quoted.amount : body.quoted_price;
  const token = quoted ? quoted.token : body.token;
  if (token !== currency) return null;
  const quotedPriceMinor = exactMinor(amount, currency === "USD" ? 2 : 6);
  if (quotedPriceMinor === null || quotedPriceMinor <= 0n) return null;
  return { draftId: body.draft_id, approvalUrl, quotedPriceMinor, currency };
}

export type MarketDraftStatus =
  | { approved: false; jobId: null; jobUrl: null }
  | { approved: true; jobId: string; jobUrl: string };

export function parseMarketDraftStatus(value: unknown): MarketDraftStatus | null {
  const body = record(value);
  if (!body) return null;
  if (body.approved === false) return { approved: false, jobId: null, jobUrl: null };
  if (body.approved !== true || typeof body.job_id !== "string" || !uuid.test(body.job_id))
    return null;
  const jobUrl = marketUrl(body.job_url);
  return jobUrl ? { approved: true, jobId: body.job_id, jobUrl } : null;
}

export type MarketAssignmentObservation = {
  workerState: string;
  resultAvailable: boolean;
  autoAcceptAt: Date | null;
  expectedBy: Date | null;
};

/** Never infer delivery or acceptance from the top-level public job status. */
export function parseMarketAssignmentStatus(value: unknown): MarketAssignmentObservation | null {
  const body = record(value);
  if (
    !body ||
    typeof body.worker_state !== "string" ||
    typeof body.result_available !== "boolean"
  ) {
    return null;
  }
  const date = (candidate: unknown) => {
    if (candidate === null || candidate === undefined) return null;
    if (typeof candidate !== "string") return undefined;
    const parsed = new Date(candidate);
    return Number.isNaN(parsed.getTime()) ? undefined : parsed;
  };
  const autoAcceptAt = date(body.auto_accept_at);
  const expectedBy = date(body.expected_by);
  if (autoAcceptAt === undefined || expectedBy === undefined) return null;
  return {
    workerState: body.worker_state,
    resultAvailable: body.result_available,
    autoAcceptAt,
    expectedBy,
  };
}

export type MarketResultPage =
  | { status: "delivered"; contentChunk: string; nextOffset: number | null; fileCount: number }
  | { status: "external"; deliverableUrl: string; nextOffset: null; fileCount: 0 };

/** Unrecognized result shapes require operator review; no artifact is exposed to the customer. */
export function parseMarketResultPage(value: unknown): MarketResultPage | null {
  const body = record(value);
  if (!body) return null;
  if (body.status === "external") {
    if (body.next_offset !== null && body.next_offset !== undefined) return null;
    const deliverableUrl = marketUrl(body.deliverable_url);
    return deliverableUrl
      ? { status: "external", deliverableUrl, nextOffset: null, fileCount: 0 }
      : null;
  }
  if (
    body.status !== "delivered" ||
    typeof body.content_chunk !== "string" ||
    body.content_chunk.length > 1_000_000
  )
    return null;
  const files = body.files;
  if (files !== undefined && !Array.isArray(files)) return null;
  const nextOffset = body.next_offset;
  if (
    nextOffset !== null &&
    nextOffset !== undefined &&
    (!Number.isSafeInteger(nextOffset) || Number(nextOffset) < 0)
  )
    return null;
  return {
    status: "delivered",
    contentChunk: body.content_chunk,
    nextOffset: nextOffset == null ? null : Number(nextOffset),
    fileCount: files?.length ?? 0,
  };
}
