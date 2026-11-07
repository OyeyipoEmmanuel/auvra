export type SettlementEvidence = {
  quote: {
    id: string;
    currency: string;
    customerTotalMinor: bigint;
    supplierCapMinor: bigint;
  } | null;
  payments: Array<{
    quoteId: string;
    provider: string;
    state: string;
    currency: string;
    amountMinor: bigint;
    verifiedAt: Date | null;
    reconciledAt: Date | null;
    providerChargeId: string | null;
  }>;
  jobs: Array<{
    id: string;
    provider: string;
    state: string;
    currency: string;
    externalJobId: string | null;
    authorizedMinor: bigint;
    committedMinor: bigint;
    settledMinor: bigint;
  }>;
  journals: Array<{
    transactionType: string;
    asset: string;
    supplierJobId: string | null;
    externalReference: string | null;
    entries: Array<{ side: "DEBIT" | "CREDIT"; amountMinor: bigint }>;
  }>;
};

/** Local evidence gate only. A provider read and chain confirmation are still required. */
export function settlementReadiness(input: SettlementEvidence) {
  const blockers: string[] = [];
  const quote = input.quote;
  if (!quote) blockers.push("NO_ACCEPTED_QUOTE");
  const payment =
    quote &&
    input.payments.find(
      (item) =>
        item.quoteId === quote.id &&
        item.provider === "BACHS" &&
        item.currency === quote.currency &&
        item.amountMinor === quote.customerTotalMinor &&
        item.verifiedAt &&
        item.reconciledAt &&
        item.providerChargeId &&
        item.state === "RECONCILED",
    );
  if (!payment) blockers.push("LIVE_CUSTOMER_PAYMENT_NOT_RECONCILED");
  if (input.jobs.length === 0) blockers.push("NO_LIVE_SUPPLIER_JOB");
  let settled = BigInt(0);
  for (const job of input.jobs) {
    if (job.provider !== "NEAR_AGENT_MARKET" || job.state !== "ACCEPTED" || !job.externalJobId) {
      blockers.push(`SUPPLIER_JOB_${job.id}_NOT_ACCEPTED`);
    }
    if (
      !quote ||
      job.currency !== quote.currency ||
      job.settledMinor <= BigInt(0) ||
      job.settledMinor > job.committedMinor ||
      job.committedMinor > job.authorizedMinor
    ) {
      blockers.push(`SUPPLIER_JOB_${job.id}_AMOUNT_UNVERIFIED`);
    }
    settled += job.settledMinor;
    if (
      !input.journals.some(
        (journal) =>
          journal.transactionType === "SUPPLIER_SETTLEMENT" &&
          journal.supplierJobId === job.id &&
          journal.externalReference,
      )
    ) {
      blockers.push(`SUPPLIER_JOB_${job.id}_SETTLEMENT_JOURNAL_MISSING`);
    }
  }
  if (quote && settled > quote.supplierCapMinor) blockers.push("SUPPLIER_CAP_EXCEEDED");
  if (
    payment &&
    !input.journals.some(
      (journal) =>
        journal.transactionType === "CUSTOMER_COLLECTION" && journal.asset === payment.currency,
    )
  ) {
    blockers.push("CUSTOMER_COLLECTION_JOURNAL_MISSING");
  }
  for (const journal of input.journals) {
    const debits = journal.entries
      .filter((entry) => entry.side === "DEBIT")
      .reduce((sum, entry) => sum + entry.amountMinor, BigInt(0));
    const credits = journal.entries
      .filter((entry) => entry.side === "CREDIT")
      .reduce((sum, entry) => sum + entry.amountMinor, BigInt(0));
    if (journal.entries.length === 0 || debits !== credits || debits === BigInt(0)) {
      blockers.push("UNBALANCED_JOURNAL");
      break;
    }
  }
  return {
    readyForProviderConfirmation: blockers.length === 0,
    blockers,
    settledSupplierMinor: settled,
    // This deliberately does not call the difference "profit" or "revenue".
  };
}
