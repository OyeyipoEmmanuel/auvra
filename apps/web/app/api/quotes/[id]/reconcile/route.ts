import { NextResponse } from "next/server";

import { getApiUser } from "@/lib/authz";
import { reconcileBachsCheckout } from "@/lib/live-funding";
import { withinRateLimit } from "@/lib/rate-limit";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getApiUser();
  if (!user) return NextResponse.json({ error: "Sign in is required." }, { status: 401 });
  const { id } = await params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return NextResponse.json({ error: "Quote not found." }, { status: 404 });
  }
  if (!(await withinRateLimit("bachs-reconcile", user.id, 8, 15 * 60_000))) {
    return NextResponse.json(
      { error: "Too many payment checks. Try again later." },
      { status: 429 },
    );
  }

  try {
    const result = await reconcileBachsCheckout(id, user.id);
    if (result.kind === "NOT_FOUND") return NextResponse.json(result, { status: 404 });
    if (result.kind === "DISABLED") return NextResponse.json(result, { status: 503 });
    if (result.kind === "VERIFICATION_MISMATCH") return NextResponse.json(result, { status: 409 });
    return NextResponse.json(result);
  } catch (error) {
    console.error("Bachs checkout reconciliation failed", error);
    return NextResponse.json(
      { kind: "PROVIDER_UNAVAILABLE", message: "Payment could not be checked right now." },
      { status: 502 },
    );
  }
}
