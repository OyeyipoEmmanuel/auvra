import { GetObjectCommand } from "@aws-sdk/client-s3";
import { NextResponse } from "next/server";

import { getApiUser } from "@/lib/authz";
import { privateStore, verifyFileTicket } from "@/lib/private-files";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getApiUser();
  if (!user) return NextResponse.json({ error: { code: "UNAUTHENTICATED" } }, { status: 401 });
  const { id } = await params;
  const ticket = verifyFileTicket(
    new URL(request.url).searchParams.get("ticket") ?? "",
    "download",
    user.id,
  );
  if (!ticket || ticket.fileId !== id)
    return NextResponse.json({ error: { code: "INVALID_FILE_TICKET" } }, { status: 403 });
  const file = await prisma.storedFile.findFirst({
    where: { id, ownerId: user.id, scanState: { in: ["VALIDATED", "CLEAN"] } },
  });
  if (!file) return NextResponse.json({ error: { code: "NOT_FOUND" } }, { status: 404 });
  try {
    const { client, bucket } = privateStore();
    const object = await client.send(new GetObjectCommand({ Bucket: bucket, Key: file.objectKey }));
    if (!object.Body) throw new Error("Missing file body");
    const bytes = await object.Body.transformToByteArray();
    return new Response(Buffer.from(bytes), {
      headers: {
        "Content-Type": file.contentType,
        "Content-Length": file.sizeBytes.toString(),
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(file.fileName)}`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return NextResponse.json({ error: { code: "FILE_STORAGE_UNAVAILABLE" } }, { status: 503 });
  }
}
