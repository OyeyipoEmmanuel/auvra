# Auvra v2 task plan

The detailed sequencing and exit gates are in `IMPLEMENTATION_PLAN.md`. This checklist follows the corrected PRD v2.0.

## Live-market target — updated 4 November 2026

Auvra cannot hire an agent yet. The current flow ends at a project with planned tasks and `DEMO_USDC` ledger entries. `LIVE_MARKET` is the target for the next complete transaction; sandbox data cannot fund a real hire, and switching a flag cannot bypass the gates below.

- [ ] Restore local Google sign-in and add cross-user/session tests.
- [ ] Choose and integrate one live customer payment provider; verify signed payment events, refunds, and actual collected funds.
- [ ] Verify the current marketplace buyer account, supported payment rail, available funds, job/acceptance API, listing terms, review window, and provider receipts.
- [ ] Build the worker, outbox, spending policy, atomic budget reservation, emergency pause, and first-hire operator approval.
- [ ] Create one newly approved, live-funded, capped supplier job; persist its remote identifiers and reconcile timeouts before retrying.
- [ ] Monitor the job and acceptance deadline, validate the output, handle correction/dispute where supported, and deliver it to the customer.
- [ ] Reconcile customer collection, supplier charge/release, fees, obligations, and realized contribution; retain evidence.
- [ ] Build and verify the Rust project/settlement receipt registry, with the actual chain network labelled in the UI.
- [ ] Complete private files, operator controls, security/E2E checks, monitoring, and deployment runbooks.

## Completed evidence and reusable foundation

- [x] Confirm local Node and pnpm versions.
- [x] Inspect the published marketplace SDK and identify stale live routes.
- [x] Inspect the current public catalog and OAuth/MCP surface.
- [x] Implement public catalog normalization and tests.
- [x] Complete buyer OAuth/PKCE authorization and a read-only identity/tool-catalog check.
- [x] Confirm that no buyer balance or permission to spend exists yet.
- [x] Create the Next.js application, Auvra design system, universal request prototype, and dashboard shell.
- [x] Add local PostgreSQL, Redis, S3-compatible development storage, Prisma configuration, and an initial schema skeleton.
- [x] Add an initial shared service-request contract.

## M0 — Baseline alignment

- [x] Add the corrected PRD to the repository and mark the old PRD superseded.
- [x] Create architecture, integration, assumption, and operations documentation.
- [x] Add validated environment configuration and explicit runtime modes.
- [x] Add formatting and repeatable format-check commands.
- [ ] Add linting, CI, and no-secret/no-spend CI guards.
- [x] Pin and document the marketplace surface currently used by the adapter.

## M1 — Domain, identity, and ownership

- [x] Replace the Order-centric schema with Request, Project, SupplierJob, Payment, ledger, policy, approval, audit, and outbox models.
- [x] Implement and test the four explicit state-transition maps.
- [x] Generate, review, and apply the baseline Prisma migration to the isolated local PostgreSQL database on port `55432`.
- [x] Configure Auth.js to persist users, provider accounts, and sessions in PostgreSQL.
- [x] Protect `/app/**` and `/ops/**` with server-side session and role checks; customer queries are ownership-scoped.
- [x] Add cross-user isolation and sign-out/session tests using temporary local users.

## M2 — Universal intake and files

- [x] Restructure customer routes under `/app/**` and operator routes under `/ops/**`.
- [x] Replace simulated customer metrics with real empty states.
- [x] Persist drafts and submitted raw briefs without modification.
- [x] Add optional constraints, budget, deadline, desired outcome, and attachment IDs.
- [x] Implement private signed upload/download with validation and checksums.
- [x] Add database-backed per-user rate limits for request creation and upload tickets.
- [x] Emit request, audit, and outbox events atomically.

## M3 — Manager and planning

- [x] Define strict analysis, clarification, feasibility, plan, DAG, and acceptance schemas.
- [x] Implement bounded category-aware clarification and initial safety decisions.
- [x] Validate DAG dependencies, task limits, planning spend caps, deadlines, and retry limits. Supplier candidates over the task cap are excluded; paid procurement remains gated in M8.
- [x] Add fixtures for two unrelated service types and one unsupported request.
- [x] Build customer clarification and plan-preview screens.

## M4 — Supplier discovery and matching

- [x] Move read-only marketplace catalog code into a worker-owned typed adapter. Paid operations remain for M8.
- [x] Cache normalized genuine service observations with timestamps.
- [x] Implement hard capability/budget/currency filters and explainable scoring.
- [x] Persist candidates and grounded selection reasons.
- [x] Return `NOT_AVAILABLE` when no verified compatible service exists.

## M5 — Quotes

- [x] Implement integer-minor-unit quote calculation and versioning.
- [x] Include scope, exclusions, assumptions, supplier cap, reserve, fees, and estimated contribution.
- [x] Implement quote expiry and immutable acceptance.
- [x] Build quote review, accept, and reject UI.
- [x] Add revise-scope UI and server-side re-quote handling.
- [x] Display task-level supplier caps that sum to the overall supplier cap.

M1–M5 local verification: unit tests, web/worker/root type checks, formatting, and an authenticated two-user draft/upload/submit/download/sign-out flow. Google OAuth's interactive redirect roundtrip and live marketplace re-quote are still unverified; they require connected external services and should not be described as passing.

## M6 — Funding, ledger, and policy

