export type JournalLine = {
  accountId: string;
  side: "DEBIT" | "CREDIT";
  amountMinor: bigint;
};

export function assertBalancedJournal(lines: readonly JournalLine[]) {
  if (lines.length < 2 || lines.some((line) => line.amountMinor <= BigInt(0)))
    throw new Error("A journal needs at least two positive entries.");
  const debits = lines
    .filter((line) => line.side === "DEBIT")
    .reduce((sum, line) => sum + line.amountMinor, BigInt(0));
  const credits = lines
    .filter((line) => line.side === "CREDIT")
    .reduce((sum, line) => sum + line.amountMinor, BigInt(0));
  if (debits !== credits) throw new Error("Journal entries must balance within one asset.");
}
