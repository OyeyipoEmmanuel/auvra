import { NextResponse } from "next/server";

import { getApiUser } from "@/lib/authz";
import { signFileTicket } from "@/lib/private-files";
import { prisma } from "@/lib/prisma";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getApiUser();
  if (!user) return NextResponse.json({ error: { code: "UNAUTHENTICATED" } }, { status: 401 });
  const { id } = await params;
  const file = await prisma.storedFile.findFirst({
    where: { id, ownerId: user.id, scanState: { in: ["VALIDATED", "CLEAN"] } },
    select: { id: true },
  });
  if (!file) return NextResponse.json({ error: { code: "NOT_FOUND" } }, { status: 404 });
  const ticket = signFileTicket({
    purpose: "download",
    ownerId: user.id,
    fileId: file.id,
    expiresAt: Date.now() + 60_000,
  });
  return NextResponse.json({
    url: `/api/files/${file.id}/download?ticket=${ticket}`,
    expiresInSeconds: 60,
  });
}
