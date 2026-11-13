# Auvra

Auvra is an autonomous, AI-managed digital service company. Customers buy outcomes from Auvra; Auvra procures specialist services from NEAR Agent Market behind the scenes.

`AUVRA_PRD_V2_CODEX.md` is the canonical product specification. `Auvra_PRD_Updated.md` is superseded and retained only for history.

## Setup

1. Install Node.js 22 and pnpm.
2. Run `pnpm install`.
3. Copy `.env.example` to `.env` and add server-only credentials where available.
4. Run `pnpm check` and `pnpm test`.

## Web application

Run `pnpm dev:web`, then open [http://localhost:3000](http://localhost:3000).

The current product foundation includes:

- a responsive Auvra landing page using a NEAR Agent Market-inspired dark design language;
- reusable shadcn-style buttons, badges, cards, inputs, textareas, and progress components;
- a database-backed customer application shell and universal natural-language service request flow;
- persistent Auth.js Google identities and sessions through PostgreSQL;
- explicit request, project, supplier-job, payment, receipt, audit, and ledger state models;
- local PostgreSQL, Redis, and S3-compatible development storage services.

Use `pnpm check:web` for TypeScript validation and `pnpm build:web` for a production build. Both commands generate Prisma Client from the repository schema before type checking. The Manager uses category-aware rules to create a plan, then checks the live supplier catalog before offering a quote. Supplier availability is observed, not reserved.

For the current Vercel app and Render PostgreSQL setup, see [the deployment guide](docs/deployment-vercel-render.md).

In `DEMO_SANDBOX`, a customer can accept a quote and explicitly create a no-charge project. This records `DEMO_USDC` or `DEMO_USD` ledger entries matching the quote and creates planned tasks. It does not move tokens or hire agents.

## Marketplace discovery

`pnpm market:list` performs read-only discovery through the current public agent catalog and joins each agent to its live pricing plans. It does not require credentials or spend funds.

## Buyer authorization and live hiring

The marketplace uses OAuth-protected MCP for buyer actions. In `LIVE_MARKET`, the worker can turn a verified live-funded ready task into a supplier proposal. With the direct-hire flag and an active spend policy, it calls NEAR Market's paid `/mcp/pro` hire tool, records the real job ID, and follows the result. The first live hire and jobs above the automatic approval ceiling still require exact operator approval. The older no-charge marketplace draft path remains available. All live procurement flags default to off. The paid endpoint has not yet been verified with this buyer's connection; no paid hire or production deployment was performed. See [the live hiring runbook](docs/live-hiring.md).

`pnpm market:connect` runs the Phase 0 OAuth authorization-code flow with PKCE, validates state and issuer, stores tokens only in process memory, lists the live MCP tool catalog, and invokes the read-only `marketplace__whoami` check. It does not call a hiring tool.

See `docs/` for architecture and operations boundaries, `ASSUMPTIONS.md` for current blockers, and `TASKS.md` for delivery status.
