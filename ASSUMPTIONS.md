# Auvra assumptions and blockers

Last updated: 30 October 2026

## Confirmed during Phase 0

- The workspace began as a greenfield directory containing only `Auvra_PRD_Updated.md`.
- Node.js 22.22.2 and pnpm 10.26.0 are available locally.
- The npm `latest` release of `@agents-market/market` is 0.1.9, but its documented `/v1/services` integration is stale relative to the live OpenAPI surface. It has been removed from the spike dependencies.
- Current unauthenticated discovery uses `GET /v1/agents` and `GET /v1/agents/{agent_id}/pricing-plans`.
- Current buyer actions use the OAuth-protected MCP endpoint at `https://market.near.ai/mcp`; a manually generated buyer API key is not the current onboarding path.
- OAuth authorization as the buyer succeeded on 26 October 2026. The server reported version 7.2.0, skill version 0.37.0, and 40 tools using the `marketplace__*` naming convention.
- The connected account is available for buyer actions and reported zero USD/credits plus no readable USDC wallet balance. No paid action was attempted.
- Live read-only discovery returned 20 research agents with pricing on 26 October 2026.
- `Web Research` is a plausible low-cost smoke-test candidate: 0.5000 USDC, available, 45 delivered jobs, 69% recorded success rate, and source-backed research positioning. It is not yet selected or authorized for hire.

## Current product direction

- The customer-facing product accepts open-ended natural-language service requests instead of presenting competitor research as the whole platform.
- Competitor research is one possible service category, not Auvra's identity or exclusive MVP intake.
- The manager must assess feasibility and current marketplace coverage before Auvra claims that a request can be fulfilled or presents an executable quote.
- Website, design, strategy, research, and data-analysis examples express the intended breadth; actual execution remains gated by available suppliers, category-specific validators, safety policy, quote approval, and verified payment.

## Open blockers

- Production-grade encrypted, account-scoped OAuth token persistence is not implemented. Phase 0 deliberately keeps tokens only in process memory, requiring reauthorization for a later session.
- No marketplace buyer wallet balance or funding method has been verified.
- Real research agents and prices have been observed, but their delivered output shape, acceptance window, cancellation behavior, and failure charges have not been exercised.
- No live customer-payment rail has been chosen.
- A live hire has not been authorized or executed.
- The Auvra PostgreSQL Docker container is isolated on host port `55432` because this Windows host already runs PostgreSQL 17 and 18 on ports `5432` and `5433`. The v2 baseline migration is applied and current.
- MinIO community container distribution changed: Docker Hub tags are unavailable and the official pinned Quay image returned `401 UNAUTHORIZED` in this environment. Private object-storage integration remains blocked until an accessible verified S3-compatible image or service is selected.

## Superseded SDK finding

Version 0.1.9 includes declarations under `types/`, but its package `exports` entry does not expose a `types` condition. More importantly, the package targets routes that are no longer present in the live OpenAPI specification. The package and temporary type shim were removed; current catalog schemas are validated locally with Zod.

## Safety assumptions

- The Phase 0 hire ceiling of 5 is a temporary maximum in the configured provider token, not permission to spend.
- No live-hire command exists until the OAuth/MCP flow and durable spend authorization are implemented.
- Production procurement must add durable local attempt records and post-timeout reconciliation before retrying.
- Mock responses are test fixtures only and must never be displayed as live marketplace evidence.
