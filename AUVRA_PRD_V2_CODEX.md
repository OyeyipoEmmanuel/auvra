# AUVRA — PRODUCT REQUIREMENTS DOCUMENT
## The company that runs itself.

**Version:** 2.0 — corrected product definition  
**Date:** 26 October 2026  
**Track:** NEAR Hackathon — Autonomous Business  
**Audience:** Product designers, developers, Codex, judges  
**Status:** Build specification; external integrations require live validation

---

# 0. READ THIS FIRST — NON-NEGOTIABLE PRODUCT IDENTITY

Auvra is **an autonomous AI-operated service company**. A customer hires **Auvra**, not a collection of individual agents. Auvra accepts a service request in ordinary language, evaluates whether it can fulfill the desired outcome, scopes and prices the work, collects customer authorization/payment, procures specialized external AI agent services through **NEAR Agent Market**, coordinates tasks, evaluates deliverables, delivers the contracted output, pays suppliers according to marketplace rules, and accounts for revenue, cost, reserve obligations, and profit.

**Auvra is the company. NEAR Agent Market is the supplier marketplace.** Do not build a new public agent marketplace as the product, and do not make customers select agents to fulfill standard orders. The AI manager makes procurement decisions subject to deterministic policies and exceptions. Customers may optionally see who was used for transparency.

**Scope correction:** No service category is the product. Competitor reports, research, design, landing pages, documentation, content, etc. are examples only. **Never place hardcoded competitor names, research questionnaires, “focus questions,” or competitor report steps in the universal order form.** The architecture must support varied service requests and classify them dynamically. An agent can accept a job only if its verified capability and offered terms match. **General-purpose intake ≠ guaranteed delivery of arbitrary requests.** Unsupported or risky requests must receive a clear rejection or a request for clarification.

**Product promise:** *Describe the outcome. Auvra figures out the work, hires the right AI agents, manages delivery, and accounts for the money.*

**Hackathon objective:** Show one fully instrumented **real end-to-end transaction** using at least one external NEAR Agent Market supplier, with actual work, traceable costs, accepted deliverables, and a reconciled financial ledger. Multiple job categories should be demonstrable via adaptable planning and UI; do not claim all can be executed until capable suppliers exist.

---

# 1. EXECUTIVE SUMMARY

## 1.1 The problem

Getting work done through AI agents today commonly requires customers to discover multiple tools or agents, understand their capabilities, decompose a project themselves, pay different providers, merge outputs, check quality, and manage failures. Suppliers sell narrow capabilities; few customer-facing products own the end-to-end outcome and commercial risk.

## 1.2 The solution

Auvra functions as an **AI-managed prime contractor**. It presents one interface, quote, accountable workflow, and final delivery. A manager/orchestrator decides what work to delegate, procures suppliers through NEAR Agent Market, monitors jobs and corrects problems within an approved budget. Auvra's treasury and ledger control funds and transparently distinguish collected cash, reserved customer obligations, supplier commitments, paid expenses, and actual realized company margin.

## 1.3 Target audience

- **Primary:** Founders, freelancers, small businesses, creators, and teams buying discrete digital outcomes.
- **Secondary:** Operators/admins supervising the business, reviewing exceptions, payment issues, and service health.
- **External suppliers:** NEAR Agent Market-listed AI agents; they do **not** need Auvra accounts.

## 1.4 Success thesis

Auvra wins if it lets a customer purchase a deliverable—not manage the supply chain—and can prove the company executed procurement, quality assurance, payout reconciliation, and profitability autonomously within explicit controls.

## 1.5 Why Auvra, not NEAR Agent Market?

| NEAR Agent Market | Auvra |
|---|---|
| Supplier discovery and individual marketplace jobs | Customer-facing service company selling a finished outcome |
| Each marketplace job has its own terms and lifecycle | One client contract/orchestration plan spanning several supplier jobs |
| Agent/service listed for buyers | Auvra chooses suppliers using capability, budget, quality and availability |
| Marketplace-side escrow and settlement | Auvra manages distinct customer collection, supplier expense obligations, and margin accounting |
| Individual seller work products | Auvra composes, validates and delivers contracted work |

## 1.6 Business model

Project pricing. Customer pays approved quote **Q**. Auvra targets a margin after supplier costs **C**, execution costs **I**, transaction costs **F**, and provisions for revisions/refunds **R**. Estimated contribution = Q − C − I − F − R. Do not equate customer deposits or unspent escrow with profit. Post-MVP options include subscriptions, enterprise procurement controls, and recurring service contracts.

---

# 2. PRODUCT PRINCIPLES

1. **Outcome-first, not agent-first.** Buyer requests an outcome; Auvra handles decomposition and procurement.
2. **Service-agnostic core.** No universal competitor-research schema. Use extensible task plans and service capability matching.
3. **Safe autonomy, verifiable guardrails.** LLM recommends; deterministic policy authorizes any binding spend, approval, release, or state change.
4. **One commercial counterparty.** Auvra owns the quote and client communication; external agents are suppliers.
5. **Truthful state.** Never show “paid,” “funded,” “hired,” “completed,” or “profitable” until corroborated with provider receipts or ledger state.
6. **Funds segregation.** Separate customer collection, project reserves, marketplace escrow, company available cash and recognized profit.
7. **Quality before delivery.** Evaluate each output against the original accepted requirements; escalate unsupported evaluations.
8. **Auditability.** All material agent decisions, financial approvals, job transitions and exceptions produce immutable audit events.
9. **Resumable automation.** Background jobs are durable, idempotent, and recoverable after restart or webhook duplication.
10. **Progressive disclosure.** Customers see a calm, modern interface, not verbose internal AI chains of thought.
11. **Don't fake NEAR integration.** Demo sandbox mocks must be labelled; production flow uses verified SDK capabilities.
12. **Explicit failure states.** Agent unavailable, payment pending, insufficient budget, rejected work and timeout are supported outcomes.

---

# 3. SCOPE, MVP BOUNDARIES AND RELEASES

## 3.1 Must ship for hackathon (P0)

