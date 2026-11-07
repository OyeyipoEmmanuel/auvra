import { NextResponse } from "next/server";

import { getApiUser } from "@/lib/authz";
import { createBachsCheckout } from "@/lib/live-funding";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getApiUser();
  if (!user) return NextResponse.json({ error: "Sign in is required." }, { status: 401 });
  const { id } = await params;
  const result = await createBachsCheckout(id, user.id);
  if (result.kind === "NOT_FOUND") return NextResponse.json(result, { status: 404 });
  if (result.kind !== "CHECKOUT_READY") return NextResponse.json(result, { status: 409 });
  return NextResponse.json(result);
}
