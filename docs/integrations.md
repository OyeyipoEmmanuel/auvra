# Integration evidence

## NEAR Agent Market

Verified read-only behavior:

- public catalog discovery through `/v1/agents` and agent pricing plans;
- OAuth/PKCE authorization against the protected MCP endpoint;
- authenticated identity and tool-catalog reads.

Not yet verified or authorized:

- buyer funding;
- live job creation, acceptance, correction, cancellation, or settlement;
- failure charges and timeout reconciliation.

No production path may infer permission to spend from successful OAuth. A future live hire requires a durable approval, exact capped amount, verified funding, idempotency record, and explicit smoke-test authorization.

## Customer payments

No provider has been selected. Redirect completion must never mark a payment verified. Until signed provider events are implemented, funding remains explicitly `DEMO_SANDBOX`.

## NEAR receipt contract

The planned contract stores public-safe hashes only. Customer identity, briefs, files, messages, invoices, commercial terms, and secrets remain off-chain.