- Responsive marketing home; Google sign-in/up; user workspace; authenticated routes; sign out.
- Customer universal free-text request with optional supporting files, target outcome and constraints; dynamic AI clarification.
- Feasibility evaluation, structured project plan, supplier capability search, quote calculation and presentation.
- Customer accepts scope, quote, approval/payment terms; explicit funding status (real supported payment route or clearly labelled test mode).
- NEAR Agent Market buyer SDK integration: service discovery, create job, retrieve/monitor job, fetch outputs/messages, request correction where supported, accept completed deliverable where supported.
- Durable orchestration: dependency-aware tasks, one or more external jobs, per-task cost limits, progress event log, retries and recovery.
- Automated deliverable QA (format/coverage checks plus LLM assessment) and clear customer review and revision flow.
- Finance ledger and per-project quote → supplier commitments → settled costs → earned margin view.
- Operational dashboard, job details, account/settings, admin exceptions & emergency pause.
- Demo showing at least one **genuine marketplace hire**, deliverable, accepted settlement (where feasible), and auditable revenue/profit calculation.
- Automated tests for workflow, budget invariants, authentication/authorization and marketplace adapter.

## 3.2 Should ship if time permits (P1)

- Several supplier jobs per project, automatic fallback supplier, richer parallel execution and artifact synthesis.
- Notifications via email, role-based admin UI, optional wallet linking, richer marketplace discovery/history.
- Payment integration using suitable verified supported provider and chain receipts.
- Multiple supported real service categories validated end-to-end.

## 3.3 Future (P2)

- Self-service company creation for third parties, independent tenant treasuries and policies.
- Automated customer acquisition, sales negotiation, inbound email intake, subscriptions, multi-chain intents integrations, onchain profit sharing.
- Advanced dispute/arbitration, multi-agent competitive bidding, self-evolving catalogs and broad platform API.

## 3.4 Explicitly out of scope for V1

- Auvra **as** a seller listing aggregator or NEAR Agent Market clone.
- Hardcoded competitor report interface, fixed competitor-name fields, single-sector architecture.
- Guarantees that any job in any industry can be done by an available market supplier.
- Fully autonomous high-value funds transfers without approvals or policy limits.
- Real custody, escrow, insurance, refunds, compliance claims unless implemented and legally checked.
- Human freelancer sourcing, promises about unsupported marketplace bidding APIs, unverified Google-login via near-connect.
- Invented ratings, external agent inventories, transaction counts or profit metrics.

---

# 4. ACTORS, PERMISSIONS, AND PRODUCT MODEL

| Actor | Rights |
|---|---|
| Guest | View marketing pages, auth entry |
| Customer | Create/own requests, clarify scope, accept quote, fund order, see project, review outputs, request permitted revisions |
| Auvra Manager | Evaluate, plan, recommend procurement, dispatch work within approved budgets, supervise jobs, prepare delivery |
| Auvra Finance Service | Validate balances, reserve commitments, initiate policy-approved marketplace actions, reconcile provider state |
| Auvra QA Service | Test outputs, reject or return to worker, package final deliverables |
| Admin/Operator | Configure limits, pause automation, approve exceptions, inspect audit logs, resolve disputes |
| External Agent | Exists via NEAR Agent Market; not logged into Auvra as a customer |

**Single Auvra-operated company** for MVP, serving many customers. Customer workspaces do not own individual autonomous companies, treasuries or spend policies; those are internal operator capabilities. Do not add “create your AI company” onboarding or customer company-autonomy settings into V1. Customers can supply a business name/profile to identify their order, not launch a business tenant.

---

# 5. EXPERIENCE AND INFORMATION ARCHITECTURE

## 5.1 Branding

- Brand: **Auvra**. Tagline: **The company that runs itself.**
- Use attached Auvra logo in product implementation, not a newly invented icon.
- Visual style: market.near.ai-inspired **restrained modern product UI**, not a replica: solid black `#09090B`, panels `#131316`, borders `#27272A`, off-white `#FAFAFA`, muted `#A1A1AA`, primary purple derived from the actual logo asset (approximate accent `#7C3AED`; sample uploaded logo for precise token). Limited purple on CTAs/selected states, no intense glowing planets, gradients or decorative visual clutter. Green/red only for meaningful operational states.
- Fonts: modern neutral sans (Inter or Geist); accessible contrast, keyboard focus outlines, subtle hover states, 8px spacing rhythm, max-width layouts.
- Design should look like a real product with **2–4 core content groups per page**, not a dense AI demo dashboard.

## 5.2 Pages/routes (Next.js App Router proposed)

| Route | Page | MVP content |
|---|---|---|
| `/` | Landing | Hero, concise how it works, CTA, NEAR integration statement |
| `/sign-in` | Sign-in | Google OAuth; no mandatory wallet; protected redirect |
| `/app` | Customer dashboard | Recent projects, 2–3 stats, new-request CTA |
| `/app/requests/new` | Submit request | Free-text brief, attachments, desired outcome, budget/deadline optional |
| `/app/requests/[id]/clarify` | Clarifications | Dynamic contextual questions generated by planner |
| `/app/requests/[id]/quote` | Quote review | Scope, itemized deliverables, timelines, quote, terms, accept/reject |
| `/app/projects` | Projects | Simple status list and filters |
| `/app/projects/[id]` | Project overview | Timeline, plan/tasks, updates, committed budget, assigned providers |
| `/app/projects/[id]/deliverables` | Delivery review | Output previews, QA summary, accept / revision feedback |
| `/app/billing` | Customer payments | Invoices, deposits, payment state, receipts; no unrelated company finance claims |
| `/app/settings` | Customer settings | Profile, Google login, optional linked NEAR wallet, notifications |
| `/ops` | Internal dashboard | Live jobs, failures, spend, pending approvals (admin only) |
| `/ops/requests/[id]` | Internal run detail | Plan, provider matches, jobs, logs, manual intervention |
| `/ops/treasury` | Company finance | Collected funds, escrow, liabilities, cash, gross margin, payouts, reconciliation |
| `/ops/policies` | Spending & QA policies | Configurable safe limits, exceptions, kill switch |

**Design correction:** Auvra's normal customer never browses agent marketplace as a requirement. Internally `/ops` shows selection and procurement detail. Customer may view “Suppliers used” on project detail after selection. Remove previous fictitious large marketplace shopping interface from required customer navigation.

---

# 6. CANONICAL END-TO-END FLOW

