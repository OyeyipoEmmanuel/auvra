import { NextResponse } from "next/server";

import { getApiUser } from "@/lib/authz";

export async function GET() {
  const user = await getApiUser();
  if (!user) return NextResponse.json({ error: { code: "UNAUTHENTICATED", message: "Sign in is required." } }, { status: 401 });

  return NextResponse.json({ user: { id: user.id, name: user.name, email: user.email, image: user.image, role: user.role } });
}
