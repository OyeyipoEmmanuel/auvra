# Auvra v2 task plan

The detailed sequencing and exit gates are in `IMPLEMENTATION_PLAN.md`. This checklist follows the corrected PRD v2.0.

## Completed evidence and reusable foundation

- [x] Confirm local Node and pnpm versions.
- [x] Inspect the published marketplace SDK and identify stale live routes.
- [x] Inspect the current public catalog and OAuth/MCP surface.
- [x] Implement public catalog normalization and tests.
- [x] Complete buyer OAuth/PKCE authorization and a read-only identity/tool-catalog check.
- [x] Confirm that no buyer balance or permission to spend exists yet.
- [x] Create the Next.js application, Auvra design system, universal request prototype, and dashboard shell.
- [x] Add local PostgreSQL, Redis, MinIO, Prisma configuration, and an initial schema skeleton.
- [x] Add an initial shared service-request contract.

## M0 — Baseline alignment

- [x] Add the corrected PRD to the repository and mark the old PRD superseded.
- [x] Create architecture, integration, assumption, and operations documentation.
- [x] Add validated environment configuration and explicit runtime modes.
- [ ] Add formatting, linting, CI, and no-secret/no-spend CI guards.
- [x] Pin and document the marketplace surface currently used by the adapter.

## M1 — Domain, identity, and ownership

- [x] Replace the Order-centric schema with Request, Project, SupplierJob, Payment, ledger, policy, approval, audit, and outbox models.
- [x] Implement and test the four explicit state-transition maps.
- [x] Generate, review, and apply the baseline Prisma migration to the isolated local PostgreSQL database on port `55432`.
- [x] Configure Auth.js to persist users, provider accounts, and sessions in PostgreSQL.
- [x] Protect `/app/**` and `/ops/**` with server-side session and role checks; customer queries are ownership-scoped.
- [ ] Add cross-user isolation and sign-out/session tests.

## M2 — Universal intake and files

- [x] Restructure customer routes under `/app/**` and operator routes under `/ops/**`.
- [x] Replace simulated customer metrics with real empty states.
- [ ] Persist drafts and submitted raw briefs without modification.
- [ ] Add optional constraints, budget, deadline, desired outcome, and attachment IDs.
- [ ] Implement private signed upload/download with validation and checksums.
- [x] Emit request, audit, and outbox events atomically.

## M3 — Manager and planning

- [ ] Define strict analysis, clarification, feasibility, plan, DAG, and acceptance schemas.
- [x] Implement bounded category-aware clarification and initial safety decisions.
- [ ] Validate DAG dependencies, task limits, spend caps, and deadlines.
- [ ] Add fixtures for two unrelated service types and one unsupported request.
- [x] Build customer clarification and plan-preview screens.

## M4 — Supplier discovery and matching

- [ ] Move marketplace code into a worker-owned typed adapter.
- [x] Cache normalized genuine service observations with timestamps.
- [x] Implement hard capability/budget/currency filters and explainable scoring.
- [x] Persist candidates and grounded selection reasons.
- [x] Return `NOT_AVAILABLE` when no verified compatible service exists.

## M5 — Quotes

- [x] Implement integer-minor-unit quote calculation and versioning.
- [x] Include scope, exclusions, assumptions, supplier cap, reserve, fees, and estimated contribution.
- [x] Implement quote expiry and immutable acceptance.
- [ ] Build quote review, accept, reject, and revise-scope UI.

## M6 — Funding, ledger, and policy

- [x] Implement explicit customer-approved `DEMO_SANDBOX` funding for accepted quotes; no token transfer or live payment verification.
- [ ] Implement signed, idempotent payment event handling.
- [ ] Extend the balanced demo ledger to verified testnet and live payment assets.
- [ ] Implement versioned spend policies, approvals, atomic reservations, and pause switch.
- [ ] Add concurrency, duplicate event, forged event, and accounting tests.

## M6A — Rust NEAR receipt contract

- [ ] Create `contracts/auvra-receipts` with pinned stable `near-sdk` and `cargo-near` tooling.
- [ ] Define public-safe, versioned project and settlement receipt schemas.
- [ ] Implement owner-managed authorized writers and append-only receipt methods.
- [ ] Emit NEP-297-compatible receipt and writer-management events.
- [ ] Define canonical JSON/SHA-256 hashing shared by Rust and TypeScript.
- [ ] Add Rust unit, `near-workspaces-rs` sandbox, idempotency, authorization, and privacy tests.
- [ ] Add the worker `ReceiptAnchorAdapter` and durable chain-transaction reconciliation state.
- [ ] Deploy and verify the contract on NEAR testnet.
- [ ] Keep escrow, tokens, transfers, payouts, and treasury control outside this contract.

## M7 — Durable orchestration

- [ ] Create the BullMQ worker and queue topology.
- [ ] Implement transactional outbox publishing, leases, retries, and dead letters.
- [ ] Implement dependency-aware task scheduling and idempotency records.
- [ ] Add restart, replay, out-of-order, and timeout reconciliation tests.

## M8 — Real marketplace vertical slice

- [ ] Verify buyer funding and exact live hire/acceptance/settlement semantics.
- [ ] Prepare an exact capped hire for explicit authorization.
- [ ] Execute one authorized real supplier job.
- [ ] Persist and monitor remote IDs, states, messages, and artifacts.
- [ ] Reconcile unknown/time-out states before any retry.
- [ ] Record redacted evidence and update provider mappings.

## M9 — QA and delivery

- [ ] Implement deterministic artifact and requirement validators.
- [ ] Add schema-validated qualitative QA and evidence storage.
- [ ] Implement bounded correction/revision without silent spend increases.
- [ ] Build project timeline and deliverable review/download UI.
- [ ] Separate supplier acceptance, customer acceptance, and project closure.

## M10 — Reconciliation and operations

- [ ] Reconcile customer funding, commitments, escrow, expense, fees, revenue, and realized contribution.
- [ ] Anchor the reconciled settlement receipt and expose its NEAR proof link.
- [ ] Build customer billing and receipts.
- [ ] Build protected operations, run-detail, treasury, policy, and audit screens.
- [ ] Add safe pause/resume, exception approval, and idempotent step replay.

## M11 — Release

- [ ] Add the PRD's required E2E scenarios.
- [ ] Add observability, health checks, deployment configuration, and runbooks.
- [ ] Complete accessibility and responsive QA.
- [ ] Produce a reproducible README and three-minute demo.
- [ ] Pass every release gate or list the exact external blocker without misleading claims.