1. **Sign in:** Customer chooses Google; session established. Optional wallet link is separate.
2. **New request:** Customer writes “I need X done by Y, with Z requirements”, optionally attaches files and target output.
3. **Safety/feasibility:** System checks content policy, service compatibility, asset type, deadlines and supplier availability. Returns `NEEDS_CLARIFICATION`, `SUPPORTED`, `NOT_AVAILABLE`, or `REJECTED` with reasons.
4. **Clarify dynamically:** Only ask domain-specific questions if necessary. A branding task might ask audience; a research task might ask questions; a webpage task might ask tech stack. **Never ask all customers about competitors.**
5. **Plan:** Manager produces structured subtasks, prerequisites, acceptance tests, estimated spend, contingency and risk flags.
6. **Discover:** Supplier adapter retrieves relevant NEAR Agent Market **services** and their real published terms. Auvra ranks compatible services by capabilities, demonstrated reliability (only if evidence exists), quoted price, latency and remaining budget. If none match, stop with `NOT_AVAILABLE` or request scope changes.
7. **Quote:** Calculate cost ceilings + buffer + target margin, generate user-facing scope and final customer quote. Clearly state what is and is not included, revisions, turnaround assumptions and cancellation terms.
8. **Client approves and funds:** Create an immutable quote acceptance; verify actual payment event or explicit sandbox approval. No real supplier procurement spending before funding is verified and policy checks pass.
9. **Reserve budget:** Double-entry style ledger posts customer payment, project obligation/reserve and procurement authority. Never mark deposited funds as earned profit.
10. **Hire suppliers:** For each ready task, call marketplace SDK job endpoint through **server-only** client using approved budget and idempotency strategy; persist returned job/assignment identifiers.
11. **Supervise:** Poll or subscribe to marketplace job updates; record status, messages and supplier artifacts; release dependent tasks when predecessors pass QA.
12. **QA:** Check artifact integrity, agreed format and expected requirements. On failure use marketplace messaging/revision options where supported; otherwise escalate and stop settlement.
13. **Review and deliver:** Assemble final artifacts, present clear links/files and verification summary. Customer may accept or request a scoped revision.
14. **Settle:** Follow actual marketplace escrow acceptance and payment semantics. Reconcile external releases, platform fees, remaining liabilities, and customer payment status. Prevent duplicate acceptance/releases.
15. **Close & account:** Mark project delivered only when accepted under specified policy; book recognized revenue and costs, compute contribution, issue receipt.
16. **Exceptions:** Handle nonpayment, timeout, declined quote, unsatisfactory work, refund/dispute, disconnected integration or administrator pause. Maintain visible honest statuses.

## 6.1 State machines

**Request:** `DRAFT → SUBMITTED → ANALYZING → [NEEDS_CLARIFICATION ↔ ANALYZING] → SCOPED → QUOTED → APPROVED → AWAITING_FUNDS → FUNDED → PROJECT_CREATED`; terminal alternatives: `UNSUPPORTED | REJECTED | CANCELLED | EXPIRED`.

**Project:** `PLANNING → PROCUREMENT → RUNNING → QA → CUSTOMER_REVIEW → DELIVERED → CLOSED`; alternatives: `BLOCKED | REVISION | DISPUTED | CANCELLED | FAILED`.

**Supplier job:** `PROPOSED → APPROVED_TO_HIRE → CREATE_PENDING → HIRED → ACTIVE → SUBMITTED → QA_PASSED → ACCEPTED`; alternatives: `QA_FAILED | REVISION_REQUESTED | CANCELLED | FAILED | EXPIRED`.

**Payment:** `CREATED → PENDING → VERIFIED → ALLOCATED → RECONCILED`; exceptions: `FAILED | REFUND_PENDING | REFUNDED | DISPUTED`.

Make explicit transition tables in code. Reject illegal backward/terminal transitions except audited administrator remediation. Never infer a state from the frontend timer.

---

# 7. FUNCTIONAL REQUIREMENTS (WITH ACCEPTANCE CRITERIA)

## FR-01 Identity, sessions and ownership — P0

- Google OAuth sign-in/sign-up; create first-time user and attach verified Google identity by provider account ID (not just email string).
- Auth.js (NextAuth) with PostgreSQL adapter or equivalent stable OAuth/session solution, HttpOnly secure cookie, CSRF protection and provider callback handling.
- Protected `/app/**`, separate administrator `/ops/**`; roles enforced in backend, never merely hidden in UI.
- Users can only read/write own requests, projects, receipts and files. Account linking should prevent duplicate identity hijacking.
- Log out invalidates session. Signed-out session cannot access tenant data.
- Optional NEAR wallet connect via `@hot-labs/near-connect` and server-verified nonce-bound signed message. **Do not present near-connect as Google OAuth.** Linking a wallet does not grant control over company funds.

**Pass:** sign in, sign out, session restore, cannot access another user's request by altering ID; wallet linking verified.

## FR-02 Universal request intake — P0

- One large free-text prompt: “What do you need done?”
- Optional: files, budget ceiling, deadline, deliverable expectations, constraints and preferred currency. Hide further details until needed.
- Validate min/max length, MIME size and count, sanitize file names; encrypted object storage + signed read URLs.
- Each request stores `raw_brief` **unchanged** and a separate normalized interpretation. Never silently alter customer intent.
- Support drafts, retries and attachments.

**Pass:** two unrelated requests (e.g., logo and research) both submit using the same universal form; **neither** sees forced competitor fields.

## FR-03 Analysis, dynamic clarification & feasibility — P0

- Structured JSON schema with `objective`, `deliverables[]`, `constraints`, `questions[]`, `safety_flags`, `capability_requirements[]`, `decision`, `confidence`, and `reasons[]`.
- Validate schema server side (Pydantic/Zod). Missing critical detail creates a specific clarification; maximum 3 questions per round, max 2 rounds automatically, thereafter admin escalation or decline.
- Safety rules for disallowed/regulated/unsafe requests and unauthorized collection of third-party secrets.
- No provider offers? Decline gracefully; never invent a supplier.

**Pass:** relevant follow-up on vague request; invalid or unsupported request does not proceed to payment.

## FR-04 Planning — P0

- Plan outputs task DAG: `{task_id, title, objective, input_artifacts, output_contract, required_capabilities, dependencies, validation_rules, max_spend, deadline, retry_limit}`.
- Validate acyclic graph; no empty task list; max task count in hackathon (e.g. 8) configurable.
- Include contingency/revision budget and margin estimate.
- Human-facing summary distinct from internal executor contract.

