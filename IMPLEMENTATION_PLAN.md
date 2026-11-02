# Auvra v2 implementation plan

## Source of truth

This plan implements `C:\Users\Emmanuel\Downloads\Auvra_Corrected_PRD_Codex.md` (PRD v2.0, 26 October 2026). The corrected PRD supersedes the earlier competitor-research-only implementation direction.

The product boundary is non-negotiable:

- Auvra is one autonomous service company serving many customers.
- Customers describe an outcome in ordinary language and buy the finished service from Auvra.
- NEAR Agent Market is Auvra's external supplier network, not the customer-facing product.
- Universal intake must not contain category-specific required fields.
- Feasibility, supplier availability, funding, work completion, settlement, and profit must never be fabricated.
- LLMs may recommend and evaluate; deterministic services authorize state changes and financial side effects.

## Delivery objective

Ship one complete, auditable vertical slice in which a customer signs in, submits a natural-language request, answers dynamic clarifications, approves a scoped quote, passes an explicit verified or sandbox funding gate, and receives work from at least one real NEAR Agent Market supplier. Auvra must record supplier cost, QA, customer acceptance, and reconciled project contribution, then anchor cryptographic project and settlement receipts in Auvra's own small NEAR contract. A materially different request must use the same intake and produce a different plan, even if it is declined because no suitable supplier is available.

## Architecture decisions

### Deployable services

Use two deployable services for the hackathon critical path:

1. `apps/web`: Next.js App Router for customer and operator UI, Auth.js, request APIs, ownership checks, signed file operations, and read models.
2. `apps/worker`: Node.js/BullMQ for analysis jobs, orchestration, marketplace calls, monitoring, QA scheduling, reconciliation, and outbox delivery.

Keep planning and QA in TypeScript for the first complete vertical slice. Add the optional Python/FastAPI service only if a specific model or evaluation workflow materially benefits from Python after the typed contracts are stable. This avoids a third deployment boundary during the highest-risk integration work.

Add one deliberately narrow Rust smart contract under `contracts/auvra-receipts`. It is an immutable evidence registry, not an escrow, token, wallet, payment processor, autonomous treasury, or replacement for the internal ledger. Build it with a pinned stable `near-sdk` 5.x release and `cargo-near`; re-check the official repositories before pinning. As of 28 October 2026, the current stable SDK release observed during planning is `near-sdk 5.29.1`.

### Auvra receipt contract boundary

The contract records only public-safe evidence:

- an opaque `project_ref_hash`, accepted scope hash, canonical project-receipt hash, issuer, block timestamp, and schema version;
- an opaque `settlement_ref_hash`, associated project hash, canonical ledger-transaction hash, provider-receipt hash, issuer, block timestamp, and schema version;
- NEP-297-compatible events for receipt creation and authorized-writer changes.

It must never store customer briefs, names, email addresses, private file URLs, supplier messages, secrets, raw invoices, or other personal/confidential data. Amounts and assets remain off-chain by default; their canonical receipt can be independently hashed and verified without publishing commercial terms.

Write methods are restricted to an owner-managed allowlist of dedicated Auvra receipt-writer accounts. Each project receipt and settlement receipt is append-only and uniquely keyed; duplicates are idempotent only when the exact same hash is supplied, while conflicting rewrites fail. Read methods are public. Contract upgrades and writer changes require the owner and emit audit events.

### Persistence and infrastructure

- PostgreSQL is the source of truth for identity, requests, projects, state, approvals, events, and accounting.
- Redis/BullMQ is transient execution infrastructure; queue contents are not business truth.
- MinIO locally and S3-compatible private storage in deployment hold attachments and deliverables.
- Prisma owns the schema and migrations.
- Every state-changing command writes its domain record, immutable audit event, and outbox event atomically.
- Workers assume at-least-once delivery and make every external side effect idempotent and reconcilable.

### Integration boundaries

- `MarketplaceAdapter`: catalog discovery, service detail, buyer identity/balance, create/get/list jobs, messages, artifacts, acceptance, and reconciliation.
- `PaymentAdapter`: checkout/session creation, signed event verification, refunds where supported, and receipt lookup.
- `ObjectStoreAdapter`: signed upload/download, metadata, checksums, and deletion policy.
- `ManagerAdapter`: structured analysis, clarification, DAG planning, and customer-safe summaries.
- `QaAdapter`: deterministic checks plus schema-validated qualitative review.
- `ReceiptAnchorAdapter`: canonical receipt serialization, hashing, contract writes, transaction-status reconciliation, and proof lookup.

