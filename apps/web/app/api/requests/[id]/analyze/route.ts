import { NextResponse } from "next/server";

import { getApiUser } from "@/lib/authz";
import { runManagerAnalysis } from "@/lib/manager-service";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getApiUser();
  if (!user)
    return NextResponse.json(
      { error: { code: "UNAUTHENTICATED", message: "Sign in is required." } },
      { status: 401 },
    );
  const { id } = await params;
  const result = await runManagerAnalysis(id, user.id);
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
          message: `This request cannot be analyzed from ${result.state}.`,
        },
      },
      { status: 409 },
    );
  return NextResponse.json(result);
}
