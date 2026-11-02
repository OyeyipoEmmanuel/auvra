import { NextResponse } from "next/server";

import { getApiUser } from "@/lib/authz";
import { fundAcceptedQuoteInSandbox } from "@/lib/sandbox-funding";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getApiUser();
  if (!user) return NextResponse.json({ error: { code: "UNAUTHENTICATED", message: "Sign in is required." } }, { status: 401 });
  const { id } = await params;
  const result = await fundAcceptedQuoteInSandbox(id, user.id);
  if (result.kind === "NOT_FOUND") return NextResponse.json({ error: { code: "NOT_FOUND", message: "Quote not found." } }, { status: 404 });
  if (result.kind === "DISABLED") return NextResponse.json({ error: { code: "DISABLED", message: "Demo funding is available only in the sandbox with marketplace writes disabled." } }, { status: 403 });
  if (result.kind === "INVALID_STATE" || result.kind === "INVALID_QUOTE" || result.kind === "CONFLICT") return NextResponse.json({ error: { code: result.kind, message: "The accepted quote cannot be demo funded in its current state. Refresh and review it again." } }, { status: 409 });
  return NextResponse.json(result);
}
