import { execFile } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { parse } from "dotenv";

const execFileAsync = promisify(execFile);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const envFile = path.join(root, ".env.local");
const localEnv = existsSync(envFile) ? parse(readFileSync(envFile)) : {};
const databaseUrl = process.env.DATABASE_URL ?? localEnv.DATABASE_URL;

if (!databaseUrl) {
  console.error("DATABASE_URL is missing. Add it to .env.local before starting the web app.");
  process.exit(1);
}

const database = new URL(databaseUrl);
const host = database.hostname;
const port = Number(database.port || 5432);
const localHost = ["localhost", "127.0.0.1", "::1"].includes(host);

async function portOpen() {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host: host === "localhost" ? "127.0.0.1" : host, port });
    socket.setTimeout(800);
    socket.once("connect", () => { socket.destroy(); resolve(true); });
    socket.once("error", () => { socket.destroy(); resolve(false); });
    socket.once("timeout", () => { socket.destroy(); resolve(false); });
  });
}

async function dockerReady() {
  try {
    await execFileAsync("docker", ["info", "--format", "{{.ServerVersion}}"], { timeout: 5000, windowsHide: true });
    return true;
  } catch {
    return false;
  }
}

async function postgresReady() {
  try {
    await execFileAsync("docker", ["compose", "exec", "-T", "postgres", "pg_isready", "-U", "auvra", "-d", "auvra"], {
      cwd: root,
      timeout: 5000,
      windowsHide: true,
    });
    return await portOpen();
  } catch {
    return false;
  }
}

async function waitUntil(check, attempts, intervalMs) {
  for (let attempt = 0; attempt < attempts; attempt++) {
    if (await check()) return true;
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  return false;
}

if (!localHost || (host !== "localhost" && host !== "127.0.0.1") || port !== 55432) {
  console.log("Using the configured external database; local Docker startup skipped.");
  process.exit(0);
}

if (await portOpen() && await postgresReady()) process.exit(0);

console.log("Local PostgreSQL is offline. Starting the Auvra database...");
if (!(await dockerReady())) {
  if (process.platform === "win32") {
    const desktop = path.join(process.env.PROGRAMFILES || "C:\\Program Files", "Docker", "Docker", "Docker Desktop.exe");
    if (existsSync(desktop)) {
      const { spawn } = await import("node:child_process");
      const child = spawn(desktop, [], { detached: true, stdio: "ignore", windowsHide: true });
      child.unref();
    }
  }
  if (!(await waitUntil(dockerReady, 30, 3000))) {
    console.error("Docker Desktop did not start. Open Docker Desktop, then run pnpm dev:web again.");
    process.exit(1);
  }
}

try {
  await execFileAsync("docker", ["compose", "up", "-d", "postgres", "--no-deps"], {
    cwd: root,
    timeout: 30000,
    windowsHide: true,
  });
} catch (error) {
  console.error("Could not start Auvra PostgreSQL:", error.stderr?.trim() || error.message);
  process.exit(1);
}

if (!(await waitUntil(postgresReady, 30, 1000))) {
  console.error("Auvra PostgreSQL did not become available on port 55432.");
  process.exit(1);
}

console.log("Auvra PostgreSQL is ready.");
