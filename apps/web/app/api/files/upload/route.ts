import { createHash } from "node:crypto";
import { CreateBucketCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { NextResponse } from "next/server";

import { getApiUser } from "@/lib/authz";
import {
  hasValidFileSignature,
  MAX_FILE_BYTES,
  privateStore,
  verifyFileTicket,
} from "@/lib/private-files";
import { prisma } from "@/lib/prisma";

export async function PUT(request: Request) {
  const user = await getApiUser();
  if (!user) return error("UNAUTHENTICATED", 401);
  const token = new URL(request.url).searchParams.get("ticket") ?? "";
  const ticket = verifyFileTicket(token, "upload", user.id);
  if (!ticket?.fileName || !ticket.contentType || !ticket.sizeBytes || !ticket.sha256) {
    return error("INVALID_FILE_TICKET", 403);
  }
  if (Number(request.headers.get("content-length")) > MAX_FILE_BYTES)
    return error("FILE_TOO_LARGE", 413);
  if (request.headers.get("content-type") !== ticket.contentType)
    return error("FILE_TYPE_MISMATCH", 400);

  const existing = await prisma.storedFile.findUnique({
    where: { id: ticket.fileId },
    select: { ownerId: true, sha256: true },
  });
  if (existing) return error("FILE_TICKET_USED", 409);

  const reader = request.body?.getReader();
  if (!reader) return error("EMPTY_FILE", 400);
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_FILE_BYTES || size > ticket.sizeBytes) {
      await reader.cancel();
      return error("FILE_TOO_LARGE", 413);
    }
    chunks.push(value);
  }
  if (size !== ticket.sizeBytes) return error("FILE_SIZE_MISMATCH", 400);
  const bytes = Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)));
  if (createHash("sha256").update(bytes).digest("hex") !== ticket.sha256)
    return error("FILE_CHECKSUM_MISMATCH", 400);
  if (!hasValidFileSignature(bytes, ticket.contentType))
    return error("FILE_SIGNATURE_MISMATCH", 400);

  const objectKey = `customer/${user.id}/${ticket.fileId}`;
  try {
    const { client, bucket } = privateStore();
    const put = new PutObjectCommand({
      Bucket: bucket,
      Key: objectKey,
      Body: bytes,
      ContentType: ticket.contentType,
    });
    try {
      await client.send(put);
    } catch (reason) {
      const localEndpoint = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?\/?$/i.test(
        process.env.S3_ENDPOINT ?? "",
      );
      if (
        !localEndpoint ||
        !(reason instanceof Error) ||
        !["NoSuchBucket", "NotFound"].includes(reason.name)
      )
        throw reason;
      await client.send(new CreateBucketCommand({ Bucket: bucket }));
      await client.send(put);
    }
    await prisma.storedFile.create({
      data: {
        id: ticket.fileId,
        ownerId: user.id,
        objectKey,
        fileName: ticket.fileName,
        contentType: ticket.contentType,
        sizeBytes: BigInt(size),
        sha256: ticket.sha256,
        scanState: "VALIDATED",
      },
    });
  } catch {
    return error("FILE_STORAGE_UNAVAILABLE", 503);
  }
  return NextResponse.json(
    { file: { id: ticket.fileId, fileName: ticket.fileName, sizeBytes: size } },
    { status: 201 },
  );
}

function error(code: string, status: number) {
  return NextResponse.json({ error: { code } }, { status });
}