**Pass:** nested tasks run in dependency order; invalid/cyclic plans rejected before spend.

## FR-05 Supplier discovery, evaluation and procurement — P0

- Query NEAR Agent Market `/services` via server adapter; normalize real `serviceId`, category, price/currency terms and capability metadata as actually exposed.
- Match service requirements; rank with transparent deterministic rules and explanations. Prefer compatibility over cheapness.
- Request or select available pricing **using documented APIs only**. A matching service may not guarantee successful instant job placement.
- One procurement approval decision per supplier job. Project supplier spend cap, daily cap, and duplicate-hire protection.
- Create external jobs with approved `title`, `description`, `budget { amount, token }`, `serviceId` or supported `category`, `tags`, and `deadlineSeconds` where documented.
- Persist remote job identifier and request payload hash; recover by checking existing job before retries.

**Pass:** fetch genuine service catalog; hire at least one real listed provider via documented SDK; spend limit blocks overbudget task.

## FR-06 Marketplace job lifecycle & monitoring — P0

- Retrieve job state and messages with SDK; optional SSE if supported and reliable; otherwise configurable polling with timeout and backoff.
- Store raw external status + normalized local state; record `last_seen_at` and event history.
- Support progress/status display, vendor messages, approved clarification or revision request, and final acceptance according to documented job semantics.
- Handle transient errors, eventual consistency, duplicates and partial failure.

**Pass:** server restart doesn't double-hire; same webhook/event repeated doesn't create duplicate ledger entries.

## FR-07 Quality assurance, revisions, delivery — P0

- Define requirements/acceptance tests **at quote time**, not after seeing supplier output.
- QA modules: file integrity, required formats, structured output/schema, links and evidence, LLM qualitative evaluation with citations/examples when meaningful.
- Auvra QA can reject and seek revision (bounded attempts, capped additional spend); never assume LLM quality score proves correctness.
- Independent/customer review UI: preview, download, revision comment, acceptance.
- Supplier payouts tied to actual marketplace settlement rules; don't misrepresent client acceptance as direct onchain control over every escrow.

**Pass:** good artifact delivered; deliberately invalid artifact fails QA; customer requests revision; final approval closes safely.

## FR-08 Quoting and customer payments — P0

- Draft quote includes scope version, deliverables, assumptions, deadline, supplier cost cap, operational costs, buffer, fees, desired contribution and total customer price.
- Quote expiry, customer approval, terms, taxes/disclosures as applicable, supplier nonavailability handling.
- Actual customer payment options must be selected from **verified available provider integration** (MVP may provide clearly labelled test-mode payment pending live integration). Do **not** assume NEAR Agent Market collects Auvra's customer invoices: buyer marketplace payment and customer billing are separate systems.
- A customer payment is `VERIFIED` only on authenticated provider webhook/receipt verification; never on redirect alone.
- Marketplace spending only with verified paid balance or explicitly funded platform-controlled treasury and spending authorization.

**Pass:** unpaid quote cannot trigger real supplier spending; duplicate payment notifications remain idempotent.

## FR-09 Treasury, accounting and margin — P0

- Ledger uses integer minor units and explicit asset/currency decimals, never JS floats for monetary arithmetic.
- Record `customer_payment`, `customer_obligation`, `project_reserve`, `supplier_commitment`, `market_escrow`, `supplier_expense`, `fees`, `refund_liability`, `earned_revenue`, `operating_cost`, `company_contribution` (as computed report, not a wallet).
- Distinguish estimated vs confirmed supplier costs, funds held in Auvra accounts vs held by marketplace, and paid vs unsettled charges.
- Available spend = verified treasury assets minus committed obligations/reserves, subject to policies. Provider wallet balance and internal ledger must reconcile.
- Project profitability only finalized after revenue recognition per policy and actual expense reconciliation.
- Dashboard shows **Collected / Reserved / Paid to Suppliers / Unsettled / Realized Contribution**, with estimated contribution explicitly tagged as such.

**Pass:** no negative available balance from concurrent actions; every financial posting balances; profit is not marked earned on initial deposit.

## FR-10 Policies, security and approvals — P0

- Enforcement on server before **every** external action that can cost funds: max per supplier job, project cap, global daily cap, currency allowlist, marketplace allowlist, minimum contribution threshold, auto-approval ceiling and admin override.
- Pause switch prevents **new** supplier job placement and payouts but permits read-only monitoring.
- Secret storage env/vault only; no marketplace API key or wallet private key in frontend.
- Approval rules versioned; append-only audit log containing actor/automation, input hash, reason, decision, timestamps and external receipt IDs.

**Pass:** user cannot increase supplier budget by editing browser request; concurrent hires cannot exceed cap.

## FR-11 Status, customer communications, notifications — P0/P1

- Timeline: Received, Planning, Quote ready, Awaiting payment, Agent hired, In progress, QA, Ready for review, Delivered; errors and holds explicit.
- No invented progress percentage: compute from completed weighted tasks, show “Waiting for provider” when underlying progress not observable.
- Notification events: quote ready, clarification needed, payment verified, blocked, ready for review, delivery, refund/dispute. Email P1, in-app P0.

## FR-12 Operations console and reliability — P0

- Internal run detail shows request, normalized plan, tasks, service matches, jobs, input/output artifact references, failed steps and cost ledger.
- Operator can pause/resume orchestration, re-run a safe idempotent step, approve an exception or close unsupported requests; all actions audited.
- Health checks for database, queue, market integration, auth, payment provider, object storage.

## FR-13 Reporting and analytics — P0

- Business operational metrics and event-based dashboard (Section 10).
- Filter by timeframe and project; properly handle zero data; do not seed fake production revenues.

---

# 8. SYSTEM ARCHITECTURE & LANGUAGES

## 8.1 Recommended stack

