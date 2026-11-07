import { NextResponse } from "next/server";
import { z } from "zod";

import { getApiUser } from "@/lib/authz";
import { allowedFileTypes, MAX_FILE_BYTES, signFileTicket } from "@/lib/private-files";
import { prisma } from "@/lib/prisma";
import { withinRateLimit } from "@/lib/rate-limit";

const fileMetadata = z.object({
  fileName: z
    .string()
    .trim()
    .min(1)
    .max(200)
    .refine((name) => !/[\\/\r\n\0]/.test(name)),
  contentType: z.enum(allowedFileTypes),
  sizeBytes: z.number().int().positive().max(MAX_FILE_BYTES),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
});

export async function POST(request: Request) {
  const user = await getApiUser();
  if (!user) return NextResponse.json({ error: { code: "UNAUTHENTICATED" } }, { status: 401 });
  if (!(await withinRateLimit("file-upload-ticket", user.id, 20))) {
    return NextResponse.json({ error: { code: "RATE_LIMITED" } }, { status: 429 });
  }
  const parsed = fileMetadata.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: { code: "INVALID_FILE_METADATA" } }, { status: 400 });
  }
  const pendingCount = await prisma.storedFile.count({
    where: { ownerId: user.id, requestId: null },
  });
  if (pendingCount >= 20) {
    return NextResponse.json({ error: { code: "UPLOAD_LIMIT_REACHED" } }, { status: 429 });
  }
  const fileId = crypto.randomUUID();
  const ticket = signFileTicket({
    purpose: "upload",
    ownerId: user.id,
    fileId,
    ...parsed.data,
    expiresAt: Date.now() + 5 * 60_000,
  });
  return NextResponse.json({
    fileId,
    uploadUrl: `/api/files/upload?ticket=${ticket}`,
    expiresInSeconds: 300,
  });
}