The Phase 0 live marketplace finding overrides stale SDK assumptions: the published `@agents-market/market` package routes were not compatible with the observed live service, while OAuth-protected MCP was verified. Keep the adapter provider-neutral and use the currently verified OAuth/MCP surface until a pinned SDK version is proven against the live API. No paid call is permitted merely because OAuth succeeds.

### Runtime modes

- `DEMO_SANDBOX`: mock customer payment and optional mock supplier fixtures; all UI, events, and metrics visibly labelled.
- `LIVE_MARKET`: real marketplace catalog/jobs with explicit spend authorization; customer payment may still be test mode if labelled.
- Production claims require provider receipts. Never mix sandbox balances, supplier jobs, or revenue with live metrics.

## Current repository assessment

### Keep and extend

- Next.js 16 application, Tailwind, shadcn-style primitives, Auvra logo, and near-black/purple design tokens.
- Responsive landing page and universal natural-language intake concept.
- Docker Compose services for PostgreSQL, Redis, and MinIO.
- Prisma 7 setup and the initial event/outbox concepts.
- Phase 0 read-only marketplace discovery, OAuth/PKCE connection, normalization tests, and explicit no-spend posture.

### Refactor before feature expansion

- Move customer routes from `/dashboard` and `/orders/new` to the PRD hierarchy under `/app/**`; add separate `/ops/**` authorization and layout.
- Replace static demo dashboard values with database-backed empty states and explicitly labelled fixtures.
- Persist Auth.js users, provider accounts, and sessions in PostgreSQL; JWT-only sign-in is insufficient for ownership and revocation requirements.
- Replace the current single `Order` aggregate with distinct Request, Project, Quote, CustomerPayment, SupplierJob, and ledger lifecycles.
- Preserve the raw customer brief unchanged; store normalized analysis separately.
- Replace UI-only request assessment with authenticated API submission, drafts, attachments, and durable analysis jobs.
- Expand shared contracts from a single intake schema to all state machines, commands, events, plans, quotes, marketplace records, and error responses.

### Explicitly defer

- Customer-created autonomous companies or tenant treasuries.
- Public agent browsing as a required customer workflow.
- Optional wallet linking until Google identity and ownership isolation are complete.
- Multiple concurrent supplier jobs until one real job is safely created, monitored, accepted, and reconciled.
- Real customer payment until a provider and webhook verification path are proven; use labelled sandbox funding meanwhile.
- Smart-contract custody, escrow, tokens, profit sharing, automated payouts, and treasury governance; the v1 contract only anchors immutable receipts.

## Milestone sequence

Each milestone begins with schemas, invariants, and tests. A milestone is complete only when its exit gate passes; visual screens alone do not count.

### M0 — Baseline alignment and integration evidence

**Build**

- Adopt the corrected PRD as the canonical product specification and archive the earlier product interpretation.
- Create `docs/architecture.md`, `docs/integrations.md`, `docs/assumptions.md`, and `docs/operations.md`.
- Record the observed OAuth/MCP tool catalog, public catalog schema, provider status mappings, and unverified paid-action semantics.
- Add one configuration module that validates mode, database, Redis, object storage, OAuth, marketplace, and payment variables at startup.
- Add formatting, linting, type-checking, unit-test, build, and CI commands.

**Tests**

- Environment validation fails safely for missing or contradictory live-mode configuration.
- Marketplace fixture schemas and normalization remain pinned and passing.
- CI runs checks without secrets and never invokes paid actions.

**Exit gate**

The team can state exactly which marketplace operations are verified, which are mocked, and which require a separately authorized capped smoke test.

### M1 — Domain model, migrations, identity, and ownership

**Build**

