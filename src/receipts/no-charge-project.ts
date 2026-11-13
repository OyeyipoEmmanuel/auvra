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
    scope: quote.scopeJson as CanonicalValue,
    assumptions: quote.assumptionsJson as CanonicalValue,
    exclusions: quote.exclusionsJson as CanonicalValue,
    terms: quote.termsJson as CanonicalValue,
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