- [x] Implement explicit customer-approved `DEMO_SANDBOX` funding for accepted quotes; no token transfer or live payment verification.
- [x] Implement a conditional Bachs USD sandbox/live checkout route, signed webhook verification, provider-side charge verification, and idempotent event records. Existing USDC quotes cannot enter this rail.
- [x] Record verified USD customer collection and project reserve as separate balanced journals, enforce balanced per-asset entries in PostgreSQL, and hold disputed/refund-notified projects.
- [x] Implement versioned policy schema, operator approval check, pause switch, and atomic supplier-spend reservation.
- [x] Test forged signatures, amount/asset mismatches, policy denials, and concurrent local PostgreSQL reservations.
- [x] Restrict supplier selection and quoting to USD listings when the Bachs USD rail is configured; show checkout only for an accepted USD quote, and reject live budget asset mismatches.
- [x] Test verified charge allocation, duplicate delivery, balanced ledger postings, and dispute holds against local PostgreSQL with a mocked provider response.
- [ ] Confirm merchant USD collection/settlement eligibility, fees, refund/chargeback semantics, and webhook registration with the live Bachs account.
- [ ] Complete provider-backed fee, expense, refund, and revenue journals and settlement reconciliation. The live USD quote path does not convert USD to USDC or fund the marketplace buyer.
- [x] Enroll the expected buyer account into the encrypted worker OAuth store and verify fresh, separate-process live MCP reads of USD and USDC balances. Both returned `verified: true` on 2026-11-07; both available balances were zero, so nonzero spend remains blocked.
- [x] Implement a fail-closed, read-only Agent Market MCP `whoami` balance adapter and encrypted, versioned PostgreSQL OAuth state. The local durable OAuth connection is enrolled and independently reloadable; this is not a deployed worker credential.
- [ ] Run live provider event replay/refund/dispute tests and the first capped, operator-approved hire only after explicit authorization.

## M6A — Rust NEAR receipt contract

- [x] Create `contracts/auvra-receipts` with pinned `near-sdk` 5.25.0 and a working local Wasm release build.
- [x] Define public-safe, versioned project and settlement receipt schemas.
- [x] Implement owner-managed authorized writers and append-only receipt methods.
- [x] Emit NEP-297-compatible receipt and writer-management events.
- [x] Define canonical JSON/SHA-256 hashing with a shared Rust/TypeScript golden vector.
- [x] Add Rust authorization, replay, conflict, invalid-hash, and canonical-hash unit tests.
- [x] Add a worker receipt adapter, guarded proof preparation, NEAR SDK transport, and ambiguous-submission reconciliation state.
- [x] Add and run `near-workspaces-rs` Linux sandbox deployment, transaction, event, public-read, replay, revocation, and hash-only privacy tests.
- [ ] Verify transaction-status reconciliation and retry handling against an actual chain; connect secure signer/key management.
- [ ] Deploy and verify the contract on NEAR testnet, then on NEAR mainnet before claiming live mainnet receipt proofs.
- [x] Keep escrow, tokens, transfers, payouts, and treasury control outside this contract.

## M7 — Durable orchestration

- [x] Create the guarded BullMQ worker entry point and nine-queue topology. Known committed-state events are observed once; unsupported later-phase events fail visibly without paid actions.
- [x] Implement PostgreSQL outbox claims with leases, at-least-once BullMQ publication, retries, and dead-letter state; local database tests pass.
- [x] Implement dependency-aware task scheduling, optimistic task versions, atomic event idempotency records, and a guarded external-action journal.
- [x] Add local restart, replay, out-of-order, poison-event, and timeout-to-unknown tests. An ambiguous external action cannot automatically retry.
- [x] Audit the local outbox backlog and verify a local worker restart with no duplicate publication (30 published, zero pending/failed on 2026-11-07).
- [ ] Enable and verify M7 in a deployed worker environment with Redis, PostgreSQL, and buyer secrets. No deployment has been authorized.

## M8 — Real marketplace vertical slice

- [x] Add fail-closed profile/balance/cap preflight, exact proposal, operator approval, no-charge draft gate, read-only job observation, and private text-result intake. These are local implementation, not an exercised hire.
- [ ] Verify buyer funding and exact live hire/acceptance-window/settlement semantics against the running marketplace.
- [ ] Prepare an exact capped hire with a listing snapshot, verified live customer payment, and recorded operator approval.
- [ ] Execute one authorized real supplier job.
- [ ] Persist and monitor remote IDs, states, messages, and artifacts.
- [ ] Reconcile unknown/time-out states before any retry.
- [ ] Record redacted evidence and update provider mappings.

## M9 — QA and delivery

- [x] Implement deterministic artifact and requirement validators that never infer semantic quality from file presence.
- [x] Add operator-only checklist-based qualitative QA decisions and evidence storage.
- [ ] Implement bounded correction/revision without silent spend increases.
- [x] Build operator artifact review, customer project timeline, QA status, and gated external-reference links.
- [ ] Add private downloadable marketplace files, supplier acceptance, and customer-review transition. Customer acceptance is separate; closure remains separate.

## M10 — Reconciliation and operations

- [x] Add a fail-closed local settlement-readiness check; it never labels unconfirmed amounts as revenue or profit.
- [ ] Reconcile funding, marketplace holds/releases/refunds, expense, fees, revenue, and realized contribution against live provider evidence.
- [ ] Anchor the reconciled settlement receipt and expose its NEAR proof link.
- [x] Build owner-scoped customer billing records and protected operations, supplier-job, project, treasury, policy, and audit views. A legal invoice/receipt still requires verified live settlement.
- [x] Add versioned emergency pause/resume and exact first-hire operator approval.
- [ ] Add exception resolution, provider reconciliation, deadline alerts, and end-to-end idempotent live-step replay.

## M11 — Release

- [ ] Add the PRD's required E2E scenarios.
- [ ] Add observability, health checks, deployment configuration, and runbooks.
- [ ] Complete accessibility and responsive QA.
- [ ] Produce a reproducible README and three-minute demo.
- [ ] Pass every release gate or list the exact external blocker without misleading claims.