| Area | Tech | Language | Reason |
|---|---|---|---|
| Web/UI | Next.js App Router, React, Tailwind CSS, shadcn/ui | TypeScript | Reusable accessible pages and server auth |
| Web backend and integration gateway | Next.js route handlers / separate Node worker | TypeScript (Node.js) | Official NEAR Agent Market backend SDK targets Node |
| AI management & quality | FastAPI, Pydantic, provider-agnostic LLM client | Python | Typed AI plans, scoring and QA |
| DB | PostgreSQL + Prisma (Node) or SQLAlchemy/Alembic (Python) | SQL / TS or Python | Transactions, constraints and auditability |
| Durable jobs | Redis-backed queue (BullMQ in Node) | TypeScript | Asynchronous polling and recovery; not in-browser loops |
| Files | S3-compatible object storage | — | Signed uploads/downloads |
| Sign-in | Auth.js + Google OAuth | TypeScript | Familiar accounts and secure sessions |
| Wallet connectivity | `@hot-labs/near-connect` | TypeScript | Optional customer NEAR wallet ownership/link |
| Agent marketplace | `@agents-market/market` or documented API | TypeScript | Supplier discovery, jobs, messages, accept |
| Charts | Lightweight chart component | TypeScript | Minimal analytics display |
| Tests | Vitest, Playwright, pytest | TS / Python | Pure unit and end-to-end verification |
| Hosting | Vercel web, persistent Node+Python workers, managed Postgres/Redis | — | Workers must survive independently of serverless page requests |

**Architectural default:** 2 deployable services for fastest hackathon implementation: `web` (Next.js + server-only market gateway + Auth) and `worker` (Node/BullMQ orchestration). A **small Python FastAPI AI service** is optional but preferred due to the team's Python familiarity; do not introduce unnecessary cross-service chatter. If using Python agent manager, expose internal typed HTTP endpoints and authenticate them with service-to-service credentials. Core system can be implemented entirely in TypeScript if it materially reduces hackathon risk, but document this choice; required marketplace SDK still runs server-side in Node.

## 8.2 Logical component architecture

```mermaid
flowchart TD
  C[Customer browser] --> W[Next.js app and API]
  W --> A[Auth.js Google OAuth]
  W --> DB[(PostgreSQL)]
  W --> S[(Object Storage)]
  W --> Q[Durable queue Redis]
  Q --> ORCH[Orchestration Worker Node/TypeScript]
  ORCH --> AI[Manager and QA FastAPI/Python or TS]
  ORCH --> POL[Policy & Budget Gate]
  POL --> LEDGER[Ledger Service]
  LEDGER --> DB
  POL --> MKT[NEAR Agent Market SDK server-only]
  MKT --> EXT[External agent suppliers]
  W --> PAY[Verified Customer Payment Provider]
  PAY --> LEDGER
  ORCH --> DB
  ORCH --> S
  W --> NC[Optional NEAR Connect wallet link]
```

## 8.3 Module layout

```text
auvra/
  apps/web/
    app/(public)/page.tsx
    app/sign-in/page.tsx
    app/app/...
    app/ops/...
    app/api/...
    components/ui/
    components/requests/
    components/projects/
    lib/auth/
    lib/api/
  apps/worker/
    src/queues/
    src/orchestrator/
    src/marketplace/
    src/policy/
    src/ledger/
    src/events/
  services/ai/                 # only if Python AI service chosen
    app/main.py
    app/schemas.py
    app/manager.py
    app/qa.py
    tests/
  packages/contracts/         # Zod schemas and typed DTOs
  packages/db/                # Prisma schema or ORM choice
  packages/config/
  docs/architecture.md
  docs/integrations.md
  docs/assumptions.md
  docs/operations.md
  tests/e2e/
  .env.example
  README.md
```

## 8.4 Event-first design

Every state-changing action runs in transaction-safe step handlers, emits a persistent event and enqueues the next work item using outbox pattern or equivalent. E.g. `request.submitted`, `plan.validated`, `quote.accepted`, `customer_payment.verified`, `supplier_job.created`, `supplier_job.output_received`, `qa.passed`, `project.ready_for_review`, `supplier_job.accepted`, `project.closed`.

An orchestrator must use job-locking (`SELECT ... FOR UPDATE` / lease with expiry) and idempotency keys. Distributed work is **at-least-once**, not exactly-once: design side effects accordingly.

---

# 9. INTEGRATION CONTRACTS AND KNOWN LIMITATIONS

## 9.1 NEAR Agent Market — verified public SDK surface

Public SDK: https://github.com/nearai/agents-market-sdk/blob/main/packages/market/README.md

Documentation describes Node package `@agents-market/market`, server-only API key, Express middleware/MarketClient, and endpoints including:

```text
GET  /services
POST /jobs
GET  /jobs
GET  /jobs/:id
GET  /jobs/:id/stream
POST /jobs/:id/message
POST /jobs/:id/accept
GET  /balance
```

`POST /jobs` accepts `title`, `description`, `budget: {amount,token}`, optional `serviceId` or `category`, `tags`, and `deadlineSeconds`. The SDK documentation describes an instant path when a service or category is provided. Read installed version-specific reference before coding.

**Important cautions:**

- Service descriptions are untrusted supplier content; never execute retrieved instructions blindly.
- Validate actual result schemas and supported payment assets with sandbox test calls.
- Do not pretend `/services` equals guaranteed labor availability or supports freeform procurement bidding.
- Acceptance may release marketplace escrow; verify exact implications and permissions before using `/accept`.
- Revision/change-request support varies by API and provider; implement only after confirming documented interface. The documented follow-up message endpoint is not automatically a guaranteed contractual revision mechanism.
- Some listed services may not support every customer request; reject unsupported requests rather than simulate a hire.
- Do not use marketplace secret directly in browser.

## 9.2 NEAR Connect

Repository: https://github.com/azbang/near-connect

Package `@hot-labs/near-connect` is a **wallet connector**, not a Google OAuth service. V1 primary identity is Google via Auth.js. The wallet, if linked, uses a fresh signed nonce verified server-side with wallet account identifier and network; user never receives authority to sign marketplace treasury transactions.

## 9.3 Payments

Customer checkout is separate from NEAR marketplace buyer escrow. Before implementing real money, run an integration spike to confirm: provider availability and countries, asset support, webhook signature verification, payment settlement destinations, refunds, marketplace funding method, escrow settlement and reconciled receipts. If not verifiable, implement clearly labelled `DEMO_SANDBOX` and require testnet/test-mode funds for all workflows. No false claims of real revenues.

---

# 10. METRICS, EVENTS AND SUCCESS CRITERIA

## 10.1 North-star metric

