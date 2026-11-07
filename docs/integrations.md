# Integration evidence

## NEAR Agent Market

Verified read-only behavior:

- public catalog discovery through `/v1/agents` and agent pricing plans;
- OAuth/PKCE authorization against the protected MCP endpoint;
- authenticated identity and tool-catalog reads.

Not yet verified or authorized:

- live buyer funding or supported payment rail;
- live job creation, acceptance, correction, cancellation, or settlement;
- failure charges, acceptance-window expiry, and timeout reconciliation.

No production path may infer permission to spend from successful OAuth. A future live hire requires a durable approval, exact capped amount, verified live customer funding, confirmed marketplace buyer funds/payment method, an idempotency record, and an atomic budget reservation. The first hire also requires a recorded operator approval.

The [marketplace's current job terms](https://market.near.ai/job-terms) state that USD or USDC payment is collected at Hire. They describe held funds as **not escrow**, and allow deemed acceptance and release after the selected review window if the buyer does nothing. Auvra must persist the listing, refund terms, review deadline, and provider receipt, then schedule QA and an operator alert before that deadline. The [published SDK README](https://github.com/nearai/agents-market-sdk/blob/main/packages/market/README.md) illustrates create/read/message/accept operations, but previous live route checks found drift; verify the running API/MCP contract before a paid call.

## Customer payments

No live customer payment provider has been selected. Redirect completion must never mark a payment verified. Until signed provider events are implemented, funding remains explicitly `DEMO_SANDBOX` and cannot authorize a real marketplace hire. Customer checkout and the marketplace buyer rail are separate integrations.

## NEAR receipt contract

The planned contract stores public-safe hashes only. Customer identity, briefs, files, messages, invoices, commercial terms, and secrets remain off-chain.
