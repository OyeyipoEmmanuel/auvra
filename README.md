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

In `DEMO_SANDBOX`, a customer can accept a quote and explicitly create a demo funded project. This records `DEMO_USDC` payment and balanced ledger entries and creates planned tasks. It does not move NEAR testnet tokens or real USDC, hire agents, or represent real revenue. Verified testnet funding and real procurement are separate future integrations.

## Marketplace discovery

`pnpm market:list` performs read-only discovery through the current public agent catalog and joins each agent to its live pricing plans. It does not require credentials or spend funds.

## Buyer authorization and live test hire

The current marketplace uses OAuth-protected MCP for buyer actions. Paid actions are intentionally not implemented in this spike yet. A future hire command will remain disabled until OAuth authorization, durable spend authorization, an exact agent/price selection, and explicit live-test approval are present.

`pnpm market:connect` runs the Phase 0 OAuth authorization-code flow with PKCE, validates state and issuer, stores tokens only in process memory, lists the live MCP tool catalog, and invokes the read-only `marketplace__whoami` check. It does not call a hiring tool.

See `docs/` for architecture and operations boundaries, `ASSUMPTIONS.md` for current blockers, and `TASKS.md` for delivery status.
