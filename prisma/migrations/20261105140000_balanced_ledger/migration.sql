ALTER TABLE "LedgerEntry"
  ADD CONSTRAINT "LedgerEntry_positive_amount" CHECK ("amountMinor" > 0);

CREATE OR REPLACE FUNCTION auvra_check_ledger_transaction() RETURNS trigger AS $$
DECLARE
  target_id UUID;
  transaction_asset TEXT;
  entry_count INTEGER;
  debit_total NUMERIC;
  credit_total NUMERIC;
BEGIN
  IF TG_TABLE_NAME = 'LedgerTransaction' THEN
    target_id := NEW.id;
  ELSIF TG_OP = 'DELETE' THEN
    target_id := OLD."transactionId";
  ELSE
    IF TG_OP = 'UPDATE' AND NEW."transactionId" <> OLD."transactionId" THEN
      RAISE EXCEPTION 'Ledger entries cannot move between transactions';
    END IF;
    target_id := NEW."transactionId";
  END IF;

  SELECT asset INTO transaction_asset FROM "LedgerTransaction" WHERE id = target_id;
  IF transaction_asset IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT COUNT(*),
    COALESCE(SUM(CASE WHEN e.side = 'DEBIT' THEN e."amountMinor" ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN e.side = 'CREDIT' THEN e."amountMinor" ELSE 0 END), 0)
  INTO entry_count, debit_total, credit_total
  FROM "LedgerEntry" e
  WHERE e."transactionId" = target_id;

  IF entry_count < 2 OR debit_total <> credit_total OR debit_total <= 0 THEN
    RAISE EXCEPTION 'Unbalanced ledger transaction %', target_id;
  END IF;
  IF EXISTS (
    SELECT 1 FROM "LedgerEntry" e
    JOIN "LedgerAccount" a ON a.id = e."accountId"
    WHERE e."transactionId" = target_id AND a.asset <> transaction_asset
  ) THEN
    RAISE EXCEPTION 'Ledger asset mismatch for transaction %', target_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE CONSTRAINT TRIGGER "LedgerTransaction_balance_check"
  AFTER INSERT OR UPDATE ON "LedgerTransaction"
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION auvra_check_ledger_transaction();

CREATE CONSTRAINT TRIGGER "LedgerEntry_balance_check"
  AFTER INSERT OR UPDATE OR DELETE ON "LedgerEntry"
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION auvra_check_ledger_transaction();
