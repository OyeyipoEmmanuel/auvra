import { AppShell } from "@/components/app-shell";
import { requirePageUser } from "@/lib/authz";

export default async function LegacyAppLayout({ children }: { children: React.ReactNode }) {
  const user = await requirePageUser();
  return <AppShell userName={user.name}>{children}</AppShell>;
}
