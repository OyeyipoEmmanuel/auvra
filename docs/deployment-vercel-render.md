# Vercel and Render deployment

## If you choose Prisma Postgres through the Vercel integration

Prisma Postgres replaces Render PostgreSQL in this setup. Connect the database to the Auvra Vercel project for **Production** and leave **Custom Prefix** empty. The integration supplies `DATABASE_URL` for Prisma CLI migrations and `DATABASE_URL_POOLED` for application traffic; `apps/web/lib/prisma.ts` prefers the pooled URL. Use another database for Preview or Development so they do not share production records. Render can still host the future worker, which must be given its own database connection secret when built.

## What can be deployed now

Deploy `apps/web` as one Next.js project on Vercel and PostgreSQL as a managed database on Render. The current app's Auth.js callback, `/api/**` routes, manager analysis, supplier discovery, quotes, and sandbox funding all run inside the Next.js app, so they will execute on Vercel. There is no separate Render API service in this repository yet. A future durable orchestration worker belongs on Render.

## Vercel project

1. Import the repository as a pnpm monorepo and set **Root Directory** to `apps/web` with the **Next.js** framework preset.
2. Enable **Include source files outside of the Root Directory in the Build Step**. The web build generates Prisma Client from the repository-level `prisma/` schema and imports `packages/contracts`.
3. Keep the build command from `apps/web/vercel.json` (`pnpm run build`). The package script generates Prisma Client before `next build`.
4. Set these production environment variables in Vercel: `DATABASE_URL` (Render's external pooled PostgreSQL URL with TLS), `AUTH_SECRET`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, `AUTH_URL` (the final HTTPS app origin), `AUVRA_RUNTIME_MODE=DEMO_SANDBOX`, `MARKETPLACE_WRITES_ENABLED=false`, and `NEAR_MARKET_BASE_URL=https://market.near.ai`. Do not copy local `localhost` URLs or local Docker credentials to production.
5. Add `https://YOUR_DOMAIN/api/auth/callback/google` as an authorized redirect URI for the Google OAuth client. Set the matching production origin in its authorized JavaScript origins. Use the final domain, not a temporary preview URL, for the production OAuth configuration.
6. Enable **Web Analytics** for the Vercel project in the Vercel dashboard. The root layout already mounts `@vercel/analytics/next`.

## Render services

1. Create Render PostgreSQL. Use its **external pooled** connection URL for Vercel and require TLS. A Render-hosted worker should use the database's internal URL when it exists.
2. Apply the committed Prisma migrations to the Render database with `prisma migrate deploy` from a trusted deployment environment. Use the database's direct connection URL for migrations, kept in that environment's secret settings.
3. Do not deploy `apps/web` again as a Render web service to simulate a separate backend. That would create a second copy of the same API and auth app. Create a Render worker service when the queue and orchestration code is implemented.

## If all backend logic must run on Render

That requires a separate API service. Move the current Next.js route handlers, Auth.js session handling, and server-side business services behind that API, then change the frontend's relative `/api/**` calls and protected server-rendered pages to use it. Plan the cross-origin cookie/session boundary and CORS before that split. The current repository does not implement this architecture.
