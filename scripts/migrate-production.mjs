import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

if (process.env.VERCEL_ENV !== "production") {
  process.exit(0);
}

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl || !/^postgres(?:ql)?:\/\//.test(databaseUrl)) {
  throw new Error("A production PostgreSQL DATABASE_URL is required for migrations.");
}
if (["localhost", "127.0.0.1", "::1"].includes(new URL(databaseUrl).hostname)) {
  throw new Error("Production migrations cannot target a local database.");
}

const repositoryRoot = fileURLToPath(new URL("..", import.meta.url));
const migration = spawnSync("pnpm", ["exec", "prisma", "migrate", "deploy"], {
  cwd: repositoryRoot,
  env: process.env,
  stdio: "inherit",
  shell: process.platform === "win32",
});

if (migration.error) throw migration.error;
if (migration.status !== 0) process.exit(migration.status ?? 1);
