import { NextResponse } from "next/server";

import { getApiUser } from "@/lib/authz";
import { getNoChargeProjectReceipt, noChargeReceiptDocument } from "@/lib/project-receipt";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getApiUser();
  if (!user) return NextResponse.json({ error: "Sign in is required." }, { status: 401 });
  const { id } = await params;
  const receipt = await getNoChargeProjectReceipt(id, user.id);
  if (!receipt) return NextResponse.json({ error: "Receipt not found." }, { status: 404 });
  return new NextResponse(JSON.stringify(noChargeReceiptDocument(receipt), null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="auvra-project-${id.slice(0, 8)}-receipt.json"`,
      "Cache-Control": "private, no-store",
    },
  });
}
