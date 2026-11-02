# Vercel web deployment and future Render worker

## Current deployment

The `auvra` Vercel project builds `apps/web` from `main` at `https://auvra-tau.vercel.app`. Its Production environment uses the `prisma-postgres-cobalt-castle` Prisma Postgres database. The Next.js app currently hosts the frontend, Auth.js, API routes, and manager logic. Web Analytics is enabled on the included Hobby plan. The Google OAuth client still needs the production origin and callback added in Google Cloud before sign-in can complete.

## If you choose Prisma Postgres through the Vercel integration

Prisma Postgres replaces Render PostgreSQL in this setup. Connect the database to the Auvra Vercel project for **Production** and leave **Custom Prefix** empty. The integration supplies `DATABASE_URL` for Prisma CLI migrations and `DATABASE_URL_POOLED` for application traffic; `apps/web/lib/prisma.ts` prefers the pooled URL. The production web build runs the committed migrations before `next build` and fails if the database URL is missing or local. Use another database for Preview or Development so they do not share production records. Render can still host the future worker, which must be given its own database connection secret when built.

## What can be deployed now

The current app's Auth.js callback, `/api/**` routes, manager analysis, supplier discovery, quotes, and sandbox funding all run inside the Next.js app on Vercel. There is no separate Render API service in this repository yet. A future durable orchestration worker belongs on Render.

## Vercel project

1. Import the repository as a pnpm monorepo and set **Root Directory** to `apps/web` with the **Next.js** framework preset.
2. Enable **Include source files outside of the Root Directory in the Build Step**. The web build generates Prisma Client from the repository-level `prisma/` schema and imports `packages/contracts`.
3. Keep the build command from `apps/web/vercel.json` (`pnpm run build`). The package script generates Prisma Client before `next build`.
4. Connect Prisma Postgres to Production so the integration supplies `DATABASE_URL` and `DATABASE_URL_POOLED`. Set `AUTH_SECRET`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, `AUTH_URL=https://auvra-tau.vercel.app`, `AUVRA_RUNTIME_MODE=DEMO_SANDBOX`, and `MARKETPLACE_WRITES_ENABLED=false`. The marketplace base URL defaults to `https://market.near.ai`. Do not copy local `localhost` URLs or local Docker credentials to production.
5. Add `https://auvra-tau.vercel.app/api/auth/callback/google` as an authorized redirect URI for the Google OAuth client and `https://auvra-tau.vercel.app` as an authorized JavaScript origin.
6. Enable **Web Analytics** for the Vercel project in the Vercel dashboard. The root layout already mounts `@vercel/analytics/next`.

## Render services

1. Create a Render worker service when the queue and durable orchestration code is implemented. Give it a separate database connection secret with the minimum access it needs.
2. Do not deploy `apps/web` again as a Render web service to simulate a separate backend. That would create a second copy of the same API and auth app.

## If all backend logic must run on Render

That requires a separate API service. Move the current Next.js route handlers, Auth.js session handling, and server-side business services behind that API, then change the frontend's relative `/api/**` calls and protected server-rendered pages to use it. Plan the cross-origin cookie/session boundary and CORS before that split. The current repository does not implement this architecture.