- Redesign Prisma models around the PRD's minimum tables: users, OAuth accounts, sessions, wallet links, requests, answers, files, projects, tasks, quotes, supplier services/matches, market jobs, artifacts, QA reviews, customer payments, ledger, policies, approvals, audit events, outbox, notifications, and idempotency records.
- Implement explicit Request, Project, SupplierJob, and Payment transition tables.
- Generate and review the first migration against local PostgreSQL.
- Configure Auth.js PostgreSQL persistence using Google provider account ID, secure cookies, sign-out revocation, and role projection.
- Add server-side ownership and role guards used by every `/app/**`, `/api/**`, and `/ops/**` handler.

**Tests**

- Transition-table unit tests cover all legal and illegal transitions, including terminal states.
- User A cannot read or modify User B's request, file, project, quote, or receipt.
- Customer cannot access operator endpoints; operator actions are audited.
- Sign-in, session restore, and sign-out behavior pass.

**Exit gate**

Authenticated users and roles are durable, the database can be recreated from migrations, and cross-user access tests pass.

### M2 — Universal request intake and private files

**Build**

- Implement `/app`, `/app/requests/new`, request drafts, request detail, and project list empty states.
- Submit one unchanged `rawBrief` plus optional desired outcome, budget ceiling/currency, deadline, constraints, and attachment IDs.
- Add signed upload flow, file name/MIME/size/count validation, checksums, scan status, and private signed downloads.
- Write request submission, audit event, and outbox event in one transaction.
- Add rate limiting and route-specific safe error codes.

**Tests**

- Logo/design and research requests use the same form and payload shape.
- No competitor-specific field is required.
- Raw brief remains byte-for-byte unchanged while normalized interpretation is separate.
- Invalid file metadata and ownership mismatches are rejected.

**Exit gate**

An authenticated customer can save and submit a universal request with optional private attachments, and another customer cannot access it.

### M3 — Manager analysis, clarification, feasibility, and planning

**Build**

- Define strict Zod schemas for analysis, clarification questions, feasibility decisions, plans, task DAGs, acceptance rules, risks, and customer-safe summaries.
- Implement bounded analysis retries and maximum two clarification rounds with no more than three questions per round.
- Add safety/risk classification and explicit `SUPPORTED`, `NEEDS_CLARIFICATION`, `NOT_AVAILABLE`, and `REJECTED` outcomes.
- Validate plan acyclicity, non-empty tasks, dependency references, configurable task limit, per-task spend cap, deadline, and retry limit.
- Implement `/app/requests/[id]/clarify` and plan preview.
- Create deterministic fixtures for at least two unrelated categories and one unsupported request.

**Tests**

- Vague requests produce decision-critical questions only.
- Two unrelated requests generate different questions and plans.
- Cyclic, empty, overlarge, unsafe, and schema-invalid plans are rejected before quote or spend.
- Model timeout produces a recoverable blocked state, never fabricated output.

**Exit gate**

Two distinct request types pass through one manager contract, while unsupported work stops before payment or procurement.

### M4 — Supplier catalog, capability matching, and feasibility truth

**Build**

- Move Phase 0 marketplace code behind the production `MarketplaceAdapter` in `apps/worker`.
- Cache normalized live services with observed timestamps, raw references, trust flags, prices, currencies, and capability metadata.
- Match each planned task to compatible services using deterministic hard filters first, then explainable scoring.
- Store all candidates and grounded selection reasons; never invent ratings or availability.
- Change request feasibility to `NOT_AVAILABLE` when required tasks have no compatible supplier.

**Tests**

- Fixture and live-read-only catalog contract tests.
- Capability mismatch, stale catalog, unsupported currency, over-budget price, and no-provider cases.
- Supplier descriptions are treated as untrusted data and cannot alter policy or system instructions.

**Exit gate**

A plan receives explainable matches derived from genuine observed services, or stops honestly with no payment request.

### M5 — Quote generation and customer approval

**Build**

- Calculate quote versions using integer minor units and explicit currency metadata.
- Include deliverables, exclusions, assumptions, deadline, supplier caps, execution costs, buffer, fees, revision allowance, and estimated contribution.
- Make accepted quote versions immutable and expiring.
- Implement `/app/requests/[id]/quote` with accept, reject, and revise-scope actions.
- Convert an approved and funded request into a Project only through a guarded command.

**Tests**

