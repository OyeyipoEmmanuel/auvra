import { RequestIntake } from "@/components/request-intake";

export default function NewRequestPage() {
  return <RequestIntake minDate={new Date().toISOString().slice(0, 10)} />;
}