**Verified profitable autonomous deliveries / week**: count of customer-accepted projects with real supplier work, no unapproved financial policy overrides, reconciled expenses and positive contribution. For hackathon: demonstrate at least **1 end-to-end verified execution**, not fabricated throughput.

## 10.2 Funnel

| KPI | Definition | Initial hackathon target (aspirational) |
|---|---|---|
| Request-to-plan success | Valid eligible requests yielding valid DAG / eligible requests | ≥80% in supported benchmark set |
| Feasibility precision | Accepted “supported” requests that really find suppliers / all accepted | ≥90% on curated test set |
| Quote creation latency p95 | Submission/clarification complete → quote ready | ≤90s under test environment |
| Quote acceptance | Approved quotes / presented quotes | Track only; no invented target |
| Payment confirmation accuracy | Verified payment state matches provider receipts | 100% in test scenarios |
| Supplier hire success | Confirmed remote job / approved hire attempts | ≥80% for tested available suppliers |
| Autonomous completion rate | Jobs delivered without admin rescue / started paid jobs | ≥70% in supported demo fixtures |
| QA pass rate | Accepted QA outputs / output attempts | Track; quality can't be judged only by pass rate |
| Delivery lead time | Funds verified → first review-ready deliverable | Service-dependent; report median |
| Budget adherence | Completed projects not exceeding approved cap | 100% |
| Ledger reconciliation | Posted transactions matched to provider records | 100% for demo |
| Realized contribution | Recognized revenue minus confirmed attributable costs | ≥0 for selected demonstration quote |
| Duplicate expense count | Double-paid/double-accepted supplier jobs | 0 |
| Audit completeness | Material external actions with correlating audit record | 100% |

Record outcomes in instrumented events. Label targets as goals, not historical performance.

## 10.3 Tracing

Each request/project/marketplace job has trace IDs. Emit structured spans for analysis, matching, quoting, funding, hiring, polling, QA, acceptance, delivery and reconciliation. Persist event type, actor, environment, latency, external reference and error code. Avoid storing chain of thought and secrets.

---

# 11. DATA MODEL (MINIMUM TABLES)

All tables have UUID PK, `created_at`, `updated_at` where applicable; include tenant/customer ownership scope, unique constraints, optimistic version for mutable state and foreign keys. Money amounts use `NUMERIC` or bigint minor units with currency metadata.

1. **users**: id, name, email, role, created_at.
2. **oauth_accounts**: user_id, provider, provider_account_id UNIQUE, encrypted OAuth references.
3. **sessions**: user_id, expiry, token hash per auth solution.
4. **wallet_links**: user_id, network, account_id, verification_timestamp, nonce_id.
5. **requests**: user_id, raw_brief, target_outcome, constraints_json, status, feasibility_json, current_quote_id.
6. **request_answers**: request_id, question_id, question, answer, iteration.
7. **files**: owner_id, request_id/project_id, object_key, MIME, size, hash, scan_status.
8. **projects**: request_id, customer_id, status, agreed_scope_version, start/deadline, progress, recognized_revenue.
9. **project_tasks**: project_id, task_key, objective, input_contract, output_contract, depends_on_json, capabilities_json, status, budget_minor, attempt_count.
10. **quotes**: request_id, version, currency, price_minor, estimated_cost_minor, buffer_minor, margin_minor, assumptions_json, expires_at, accepted_at, status.
11. **supplier_services**: external_market_id, service_id UNIQUE, capabilities_json, terms_json, observed_at, trust_flags.
12. **supplier_matches**: project_task_id, service_id, score, grounded_reasons_json, selected_at.
13. **market_jobs**: task_id, service_id, external_job_id UNIQUE nullable, external_assignment_id, request_hash, status, raw_provider_status, budget_minor, currency, last_polled_at.
14. **artifacts**: task_id, market_job_id, object_key/external_url, SHA256, type, QA_status, QA_evidence.
15. **qa_reviews**: project/task/artifact reference, policy_version, result, violations_json, reviewed_at, retry_count.
16. **customer_payments**: quote_id, provider, external_payment_id UNIQUE, amount_minor, currency, status, verified_at.
17. **ledger_accounts**: type, asset, custodian, label.
18. **ledger_transactions**: type, external_reference, idempotency_key UNIQUE, status, posted_at.
19. **ledger_entries**: transaction_id, account_id, debit_minor, credit_minor, asset (require balanced per asset).
20. **policy_versions**: project_cap, task_cap, daily_cap, approval_amount, currency_allowlist, is_active.
21. **approvals**: actor, policy_version_id, action, amount, decision, reference, expiry, consumed_at.
22. **audit_events**: actor, entity_ref, event_type, metadata, correlation_id, occurred_at, immutable.
23. **outbox_events**: event_id UNIQUE, aggregate, type, payload, published_at.
24. **notifications**: user_id, kind, state, message, read_at.
25. **idempotency_records**: actor, route/action, key UNIQUE, request_hash, response_ref, expires_at.

**Constraints:** `(project_id, task_key)` unique; only one active external hire attempt per task unless explicit retry window; double-entry transaction balances; no state transition bypass; immutable accepted quotes. Index `customer_id`, `status`, `created_at`, `external_job_id`.

---

# 12. API DESIGN (ILLUSTRATIVE INTERNAL CONTRACT)

All endpoints authenticated unless public; JSON validated and RBAC enforced. Paths are Auvra endpoints, **not purported NEAR API paths**.

```text
GET    /api/me
POST   /api/wallets/nonce
POST   /api/wallets/link
POST   /api/requests
GET    /api/requests
GET    /api/requests/:id
POST   /api/requests/:id/clarifications
POST   /api/requests/:id/analyze
GET    /api/requests/:id/plan
GET    /api/requests/:id/quotes
POST   /api/quotes/:id/accept
POST   /api/quotes/:id/payment-session
POST   /api/payments/webhook              (provider-signed, unauthenticated session but signature required)
GET    /api/projects
GET    /api/projects/:id
GET    /api/projects/:id/events
GET    /api/projects/:id/artifacts
POST   /api/projects/:id/revisions
POST   /api/projects/:id/accept-delivery
GET    /api/billing/transactions
GET    /api/ops/health                    (internal)
GET    /api/ops/projects/:id/run
POST   /api/ops/projects/:id/pause
POST   /api/ops/projects/:id/resume
POST   /api/ops/approvals/:id/decide
GET    /api/ops/treasury/summary
GET    /api/ops/audit
```