- Rounding, currency decimals, minimum margin, expiry, re-quote, and over-budget scope reduction.
- Browser-edited totals cannot alter server-calculated quote or supplier cap.
- An expired or unaccepted quote cannot proceed.

**Exit gate**

The customer sees and accepts a reproducible, itemized quote whose supplier budget is enforced server-side.

### M6 — Funding, ledger, approvals, and procurement policy

**Build**

- Select a verified customer payment test route or implement explicit `DEMO_SANDBOX` approval.
- Add idempotent signed payment event processing; redirects alone never verify payment.
- Implement balanced ledger accounts, transactions, and entries per asset.
- Post customer collection, customer obligation, project reserve, supplier commitment, marketplace escrow, fees, expense, revenue recognition, and refund liabilities separately.
- Implement versioned policy rules: per-job cap, project cap, daily cap, allowed services/currencies, auto-approval ceiling, contribution floor, and emergency pause.
- Reserve supplier commitment atomically with approval consumption.

**Tests**

- Forged and duplicate payment events.
- Concurrent reservations cannot exceed project or daily caps.
- Every ledger transaction balances by asset; deposits are not recognized as profit.
- Pause prevents new spend while preserving monitoring.

**Exit gate**

No procurement path can execute without verified/sandbox funding, a valid approval, an atomic reservation, and an audit record.

### M6A — Rust NEAR project and settlement receipt contract

**Build**

- Create `contracts/auvra-receipts` as a Rust/Wasm NEAR contract using a pinned stable `near-sdk` 5.x release.
- Define versioned `ProjectReceipt` and `SettlementReceipt` types containing only opaque hashes, issuer, and block timestamp.
- Implement owner initialization, authorized-writer management, `record_project_receipt`, `record_settlement_receipt`, and public receipt lookup methods.
- Enforce append-only uniqueness and idempotent exact replays; reject conflicting receipt data.
- Emit NEP-297-compatible events for receipt creation and writer changes.
- Define one canonical JSON serialization and SHA-256 hashing specification shared by Rust and TypeScript.
- Add `ReceiptAnchorAdapter` to the worker. It submits a project receipt only after immutable scope acceptance and a settlement receipt only after ledger/provider reconciliation.
- Persist NEAR transaction hash, signer, network, contract account, receipt hash, block reference, submission state, and last reconciliation time in PostgreSQL.
- Deploy to a local sandbox first, then NEAR testnet. Mainnet deployment is explicitly outside the hackathon critical path unless separately approved.

**Tests**

- Rust unit tests for owner/writer authorization, create/read, exact replay, conflicting duplicate, and invalid hash/schema inputs.
- `near-workspaces-rs` sandbox tests for deployment, account authorization, transaction execution, event emission, and public reads.
- Cross-language golden-vector tests prove TypeScript and Rust produce identical canonical hashes.
- Worker restart and ambiguous transaction tests reconcile chain state before resubmitting.
- Privacy tests ensure raw briefs, customer identity, URLs, messages, and commercial data never enter contract arguments or events.

**Exit gate**

On NEAR testnet, a project receipt and its later settlement receipt can be independently queried and verified against the private canonical records. Duplicate delivery cannot create conflicting receipts, unauthorized accounts cannot write, and the contract has no capability to custody or transfer funds.

### M7 — Durable orchestration and transactional outbox

**Build**

- Create `apps/worker` with BullMQ queues for analysis, matching, quoting, procurement, monitoring, QA, delivery, notification, and reconciliation.
- Implement an outbox publisher with leases, retry limits, dead-letter handling, and observable health.
- Schedule ready tasks from dependency completion; use database locks/leases and optimistic versions.
- Add idempotency records for commands and external actions.
- Reconcile timed-out actions before retrying.

**Tests**

- Worker restart, repeated delivery, expired lease, out-of-order event, and poisoned job.
- Duplicate request/payment/outbox messages yield one domain effect.
- Dependency gating prevents premature task execution.

**Exit gate**

A sandbox project survives process restarts and completes without duplicate tasks, hires, or ledger entries.

### M8 — Real marketplace job vertical slice

**Build**

