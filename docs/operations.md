# Operations baseline

## Local startup

1. Copy `.env.example` to `.env` and fill Auth.js credentials.
2. For the web app, `pnpm dev:web` starts the local PostgreSQL container automatically, launching Docker Desktop on Windows if needed. Auvra PostgreSQL publishes on host port `55432` to avoid installed PostgreSQL 17/18 services. Start Redis and S3Mock separately when working on features that use them: `docker compose up -d redis s3mock`.
3. Run `pnpm prisma:generate` and `pnpm prisma:migrate:dev`.
4. Run `pnpm dev:web`.

## M1–M5 local verification

Run `pnpm test`, `pnpm check:web`, `pnpm --filter @auvra/worker check`, and `pnpm format:check`. With the local web server, PostgreSQL, and S3Mock running, `pnpm verify:local` creates two temporary users and verifies session restoration, owner isolation, draft editing, private upload, submission, download, and sign-out revocation. It removes its temporary records and object afterward. This does not exercise the interactive Google OAuth redirect or a live marketplace purchase.

## Safety controls

- Default runtime mode is `DEMO_SANDBOX`.
- Marketplace writes and live procurement automation are disabled by default. The paid path requires live mode, verified live Bachs payment, buyer balance, customer sharing consent, an active spend policy, per-job caps, and explicit write flags. Policy exceptions require an exact operator approval.
- Missing or contradictory live configuration fails startup validation.
- Operator remediation will be implemented as audited commands, never direct arbitrary state edits.

## Recovery principles

- PostgreSQL state wins over queue state.
- Reconcile an ambiguous provider or chain outcome before retrying.
- Replayed events must produce one domain effect.
- Pause prevents new spend but does not stop monitoring or reconciliation.

## M6 buyer balance probe and M7 local worker

The default worker spend gate now uses the authenticated Agent Market MCP `marketplace__whoami` response, not the unverified REST bearer path. It binds the returned `account_id` to `NEAR_MARKET_BUYER_ACCOUNT_ID`, parses exact USD or USDC available balance, excludes credits, and fails closed on missing/expired credentials, identity mismatch, malformed output, or timeout. A browser balance, Bachs receipt, or testnet token balance is not a substitute. The older REST probe remains only as a testable experimental adapter; it is not the default funding proof.

On 2026-11-07, the local worker's persistent OAuth enrollment succeeded against the live Agent Market MCP for buyer account `4126bbe3-51db-42cd-bb66-c63522d5bc99`. Two fresh CLI processes independently loaded the encrypted connection from PostgreSQL and returned `verified: true` for USD and USDC. Both available balances were zero; this confirms identity and credential persistence, not funding or permission to hire. An earlier ephemeral `marketplace__whoami` read also showed credits USD 0.00. The separate REST `walletProbe` returned `verified: false`; do not use it as funding proof. To run the unattended worker elsewhere, provide the same expected account ID and 32-byte base64url `NEAR_MARKET_CREDENTIAL_KEY` to its secret environment and apply migrations. Never put the key in chat or Git. The key must remain the same across worker restarts; losing or rotating it requires re-enrollment. Run `pnpm --filter @auvra/worker market:balance` and again with `USDC` in that environment. A zero balance blocks a nonzero reservation.

M7 has nine BullMQ queue consumers, a PostgreSQL outbox publisher with leases/`SKIP LOCKED`, stable job IDs, backoff, dead-letter state, and a read-only `pnpm --filter @auvra/worker health` command. Known web-committed events are observed idempotently. Project creation and task-completion events schedule only dependency-ready tasks with project locking, task versions, and atomic idempotency records. Unsupported events fail visibly. The external-action journal records exact intent before a provider call; an ambiguous paid hire is retried only with the same marketplace request ID and arguments within ten minutes, then requires review. `AUVRA_M7_ENABLED` defaults to `false`. On 2026-11-07 the local backlog was audited and processed by the guarded worker: 30 outbox rows published, zero pending/failed, and no duplicate publication after restart. This is not a deployed-worker verification. For local development, start PostgreSQL and Redis, apply migrations, then enable and run `pnpm --filter @auvra/worker start`. Do not treat a queued task as a hired supplier.

