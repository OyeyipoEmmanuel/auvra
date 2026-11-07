import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { S3Client } from "@aws-sdk/client-s3";
import { z } from "zod";

export const MAX_FILE_BYTES = 10 * 1024 * 1024;
export const MAX_FILES_PER_REQUEST = 10;
export const allowedFileTypes = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
  "text/plain",
  "text/csv",
] as const;

const ticketSchema = z.object({
  purpose: z.enum(["upload", "download"]),
  ownerId: z.string().uuid(),
  fileId: z.string().uuid(),
  fileName: z.string().min(1).max(200).optional(),
  contentType: z.enum(allowedFileTypes).optional(),
  sizeBytes: z.number().int().positive().max(MAX_FILE_BYTES).optional(),
  sha256: z
    .string()
    .regex(/^[a-f0-9]{64}$/)
    .optional(),
  expiresAt: z.number().int().positive(),
});

type FileTicket = z.infer<typeof ticketSchema>;

function secret() {
  const value = process.env.AUTH_SECRET;
  if (!value || value.length < 32)
    throw new Error("AUTH_SECRET must be configured for file tickets.");
  return value;
}

export function signFileTicket(ticket: FileTicket) {
  const payload = Buffer.from(JSON.stringify(ticket)).toString("base64url");
  const signature = createHmac("sha256", secret()).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

export function verifyFileTicket(token: string, purpose: FileTicket["purpose"], ownerId: string) {
  const [payload, received, extra] = token.split(".");
  if (!payload || !received || extra) return null;
  const expected = createHmac("sha256", secret()).update(payload).digest();
  let actual: Buffer;
  try {
    actual = Buffer.from(received, "base64url");
  } catch {
    return null;
  }
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;
  try {
    const parsed = ticketSchema.safeParse(JSON.parse(Buffer.from(payload, "base64url").toString()));
    if (!parsed.success) return null;
    const ticket = parsed.data;
    if (ticket.purpose !== purpose || ticket.ownerId !== ownerId || ticket.expiresAt < Date.now()) {
      return null;
    }
    return ticket;
  } catch {
    return null;
  }
}

let storage: S3Client | null = null;

export function privateStore() {
  if (!storage) {
    const endpoint = process.env.S3_ENDPOINT;
    const accessKeyId = process.env.S3_ACCESS_KEY;
    const secretAccessKey = process.env.S3_SECRET_KEY;
    if (!endpoint || !accessKeyId || !secretAccessKey || !process.env.S3_BUCKET) {
      throw new Error("Private object storage is not configured.");
    }
    storage = new S3Client({
      endpoint,
      region: process.env.S3_REGION ?? "us-east-1",
      forcePathStyle: true,
      credentials: { accessKeyId, secretAccessKey },
    });
  }
  return { client: storage, bucket: process.env.S3_BUCKET! };
}

export function hasValidFileSignature(bytes: Uint8Array, contentType: string) {
  if (contentType === "application/pdf")
    return Buffer.from(bytes.subarray(0, 5)).toString() === "%PDF-";
  if (contentType === "image/png")
    return Buffer.from(bytes.subarray(0, 8)).equals(Buffer.from("89504e470d0a1a0a", "hex"));
  if (contentType === "image/jpeg")
    return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (contentType === "image/webp")
    return (
      Buffer.from(bytes.subarray(0, 4)).toString() === "RIFF" &&
      Buffer.from(bytes.subarray(8, 12)).toString() === "WEBP"
    );
  if (contentType === "text/plain" || contentType === "text/csv") {
    try {
      return (
        !bytes.includes(0) && new TextDecoder("utf-8", { fatal: true }).decode(bytes).length > 0
      );
    } catch {
      return false;
    }
  }
  return false;
}
