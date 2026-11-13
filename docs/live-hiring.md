# Live customer hiring runbook

This is Auvra's real-customer path. Bachs collects the customer's USD payment. Auvra hires from its separate USD NEAR Market buyer wallet. A Bachs receipt does not fund that wallet. Sandbox receipts are never accepted as live payment evidence.

## Preparation

1. Configure a live Bachs merchant key and signed webhook. Verify collection, refund, and dispute handling before accepting real customer payments.
2. Run PostgreSQL, Redis, and the worker. Keep `NEAR_MARKET_BUYER_ACCOUNT_ID` and `NEAR_MARKET_CREDENTIAL_KEY` in the worker's secret environment. The buyer OAuth credential is encrypted in PostgreSQL. Confirm email verification and a sufficient USD wallet balance with `pnpm --filter @auvra/worker market:balance`.
3. Verify the buyer credential can reach the paid endpoint **without spending**: `pnpm --filter @auvra/worker market:tools --pro --metadata` must report `directHireAvailable: true`. If the endpoint asks for authorization, use `pnpm --filter @auvra/worker market:enroll --pro`, approve the browser connection, and repeat the read-only inspection. Neither command creates a job.
4. An admin creates and resumes one `LIVE_PROCUREMENT` policy at `/ops/policies`. Set allowed services and USD-cent caps. Keep `MARKETPLACE_MAX_SPEND_MINOR` as a second per-job ceiling in the worker environment. The first live hire requires an operator's exact approval. Later hires under the policy's auto-approval ceiling can run from the task-ready event.
5. Audit the outbox and worker health, then enable `AUVRA_M7_ENABLED=true`, `AUVRA_M8_AUTOMATION_ENABLED=true`, `MARKETPLACE_WRITES_ENABLED=true`, and `AUVRA_M8_DIRECT_HIRE_ENABLED=true` in the worker. Leave `AUVRA_M8_PREPARE_ENABLED=false` for the direct path. **Do not enable these flags merely to pass tests.**

## Customer-to-supplier flow

1. The customer submits a request with external-agent-processing consent, accepts the USD quote, and pays through live Bachs checkout. A signed payment webhook or authenticated reconciliation creates the funded project.
2. The worker schedules dependency-ready tasks. It checks the selected marketplace agent's current listing and creates one local `PROPOSED` supplier job per task.
3. The worker checks the live payment, accepted quote, customer consent, current agent price, buyer balance, active policy, task budget, and hard cap. An in-policy job can be hired directly through `marketplace__create_job` on `/mcp/pro`. The first hire or a job above the policy's auto-approval ceiling waits for exact operator approval at `/ops/jobs/[id]`.
4. The paid call uses the supplier job UUID as its marketplace `client_request_id`. The exact request is journaled before the call. A timeout retries only with the same ID and arguments for at most ten minutes; past that, operator reconciliation is required. A successful response must contain the actual marketplace job and assignment IDs and the expected charged amount and rail. The worker atomically records the job, committed reservation, audit evidence, and project progress.
5. The worker polls job status, privately ingests a submitted result, and runs deterministic QA. Human QA, provider acceptance and settlement, customer release, and receipts remain separate gates. A result is not automatically accepted or delivered.

## Limits and verification

- `/mcp/pro` can charge on `create_job`; the endpoint and response shape have not yet been verified with this buyer's live connection. The local PostgreSQL service was unavailable during implementation, so the read-only tool check could not complete.
- The documented `create_job` arguments do not expose a maximum-price field. A listing could change between Auvra's fresh price read and the charge. The worker rejects a mismatched response and stops further action, but that cannot undo a provider charge. Verify the provider's price behavior before enabling direct hiring; keep the flag off if a hard server-side maximum is required.
- Marketplace draft mode remains available with `AUVRA_M8_PREPARE_ENABLED=true` and `AUVRA_M8_DIRECT_HIRE_ENABLED=false`. It creates a no-charge draft; the buyer approves and pays on NEAR Market. Do not switch an existing draft to direct hiring mid-job.
- Existing outbox events marked observed do not replay when flags change. Use the guarded `market:plan`, `market:prepare`, and `market:observe` commands or a reviewed catch-up procedure for older live projects. Sandbox projects cannot become live hires by changing flags.
- No paid hire, top-up, or deployment was performed while implementing this path.
