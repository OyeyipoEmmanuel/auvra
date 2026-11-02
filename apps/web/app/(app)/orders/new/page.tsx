import { redirect } from "next/navigation";

export default function LegacyNewOrderPage() {
  redirect("/app/requests/new");
}
