import { redirect } from "next/navigation";
import type { UserRole } from "@prisma/client";

import { auth } from "@/auth";

export async function requirePageUser() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  return session.user;
}

export async function requirePageRole(allowedRoles: readonly UserRole[]) {
  const user = await requirePageUser();
  if (!allowedRoles.includes(user.role)) redirect("/app");
  return user;
}

export async function getApiUser() {
  const session = await auth();
  return session?.user?.id ? session.user : null;
}