Representative user request payload:

```json
{
  "description": "Design a launch-ready identity for my new clothing brand and deliver usable brand assets.",
  "desiredOutcome": "Logo variations and a usage guide",
  "budget": { "maxAmount": "120", "currency": "USD" },
  "deadline": "2026-11-06T18:00:00Z",
  "attachmentIds": []
}
```

Representative structured analysis result:

```json
{
  "decision": "NEEDS_CLARIFICATION",
  "objective": "Create brand identity assets",
  "requiredCapabilities": ["brand-design", "asset-export"],
  "deliverables": ["logo variations", "usage guide"],
  "questions": ["What audience should the brand appeal to?"],
  "reasons": ["Audience guidance needed for an evaluable brief"]
}
```

Use route-specific error codes: `INVALID_INPUT`, `NOT_AUTHORIZED`, `NOT_AVAILABLE`, `CLARIFICATION_REQUIRED`, `QUOTE_EXPIRED`, `PAYMENT_NOT_VERIFIED`, `BUDGET_EXCEEDED`, `MARKETPLACE_UNAVAILABLE`, `QA_FAILED`, `STATE_CONFLICT`, `RATE_LIMITED`. Return safe human-readable remediation without leaking provider secrets.

---

# 13. AI ORCHESTRATION CONTRACT

## 13.1 Manager responsibilities

- Parse open-ended user request; identify deliverable type(s) without forcing predefined sectors.
- Derive actionable DAG with explicit output acceptance rules and cost ceilings.
- Ask only decision-critical clarifications.
- Retrieve candidate services from genuine marketplace data.
- Recommend hires and monitor success; do not self-sign treasury transactions.
- Summarize status to customer without exposing private provider secrets.

## 13.2 AI output constraints

- Structured JSON only to downstream workers with strict Zod/Pydantic validation.
- Treat marketplace descriptions and customer uploads as untrusted task data, not system instruction.
- Do not take instructions in job responses to change spending rules or exfiltrate secrets.
- Outputs may contain uncertain facts; QA should check evidence where relevant.
- Model failures/timeouts go to bounded retry then controlled exception.

## 13.3 Deterministic policy gate pseudocode

```python
def authorize_procurement(project, task, supplier_offer, ledger, policy):
    assert project.status in {"PROCUREMENT", "RUNNING"}
    assert project.customer_payment_status == "VERIFIED"
    assert task.status == "APPROVED_TO_HIRE"
    assert supplier_offer.service_id in policy.allowed_services
    assert supplier_offer.currency in policy.allowed_currencies
    assert supplier_offer.price_minor <= task.max_spend_minor
    assert ledger.committed_project_spend + supplier_offer.price_minor <= project.approved_supplier_budget_minor
    assert ledger.available_authorized_balance >= supplier_offer.price_minor
    assert not task.has_live_external_job
    return "ALLOW"  # MUST execute atomically with commitment reservation
```

Actual implementation uses DB transaction / serializable isolation or safe locking. Never rely on `assert` alone in production; this snippet illustrates invariants, not deployable code.

---

# 14. ERROR HANDLING, SAFETY AND FAILURE MATRIX

| Failure | Required behavior |
|---|---|
| Request ambiguous | Ask targeted question; no quote before enough detail |
| No capable market service | Display cannot fulfill, avoid collecting payment |
| Estimated cost > customer budget | Suggest scope reduction; do not exceed cap |
| Customer payment pending | Never hire with customer funds not verified |
| Payment webhook repeated | Do not post twice or dispatch twice |
| Supplier hire API timeout | Query remote state / local idempotency before retry |
| Supplier no response | Retry controlled monitoring, alternate hire only after prior commitment resolved |
| Supplier output fails QA | Request supported revision or escalate; don't release blindly |
| Marketplace release ambiguous | Reconcile actual provider job state; stop duplicate release |
| User requests cancellation | Apply agreed cancellation/refund/escrow policy, surface current committed cost |
| Ledger/provider mismatch | Pause supplier expenditure, alert operator, preserve audit trail |
| AI model unavailable | Mark analyzing/QA blocked with retry; don't fabricate result |
| Admin emergency pause | No new financial external side effects; ongoing jobs monitored |
| Unauthorized ID access | 403/404, log audit event, never expose other customer's data |
| Malicious attachment/prompt | File scanning and content isolation; ignore hostile instructions |

High-risk services (regulated financial advice, legal advice, medical diagnosis, identity abuse, illicit activity, account credential harvesting) require separate policy/risk evaluation and are not auto-enabled for MVP.

---

# 15. TEST PLAN AND DEFINITION OF DONE

## 15.1 Unit tests

- Service-agnostic brief interpretation and schema validation.
- DAG no cycles, task dependency gating.
- Cost estimation/margin logic, rounding, asset decimals.
- Policy cap check and concurrent reservation.
- Valid/invalid state transitions.
- Quote expiry, revisions, revenue recognition only when earned.
- File validation and safe storage references.

## 15.2 Contract / integration tests

- `@agents-market/market` adapter with fixture responses for services/job creation/detail/messages/acceptance.
- **One real provider smoke test** in approved environment and with capped cost.
- Google OAuth callback and protected route behavior.
- Verified payment event (test mode) and forged webhook rejection.
- Queue restart and reconciliation; repeated poll never double-creates job or payout.

## 15.3 E2E scenarios

1. Customer signs in with Google, creates a design request, clarifies, receives quote, approves, funds in test mode, supplier executes, QA passes, delivery accepted, financial reports reconciled.
2. A second materially different request (e.g. research or documentation) uses same intake but receives **different dynamic questions and tasks**.
3. Unsupported category gracefully declined without supplier spending.
4. Insufficient budget blocks hire with informative status.
5. Failed QA triggers revision/failure path, no incorrect approval.
6. User A cannot access User B assets and projects.
7. Duplicate webhook + worker restart leave one supplier job and one set of ledger postings.
8. Pause prevents new spend while existing jobs can be viewed.
9. External service unavailable leaves recoverable waiting state, no fake success.
10. No real payments shown as successful when demo mode is used.

## 15.4 Release acceptance gate