- Add separately gated hire preparation showing exact provider, service, payload, amount, asset, deadline, and authorization.
- After explicit smoke-test authorization and verified funding, create one capped real external job.
- Persist request hash and remote identifiers before or immediately after the provider response according to the proven reconciliation strategy.
- Poll or subscribe to status with backoff; store raw status, normalized state, messages, artifacts, and last-seen timestamps.
- Implement provider-specific correction messaging and acceptance only where verified.
- After the scope is immutable, anchor the project receipt through `ReceiptAnchorAdapter`; do not block supplier execution indefinitely on a transient chain outage—record a recoverable anchoring state and retry safely.

**Tests**

- Timeout after remote creation reconciles before retry.
- Repeated polls and provider events are idempotent.
- Unknown provider state pauses instead of guessing.
- Live smoke evidence is redacted and recorded separately from fixtures.

**Exit gate**

One authorized real supplier job is created, observed through completion, and accepted/settled only according to verified provider semantics. If blocked, the exact external limitation is documented and the UI remains honestly sandbox-labelled.

### M9 — QA, revisions, artifacts, and customer delivery

**Build**

- Run file integrity, MIME/format, schema, requirement coverage, links/evidence, and qualitative checks against acceptance criteria fixed at quote time.
- Persist QA policy version, evidence, violations, result, and retry count.
- Support a bounded provider correction/revision path without silently increasing spend.
- Implement `/app/projects/[id]`, timeline, task status, suppliers used, and `/deliverables` preview/download/revision/acceptance.
- Separate supplier acceptance from customer acceptance and final project closure.

**Tests**

- Known-good artifact passes; corrupted or requirement-incomplete artifact fails.
- Revision cannot exceed count or budget.
- Customer acceptance cannot occur before QA and cannot duplicate closure postings.

**Exit gate**

A customer can review, download, request an allowed revision, and accept a versioned deliverable with a complete audit trail.

### M10 — Reconciliation, customer billing, and operator console

**Build**

- Reconcile customer payment, supplier commitment, marketplace-held funds, settled expense, fees, remaining obligation, recognized revenue, and realized contribution.
- After reconciliation is final, anchor the settlement receipt and expose its NEAR transaction/proof link to the customer and operator.
- Build `/app/billing` for customer invoices and receipts without exposing internal treasury.
- Build `/ops`, `/ops/requests/[id]`, `/ops/treasury`, and `/ops/policies` with role enforcement.
- Add pause/resume, safe step replay, exception approval, integration health, and immutable operator audit events.
- Replace demo dashboard percentages and revenue with real read models or honest zero states.

**Tests**

- Ledger/provider mismatch pauses expenditure.
- Operator replay remains idempotent.
- Customer cannot access internal treasury or another customer's billing records.
- Empty-state analytics display no invented activity.

**Exit gate**

The project closes with reconciled external references and the operator can explain every state and financial figure from recorded evidence.

### M11 — Reliability, accessibility, deployment, and demo

**Build**

- Add Playwright E2E for the PRD's ten required scenarios and pytest only if a Python service is introduced.
- Add structured logs, correlation IDs, traces, safe error codes, queue/DB/storage/market/payment health checks, and alertable failures.
- Complete keyboard navigation, focus states, semantic labels, responsive layouts, and reduced-motion handling.
- Add deployment manifests, secret inventory, migration/rollback process, backup notes, and operator runbook.
- Prepare a three-minute demo using one real supported service plus a second different request proving universal intake.
- Clearly label live, test, and mock evidence in the UI and submission materials.

**Tests**

- Build, lint, format, type-check, unit, integration, E2E, migration, authorization, concurrency, webhook replay, and restart tests all pass.
- Demo can be reproduced from README without hidden local state.

**Exit gate**

All PRD release acceptance items pass or are listed as explicit blockers with no misleading claims.

## Required state-machine implementation

Implement transition maps as code and test them independently of UI:

