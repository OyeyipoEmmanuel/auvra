import { afterAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const path = "../apps/web/lib/private-files.ts";
const files = (await import(path)) as {
  signFileTicket: (value: Record<string, unknown>) => string;
  verifyFileTicket: (token: string, purpose: "upload" | "download", ownerId: string) => unknown;
  hasValidFileSignature: (bytes: Uint8Array, contentType: string) => boolean;
};

const originalSecret = process.env.AUTH_SECRET;
process.env.AUTH_SECRET = "test-secret-that-is-long-enough-for-file-ticket-tests";
afterAll(() => {
  if (originalSecret === undefined) delete process.env.AUTH_SECRET;
  else process.env.AUTH_SECRET = originalSecret;
});

describe("private file tickets", () => {
  const ownerId = "11111111-1111-4111-8111-111111111111";
  const fileId = "22222222-2222-4222-8222-222222222222";

  it("binds the upload ticket to the user, purpose, file, and expiry", () => {
    const token = files.signFileTicket({
      purpose: "upload",
      ownerId,
      fileId,
      fileName: "brief.txt",
      contentType: "text/plain",
      sizeBytes: 5,
      sha256: "a".repeat(64),
      expiresAt: Date.now() + 60_000,
    });
    expect(files.verifyFileTicket(token, "upload", ownerId)).toMatchObject({ fileId });
    expect(files.verifyFileTicket(token, "download", ownerId)).toBeNull();
    expect(
      files.verifyFileTicket(token, "upload", "33333333-3333-4333-8333-333333333333"),
    ).toBeNull();
    expect(files.verifyFileTicket(`${token}x`, "upload", ownerId)).toBeNull();
  });

  it("rejects expired tickets and mismatched file signatures", () => {
    const expired = files.signFileTicket({
      purpose: "download",
      ownerId,
      fileId,
      expiresAt: Date.now() - 1,
    });
    expect(files.verifyFileTicket(expired, "download", ownerId)).toBeNull();
    expect(files.hasValidFileSignature(Buffer.from("not a PDF"), "application/pdf")).toBe(false);
    expect(files.hasValidFileSignature(Buffer.from("%PDF-1.7"), "application/pdf")).toBe(true);
  });
});
