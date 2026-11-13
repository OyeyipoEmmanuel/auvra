# Judge walkthrough (no-charge environment)

The judge path is deliberately separate from live procurement. Set
`AUVRA_RUNTIME_MODE=DEMO_SANDBOX` and `MARKETPLACE_WRITES_ENABLED=false` in the
server environment. No live Bachs key or funded NEAR Market buyer wallet is
required. Do not enable marketplace writes for a judge demonstration.

1. Sign in and visit `/app/requests/new` to describe a service.
2. On `/app/requests/[id]`, answer clarification questions if needed, review
   the scope, read current NEAR Agent Market listings, and accept the quote.
3. Choose **Start project**. This records a no-charge `DEMO_USD` or
   `DEMO_USDC` allocation, depending on the quote currency, and creates the
   project task plan. The button shows a plain-language disclosure nearby.
   If a Bachs sandbox checkout is already pending for the quote, first check
   its status; Auvra will not record a second payment.
4. On `/app/projects/[id]`, use the five-step walkthrough to inspect the
   planned work, observed supplier matches, coordination sequence, review
   criteria, and a downloadable illustrative handoff. Its step is stored in
   that browser's local storage. It does **not** update project, task, supplier
   job, QA, or artifact records.

If `BACHS_USD_ENABLED=true` with a sandbox key and matching webhook secret,
USD quotes also offer an optional Bachs sandbox checkout. This is not necessary
for the primary no-card judge path. Bachs sandbox receipts remain isolated in
the demo ledger and cannot authorize a live supplier hire.

The live catalog listing and quoted price are observations, not reservations.
The walkthrough's sample handoff is not a supplier deliverable. The real task
list, agent count, payment record, and artifact area remain accurate to their
recorded state. A real hire requires the separately gated live flow, verified
customer payment, and sufficient buyer-wallet funds.
