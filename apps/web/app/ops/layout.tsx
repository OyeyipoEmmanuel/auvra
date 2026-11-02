import { requirePageRole } from "@/lib/authz";

export default async function OperationsLayout({ children }: { children: React.ReactNode }) {
  await requirePageRole(["OPERATOR", "ADMIN"]);
  return <div className="min-h-screen bg-[#09090a] text-white">{children}</div>;
}
