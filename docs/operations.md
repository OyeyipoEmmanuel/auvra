# Operations baseline

## Local startup

1. Copy `.env.example` to `.env` and fill Auth.js credentials.
2. For the web app, `pnpm dev:web` starts the local PostgreSQL container automatically, launching Docker Desktop on Windows if needed. Auvra PostgreSQL publishes on host port `55432` to avoid installed PostgreSQL 17/18 services. Start Redis and MinIO separately when working on features that use them.
3. Run `pnpm prisma:generate` and `pnpm prisma:migrate:dev`.
4. Run `pnpm dev:web`.

## Safety controls

- Default runtime mode is `DEMO_SANDBOX`.
- Marketplace writes are disabled until a separate live-hire implementation and approval gate exist.
- Missing or contradictory live configuration fails startup validation.
- Operator remediation will be implemented as audited commands, never direct arbitrary state edits.

## Recovery principles

- PostgreSQL state wins over queue state.
- Reconcile an ambiguous provider or chain outcome before retrying.
- Replayed events must produce one domain effect.
- Pause prevents new spend but does not stop monitoring or reconciliation.

## Current external blockers

- No verified marketplace buyer balance or funding path.
- Accepted quotes can be explicitly demo funded only in `DEMO_SANDBOX` with marketplace writes disabled. This records `DEMO_USDC` ledger entries and creates planned project tasks; it does not verify or transfer NEAR testnet tokens, USDC, or real customer funds.
- No exercised live supplier job lifecycle.
- No selected customer payment provider.
- No deployed receipt contract.
- The current MinIO community image is no longer anonymously retrievable from Docker Hub, and the official pinned Quay image may require registry access. Do not replace it with an unverified mirror.
