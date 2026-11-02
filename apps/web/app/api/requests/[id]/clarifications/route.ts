import { NextResponse } from "next/server";

import { getApiUser } from "@/lib/authz";
import { saveClarificationAnswers } from "@/lib/manager-service";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getApiUser();
  if (!user) return NextResponse.json({ error: { code: "UNAUTHENTICATED", message: "Sign in is required." } }, { status: 401 });
  const { id } = await params;
  const body = await request.json().catch(() => null) as { answers?: unknown } | null;
  const result = await saveClarificationAnswers(id, user.id, body?.answers);
  if (result.kind === "NOT_FOUND") return NextResponse.json({ error: { code: "NOT_FOUND", message: "Request not found." } }, { status: 404 });
  if (result.kind === "INVALID_STATE") return NextResponse.json({ error: { code: "INVALID_STATE", message: `Clarifications cannot be submitted from ${result.state}.` } }, { status: 409 });
  if (result.kind === "INVALID_ANSWERS" || result.kind === "INCOMPLETE_ANSWERS") return NextResponse.json({ error: { code: result.kind, message: "Answer every clarification question before continuing." } }, { status: 400 });
  return NextResponse.json(result);
}