- Request: `DRAFT → SUBMITTED → ANALYZING → NEEDS_CLARIFICATION ↔ ANALYZING → SCOPED → QUOTED → APPROVED → AWAITING_FUNDS → FUNDED → PROJECT_CREATED`, with terminal `UNSUPPORTED`, `REJECTED`, `CANCELLED`, `EXPIRED`.
- Project: `PLANNING → PROCUREMENT → RUNNING → QA → CUSTOMER_REVIEW → DELIVERED → CLOSED`, with `BLOCKED`, `REVISION`, `DISPUTED`, `CANCELLED`, `FAILED` alternatives.
- Supplier job: `PROPOSED → APPROVED_TO_HIRE → CREATE_PENDING → HIRED → ACTIVE → SUBMITTED → QA_PASSED → ACCEPTED`, with `QA_FAILED`, `REVISION_REQUESTED`, `CANCELLED`, `FAILED`, `EXPIRED` alternatives.
- Payment: `CREATED → PENDING → VERIFIED → ALLOCATED → RECONCILED`, with `FAILED`, `REFUND_PENDING`, `REFUNDED`, `DISPUTED` exceptions.
- Receipt anchor: `PENDING → SUBMITTED → CONFIRMED`, with recoverable `RETRY_PENDING`, `RECONCILIATION_REQUIRED`, and terminal `FAILED` states. Business truth remains in PostgreSQL; `CONFIRMED` requires a verified chain outcome.

Administrative remediation must be a separate audited command, not an arbitrary state assignment.

## API implementation order

1. Identity and request CRUD: `/api/me`, `/api/requests`, `/api/requests/:id`.
2. Attachments and analysis: signed upload endpoints, `/clarifications`, `/analyze`, `/plan`.
3. Quote lifecycle: `/quotes`, `/api/quotes/:id/accept`.
4. Funding: `/payment-session`, signed `/api/payments/webhook`.
5. Project read models: projects, events, artifacts, revisions, delivery acceptance.
6. Operator endpoints: health, run detail, pause/resume, approvals, treasury, audit.

Every write endpoint requires schema validation, ownership/RBAC, an idempotency key where retryable, a state precondition, an audit event, and a safe public error code.

## Test strategy

### Unit

- Schemas, transitions, DAG validation, capability matching, quote arithmetic, ledger balance, policy authorization, QA validators, and provider normalization.

### Integration

- PostgreSQL transactions and locking, Auth.js persistence, object storage signatures, BullMQ restart behavior, marketplace fixtures/live read-only checks, payment signature verification, and outbox delivery.

### End to end

- Two unrelated requests through one intake.
- Clarification and unsupported paths.
- Quote approval and sandbox funding.
- Real capped supplier job when separately authorized.
- QA pass/failure/revision.
- Cross-user isolation.
- Duplicate event/restart safety.
- Emergency pause.
- Honest external outage and sandbox labelling.

## Fourteen-day execution map

- Days 1–2: M0 and marketplace paid-lifecycle investigation; CI and environment validation.
- Days 3–4: M1–M2 database, auth, ownership, universal request, and files.
- Days 5–6: M3 manager analysis, clarification, feasibility, and two-category fixtures.
- Days 7–8: M4–M6 supplier matching, quotes, sandbox funding, ledger, and policy.
- Day 8 in parallel with backend work: M6A receipt contract, sandbox tests, and TypeScript/Rust hash vectors.
- Days 9–10: M7–M8 durable orchestration and one separately authorized real job.
- Day 11: M9 QA, revisions, and delivery.
- Day 12: M10 reconciliation and operator console.
- Day 13: M11 authorization, concurrency, restart, accessibility, and E2E hardening.
- Day 14: reproducible deployment, live evidence, demo rehearsal, and submission.

If schedule pressure occurs, reduce UI breadth, optional wallet linking, and multi-supplier execution first. Do not cut real integration evidence, ownership isolation, spend policy, idempotency, QA, truthful status, or ledger correctness.

## Immediate next milestone

Begin M0/M1 with no paid marketplace action:

1. Move the corrected PRD into the repository as the canonical specification and mark the earlier PRD superseded.
2. Replace the current Prisma skeleton with v2 aggregates and state enums, then generate the reviewed baseline migration.
3. Add persistent Auth.js models and ownership/RBAC tests.
4. Restructure routes to `/app/**` and `/ops/**`, using database-backed empty states rather than simulated financial claims.
5. Keep the existing universal intake UI, but wire it only after the request command and ownership boundary pass tests.
6. Scaffold the receipt contract only after canonical receipt schemas and privacy boundaries are reviewed; contract work must not delay M0/M1 identity and ownership correctness.

