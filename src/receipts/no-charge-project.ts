import { sha256Canonical, sha256Text, type CanonicalValue } from "./canonical";

type AcceptedQuote = {
  id: string;
  version: number;
  currency: string;
  customerTotalMinor: bigint;
  supplierCapMinor: bigint;
  scopeJson: unknown;
  assumptionsJson: unknown;
  exclusionsJson: unknown;
  termsJson: unknown;
  acceptedAt: Date;
};

/** A project record proof. The NO_CHARGE marker prevents it from implying payment or settlement. */
export function noChargeProjectProof(projectId: string, quote: AcceptedQuote) {
  const quoteHash = sha256Canonical({
    quoteId: quote.id,
    quoteVersion: quote.version,
    currency: quote.currency,
    customerTotalMinor: quote.customerTotalMinor.toString(),
    supplierCapMinor: quote.supplierCapMinor.toString(),
    scope: canonicalQuoteValue(quote.scopeJson),
    assumptions: canonicalQuoteValue(quote.assumptionsJson),
    exclusions: canonicalQuoteValue(quote.exclusionsJson),
    terms: canonicalQuoteValue(quote.termsJson),
    acceptedAt: quote.acceptedAt.toISOString(),
  });
  return {
    referenceHash: sha256Text(projectId),
    quoteHash,
    canonicalRecordHash: sha256Canonical({
      kind: "PROJECT",
      schemaVersion: 1,
      projectReference: projectId,
      quoteVersion: quote.version,
      quoteHash,
      fundingMode: "NO_CHARGE",
    }),
  };
}

/** Preserve existing integer-only proofs while encoding fractional match scores losslessly. */
function canonicalQuoteValue(value: unknown): CanonicalValue {
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number") {
    if (!Number.isFinite(value) || (Number.isInteger(value) && !Number.isSafeInteger(value))) {
      throw new Error("Quote records require finite, safely represented numbers.");
    }
    return Number.isInteger(value) ? value : { $auvraDecimal: String(value) };
  }
  if (Array.isArray(value)) return value.map(canonicalQuoteValue);
  if (typeof value === "object") {
    // Reserve the encoding key so an input object cannot alias an encoded number.
    if (Object.hasOwn(value, "$auvraDecimal")) throw new Error("Reserved quote encoding key.");
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, canonicalQuoteValue(item)]),
    );
  }
  throw new Error("Quote records require JSON values.");
}
