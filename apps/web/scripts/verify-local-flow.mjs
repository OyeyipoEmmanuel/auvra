import { createHash, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { DeleteObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { parse } from "dotenv";
import pg from "pg";

const rootEnv = parse(readFileSync(fileURLToPath(new URL("../../../.env.local", import.meta.url))));
const databaseUrl = rootEnv.DATABASE_URL;
if (!databaseUrl || !["localhost", "127.0.0.1"].includes(new URL(databaseUrl).hostname)) {
  throw new Error("This verification script only runs against the local development database.");
}

const database = new pg.Client({ connectionString: databaseUrl });
const baseUrl = "http://localhost:3000";
const ids = { first: randomUUID(), second: randomUUID(), request: null, file: null };
const tokens = { first: randomUUID(), second: randomUUID() };

async function api(path, token, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: { Cookie: `authjs.session-token=${token}`, ...options.headers },
  });
  const contentType = response.headers.get("content-type") ?? "";
  const body = contentType.includes("application/json")
    ? await response.json()
    : await response.text();
  return { response, body };
}

function expectStatus(result, status, label) {
  if (result.response.status !== status) {
    throw new Error(
      `${label}: expected ${status}, got ${result.response.status}: ${JSON.stringify(result.body)}`,
    );
  }
}

await database.connect();
try {
  for (const [id, label] of [
    [ids.first, "first"],
    [ids.second, "second"],
  ]) {
    await database.query(
      'INSERT INTO "User" (id, email, role, "createdAt", "updatedAt") VALUES ($1, $2, $3, NOW(), NOW())',
      [id, `auvra-local-flow-${id}@example.invalid`, "CUSTOMER"],
    );
    await database.query(
      'INSERT INTO "Session" ("sessionToken", "userId", expires) VALUES ($1, $2, NOW() + INTERVAL \'1 hour\')',
      [tokens[label], id],
    );
  }

  expectStatus(await api("/api/auth/session", tokens.first), 200, "Session restore");

  const draft = await api("/api/requests", tokens.first, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Idempotency-Key": randomUUID() },
    body: JSON.stringify({
      mode: "DRAFT",
      rawBrief: "Build a landing page for my business.",
      constraints: [],
    }),
  });
  expectStatus(draft, 201, "Create draft");
  ids.request = draft.body.request.id;

  const otherCustomer = await api(`/api/requests/${ids.request}`, tokens.second);
  expectStatus(otherCustomer, 404, "Cross-user request isolation");

  const updated = await api(`/api/requests/${ids.request}`, tokens.first, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      rawBrief: "Build a landing page for my accounting business.",
      constraints: ["Use purple branding."],
    }),
  });
  expectStatus(updated, 200, "Update draft");

  const contents = Buffer.from("Auvra private reference file\n", "utf8");
  const uploadTicket = await api("/api/files/upload-ticket", tokens.first, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      fileName: "reference.txt",
      contentType: "text/plain",
      sizeBytes: contents.length,
      sha256: createHash("sha256").update(contents).digest("hex"),
    }),
  });
  expectStatus(uploadTicket, 200, "Upload ticket");
  const uploaded = await api(uploadTicket.body.uploadUrl, tokens.first, {
    method: "PUT",
    headers: { "Content-Type": "text/plain" },
    body: contents,
  });
  expectStatus(uploaded, 201, "Private upload");
  ids.file = uploaded.body.file.id;

  const submitted = await api(`/api/requests/${ids.request}/submit`, tokens.first, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      rawBrief: "Build a landing page for my accounting business.",
      constraints: ["Use purple branding."],
      attachmentIds: [ids.file],
      consentToExternalAgentProcessing: true,
    }),
  });
  expectStatus(submitted, 200, "Submit draft with attachment");

  expectStatus(
    await api(`/api/files/${ids.file}/download-link`, tokens.second),
    404,
    "Cross-user file isolation",
  );
  const link = await api(`/api/files/${ids.file}/download-link`, tokens.first);
  expectStatus(link, 200, "Signed download link");
  const downloaded = await api(link.body.url, tokens.first);
  expectStatus(downloaded, 200, "Private download");
  if (downloaded.body !== contents.toString()) throw new Error("Downloaded file content changed.");

  const csrfResponse = await fetch(`${baseUrl}/api/auth/csrf`, {
    headers: { Cookie: `authjs.session-token=${tokens.first}` },
  });
  if (!csrfResponse.ok) throw new Error("Could not get a sign-out CSRF token.");
  const { csrfToken } = await csrfResponse.json();
  const csrfCookie = csrfResponse.headers.get("set-cookie")?.split(";")[0];
  if (!csrfCookie) throw new Error("Sign-out CSRF cookie was not set.");
  const signout = await fetch(`${baseUrl}/api/auth/signout`, {
    method: "POST",
    redirect: "manual",
    headers: {
      Cookie: `authjs.session-token=${tokens.first}; ${csrfCookie}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ csrfToken, callbackUrl: `${baseUrl}/login` }),
  });
  if (![200, 302, 303].includes(signout.status))
    throw new Error(`Sign-out failed: ${signout.status}`);
  const remaining = await database.query(
    'SELECT COUNT(*)::int AS count FROM "Session" WHERE "sessionToken" = $1',
    [tokens.first],
  );
  if (remaining.rows[0].count !== 0)
    throw new Error("Sign-out did not revoke the database session.");
  expectStatus(await api("/api/requests", tokens.first), 401, "Session revocation");
  process.stdout.write(
    "Local identity, ownership, draft, upload, submit, download, and session revocation passed.\n",
  );
} finally {
  if (ids.request) {
    await database.query('DELETE FROM "StoredFile" WHERE "requestId" = $1', [ids.request]);
    await database.query('DELETE FROM "ServiceRequest" WHERE id = $1', [ids.request]);
    await database.query('DELETE FROM "AuditEvent" WHERE "requestId" = $1', [ids.request]);
    await database.query('DELETE FROM "OutboxEvent" WHERE "aggregateId" = $1', [ids.request]);
  }
  if (ids.file) {
    await database.query('DELETE FROM "StoredFile" WHERE id = $1', [ids.file]);
    const storage = new S3Client({
      endpoint: rootEnv.S3_ENDPOINT,
      region: "us-east-1",
      forcePathStyle: true,
      credentials: { accessKeyId: rootEnv.S3_ACCESS_KEY, secretAccessKey: rootEnv.S3_SECRET_KEY },
    });
    await storage
      .send(
        new DeleteObjectCommand({
          Bucket: rootEnv.S3_BUCKET,
          Key: `customer/${ids.first}/${ids.file}`,
        }),
      )
      .catch(() => {});
    storage.destroy();
  }
  await database.query('DELETE FROM "IdempotencyRecord" WHERE scope = $1', [
    `request:create:${ids.first}`,
  ]);
  await database.query('DELETE FROM "Session" WHERE "userId" IN ($1, $2)', [ids.first, ids.second]);
  await database.query('DELETE FROM "User" WHERE id IN ($1, $2)', [ids.first, ids.second]);
  await database.end();
}
