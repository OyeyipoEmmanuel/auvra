import { NextResponse } from "next/server";

import { getApiUser } from "@/lib/authz";
import { discoverSuppliersAndQuote } from "@/lib/supplier-discovery";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getApiUser();
  if (!user)
    return NextResponse.json(
      { error: { code: "UNAUTHENTICATED", message: "Sign in is required." } },
      { status: 401 },
    );
  const { id } = await params;
  try {
    const result = await discoverSuppliersAndQuote(id, user.id);
    if (result.kind === "NOT_FOUND")
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Request not found." } },
        { status: 404 },
      );
    if (result.kind === "INVALID_STATE")
      return NextResponse.json(
        {
          error: {
            code: "INVALID_STATE",
            message: `Supplier discovery cannot run from ${result.state}.`,
          },
        },
        { status: 409 },
      );
    if (result.kind === "FUNDING_RAIL_UNAVAILABLE")
      return NextResponse.json(
        {
          error: {
            code: "FUNDING_RAIL_UNAVAILABLE",
            message: "Live customer checkout is not configured. No supplier quote was created.",
          },
        },
        { status: 503 },
      );
    return NextResponse.json(result);
  } catch (error) {
    console.error("Supplier discovery failed", error);
    return NextResponse.json(
      {
        error: {
          code: "MARKETPLACE_UNAVAILABLE",
          message:
            "The live supplier catalog could not be checked. No quote or purchase was created.",
        },
      },
      { status: 502 },
    );
  }
}
