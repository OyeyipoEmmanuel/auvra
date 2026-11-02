# Auvra architecture

## Product boundary

Auvra is the customer-facing prime contractor. NEAR Agent Market is a server-side supplier network. Customers submit an outcome, approve one Auvra quote, and receive one accountable delivery experience; they do not select marketplace agents as a required workflow.

## Deployable services

- `apps/web`: Next.js customer and operator UI, Auth.js, request APIs, ownership checks, and read models.
- `apps/worker`: planned Node.js/BullMQ orchestration, marketplace calls, monitoring, QA, reconciliation, and receipt anchoring.
- `contracts/auvra-receipts`: planned narrow Rust/NEAR evidence registry. It will never custody money.

PostgreSQL is business truth. Redis queues are transient execution infrastructure. Private attachments and deliverables use S3-compatible object storage.

## Security boundary

Every protected read and write must resolve a durable server-side session, apply ownership or role checks near the data access, validate its input, and emit an audit record. UI visibility and route redirects are never authorization controls by themselves.

## Side-effect boundary

Model output may recommend analysis, plans, matching, and QA. Deterministic code alone may change lifecycle state, reserve budget, authorize procurement, accept deliverables, post ledger entries, or anchor receipts.

## Runtime modes

- `DEMO_SANDBOX`: no live supplier or customer-payment claims.
- `LIVE_MARKET`: genuine read/write marketplace integration, still requiring explicit spend authorization and verified funding.

The application fails closed when live mode lacks the required provider configuration.