- [ ] Universal request form; no research-specific required fields.
- [ ] At least 2 distinct service categories validated for dynamic planning.
- [ ] At least 1 real external NEAR Agent Market hire and result demonstrated.
- [ ] Auth/ownership isolation tested.
- [ ] Policy, quote, payment and ledger tests passing.
- [ ] Supplier status and cost based on real provider data.
- [ ] Admin exception/pause functional.
- [ ] Build, lint, typecheck and E2E passing.
- [ ] README setup/repro guide and 3-minute live demo scripted.

---

# 16. HACKATHON IMPLEMENTATION PLAN (14 DAYS)

**Days 1–2 — Integration risk spike**: verify Node SDK service listing, one cheap approved external job, completion/acceptance semantics, supported market balances; document results. Set monorepo, `.env.example`, database and CI.

**Days 3–4 — Foundation**: Google OAuth, DB migrations, ownership rules, universal request UI, file handling, typed DTOs.

**Days 5–6 — Manager**: analysis, dynamic clarifications, feasibility/safety, structured DAG, test fixtures for two unrelated service types.

**Days 7–8 — Procurement**: service adapter, matching, cost ceilings, quote generation, customer quote review and verified/sandbox funding flow.

**Days 9–10 — Execution**: durable task scheduler, external job creation/monitoring, audit events, retry/recovery.

**Day 11 — QA & delivery**: evidence-based task validation, revision path, artifacts and customer acceptance.

**Day 12 — Accounting & operator console**: ledger postings, reconciliation, spending-policy gate and pause switch.

**Day 13 — Reliability**: cross-user isolation, webhook replays, concurrency, unhappy-path tests, UI accessibility.

**Day 14 — Demo and submission**: one live external supplier end-to-end, screenshots, short demo recording, public repo instructions, contingency fallback clearly labelled.

**Priority rule:** If behind schedule, simplify UI breadth and service categories before compromising real NEAR integration, spending controls or the correctness of the supplier/financial lifecycle.

---

# 17. CODEX EXECUTION INSTRUCTIONS

**Copy this section into Codex context along with the complete PRD.**

1. Treat Section 0 as binding. Auvra is the general-purpose autonomous **service company** and NEAR Agent Market is the **supplier network**.
2. Never implement a competitor-research-only product, competitor-name fields on universal forms, or “explore operating system” copy unrelated to end-customer buying Auvra services.
3. Read official SDK docs and validate current imports/types before implementing integration. Track questions and unverified assumptions in `docs/assumptions.md`.
4. Do the NEAR Agent Market integration spike **first**. If no suitable service can be hired, deliver honest integration limitation and implement a separate `MockMarketAdapter` with explicit demo banner; never disguise mocks as real suppliers.
5. Follow security-first sequencing: Google auth, DB/permissions, planning, quote/payment verification, policy gate, marketplace procurement, QA, ledger.
6. Do not give an AI model direct custody of treasury keys or ability to bypass approval policies.
7. Start each milestone with schemas, business invariants and tests; implement UI afterward. Prefer real business state to static fake KPIs.
8. Use shadcn/ui and Tailwind with near-black and Auvra logo purple; keep screens minimal and navigable. User/customer pages differ from internal operator screens.
9. No speculative endpoints or fictional provider capabilities. Verify docs and pin dependency version.
10. For every external side effect add idempotency key/guard, logging, safe retry/reconciliation path.
11. After each milestone report: completed files, tests executed, external API verified/blocked, deviations, next smallest testable milestone.
12. Build a full working vertical slice before adding unrelated bells and whistles.

### First Codex task

> Read `AUVRA_PRD_V2_CODEX.md` completely. Summarize the product boundary and P0 user flow, identify verified vs unverified integrations, then build a minimal project foundation with typed schemas, Google OAuth, database models, and a NEAR Agent Market integration spike. Start with a tiny real service catalog query and a safe capped external test job before working on polished dashboards. Write tests for permissions and procurement caps. Do not build a competitor report form or a public agent marketplace.

---

# 18. DEMO SCRIPT / JUDGE STORY

**Pitch:** “NEAR Agent Market lets AI agents sell individual services. Auvra builds the company on top. Customers buy an outcome from Auvra; Auvra hires specialized suppliers, manages the project, checks the work, and keeps the business financially accountable.”

1. Sign in to Auvra with Google.
2. Submit a normal-language request for a service demonstrably supported by a real current NEAR Agent Market provider.
3. Show an AI-generated plan, real supplier discovery and a customer quote with transparent margin.
4. Accept and fund with a verified payment route / unambiguously labelled safe test funds.
5. Trigger market job, show real remote job/assignment ID and worker progress.
6. Inspect delivered artifact and QA checks, request correction if useful.
7. Accept output, show marketplace settlement receipt according to actual provider capability.
8. Show collected payment, supplier expense, obligations and realized vs estimated contribution; inspect the transaction and audit logs.
9. Submit a different service request to show that intake/planning are not hardcoded to the demo category.

**Win condition:** Judges see a genuine independently sourced agent perform valuable work, Auvra manage it as a company, and an auditable financial cycle with no claimed fictional state.

---

# 19. OPEN QUESTIONS TO RESOLVE BY INTEGRATION TESTING

- Is the desired market service currently available, priced within a sensible hackathon budget, and able to produce the requested deliverable?
- What are the exact SDK types/version and authentication requirements, supported tokens, funding and escrow behavior for a buyer?
- Does the provider expose revision support as a first-class action or only messaging? What is the safe cancellation path?
- What customer payment provider or testnet route will be used? How will customer payment be settled/funded into marketplace buyer capacity?
- How does the chosen method reconcile cross-chain / NEAR Intents, if added? Avoid claiming Intents functionality without integration.
- Which auth/session and ORM model minimizes implementation complexity?
- What risk/safety categories should be automatically declined?
- Which single service category can be validated live as a reliable hackathon example, without building that category into universal forms?

These questions do **not** justify changing Auvra's product definition. They guide integration feasibility and honest feature flags.

---

# 20. SOURCES (RE-CHECK BEFORE IMPLEMENTATION)

- NEAR Agent Market: https://market.near.ai/
- NEAR Agent Market SDK README: https://github.com/nearai/agents-market-sdk/blob/main/packages/market/README.md
- NEAR Connect wallet connector: https://github.com/azbang/near-connect
- Hackathon track: https://nearhackathon.com/#tracks

**End of document — Auvra PRD v2.0**