## M8-M10 local implementation and review

The worker commands `market:preflight`, `market:plan`, `market:prepare`, `market:hire`, `market:observe`, and `market:result` form a guarded marketplace slice. `market:hire` invokes the paid `/mcp/pro` tool only when the separate direct-hire flag and every live gate pass. `market:prepare` retains the no-charge draft path. `market:tools --pro --metadata` is a read-only check for the paid tool. `market:result` privately stores a fetched result and deterministic QA record. Follow the [live hiring runbook](live-hiring.md) before using any paid command.

For new live-funded projects, `AUVRA_M8_AUTOMATION_ENABLED=true` connects the outbox worker. A ready task creates an idempotent proposal. With `AUVRA_M8_DIRECT_HIRE_ENABLED=true`, in-policy work can invoke paid `marketplace__create_job`; the first live hire and jobs above the policy auto-approval ceiling await exact operator approval. A confirmed provider job ID moves the task to running; a submitted result is ingested privately for QA. With direct hiring disabled and draft preparation enabled, operator approval creates a no-charge provider draft for separate marketplace approval. All flags default to off. Previously observed outbox events are not replayed when automation is enabled. Sandbox-funded projects remain ineligible.

An admin can create the initial service allowlist and spend caps at `/ops/policies`; the policy is created paused and requires a separate resume action. See the [live hiring runbook](live-hiring.md) for the exact setup and review sequence.

`/ops` shows outbox, proposed jobs, and external-action exceptions. `/ops/jobs/[id]` shows the exact proposal, approval, provider draft, and review deadline. `/ops/projects/[id]` shows QA and settlement blockers; `/ops/artifacts/[id]` is an operator-only human QA checklist. `/ops/treasury` and `/ops/policies` show evidence and pause controls. Customers can inspect `/app/projects/[id]` and owner-scoped `/app/billing` records. QA passing does not accept the marketplace result, release funds, or close the customer project. The marketplace auto-accept window requires human monitoring until an alerting and acceptance workflow is verified.

Before any live pilot, check the encrypted buyer connection and wallet, verify `/mcp/pro` read-only tool availability, verify Bachs live collection/refund behavior, and provision an operator role and active procurement policy. The local PostgreSQL service was unavailable during this implementation, so the paid endpoint has not yet been verified with the stored buyer credential. Do not send keys in chat or Git. No production deployment, paid hire, supplier acceptance, live settlement, or on-chain receipt has been performed.

## Current external blockers

- Local encrypted buyer enrollment and separate-process live MCP balance reads succeeded, but the worker is not deployed with its secret environment and the buyer wallets have zero available balance. The REST probe has not been validated live and is not the default.
- Accepted quotes can be explicitly funded without charge only in `DEMO_SANDBOX` with marketplace writes disabled. This records `DEMO_USDC` or `DEMO_USD` ledger entries matching the quote currency and creates planned project tasks; it does not verify or transfer NEAR testnet tokens, USDC, or real customer funds. The project walkthrough is browser-local and illustrative; it does not mutate real task, supplier job, QA, or artifact state. See [judge walkthrough](judge-walkthrough.md).
- No exercised live supplier job lifecycle.
- Bachs is selected for USD customer checkout, but live merchant settlement and refund behavior remain unverified.
- No deployed receipt contract.
- Local private-file tests use the maintained [Adobe S3Mock](https://github.com/adobe/S3Mock) image because the former MinIO image is no longer anonymously retrievable. S3Mock is a development substitute, not production storage.
- Uploaded files enter `VALIDATED` after size, type signature, and SHA-256 checks. This is not a malware scan. A future supplier handoff must require a separate `CLEAN` scan result before sharing file contents externally.
