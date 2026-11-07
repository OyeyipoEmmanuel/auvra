import { notFound, redirect } from "next/navigation";

import { RequestIntake } from "@/components/request-intake";
import { requirePageUser } from "@/lib/authz";
import { prisma } from "@/lib/prisma";

export default async function EditRequestPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePageUser();
  const { id } = await params;
  const draft = await prisma.serviceRequest.findFirst({
    where: { id, customerId: user.id },
    select: {
      id: true,
      state: true,
      rawBrief: true,
      desiredOutcome: true,
      budgetMinor: true,
      budgetCurrency: true,
      deadline: true,
      constraintsJson: true,
      files: { select: { id: true, fileName: true, sizeBytes: true } },
    },
  });
  if (!draft) notFound();
  if (draft.state !== "DRAFT") redirect(`/app/requests/${id}`);
  const constraints = Array.isArray(draft.constraintsJson)
    ? draft.constraintsJson.filter((value): value is string => typeof value === "string")
    : [];
  return (
    <RequestIntake
      minDate={new Date().toISOString().slice(0, 10)}
      draft={{
        id: draft.id,
        rawBrief: draft.rawBrief,
        desiredOutcome: draft.desiredOutcome,
        budgetMinor: draft.budgetMinor?.toString() ?? null,
        budgetCurrency: draft.budgetCurrency,
        deadline: draft.deadline?.toISOString() ?? null,
        constraints,
        files: draft.files.map((file) => ({ ...file, sizeBytes: Number(file.sizeBytes) })),
      }}
    />
  );
}
