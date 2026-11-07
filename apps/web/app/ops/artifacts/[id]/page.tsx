import Link from "next/link";
import { notFound } from "next/navigation";

import { OperatorQaReview } from "@/components/operator-qa-review";
import { requirePageRole } from "@/lib/authz";
import { prisma } from "@/lib/prisma";

export default async function OperatorArtifactPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePageRole(["OPERATOR", "ADMIN"]);
  const { id } = await params;
  const artifact = await prisma.artifact.findUnique({
    where: { id },
    include: {
      supplierJob: { select: { id: true, state: true, task: { select: { title: true } } } },
      qaReviews: { orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 10 },
    },
  });
  if (!artifact) notFound();
  const latest = artifact.qaReviews[0];
  const evidence = latest?.evidenceJson;
  const checks =
    evidence &&
    typeof evidence === "object" &&
    !Array.isArray(evidence) &&
    Array.isArray(evidence.acceptanceChecks) &&
    evidence.acceptanceChecks.every((check) => typeof check === "string")
      ? (evidence.acceptanceChecks as string[])
      : [];
  const metadata = artifact.metadataJson;
  const text =
    metadata &&
    typeof metadata === "object" &&
    !Array.isArray(metadata) &&
    typeof metadata.text === "string"
      ? metadata.text
      : null;
  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <Link
        href={`/ops/projects/${artifact.projectId}`}
        className="text-[14px] text-zinc-400 hover:text-white"
      >
        Back to project
      </Link>
      <h1 className="mt-7 text-3xl font-semibold">Deliverable review</h1>
      <p className="mt-2 text-[14px] text-zinc-400">
        {artifact.supplierJob?.task.title ?? "Unassigned artifact"} · {artifact.kind} ·{" "}
        {latest?.result ?? "No QA result"}
      </p>
      {text ? (
        <pre className="mt-7 max-h-[650px] overflow-auto whitespace-pre-wrap break-words rounded-xl border border-zinc-800 bg-zinc-950 p-5 text-[14px] leading-6 text-zinc-200">
          {text}
        </pre>
      ) : artifact.externalUrl ? (
        <p className="mt-7 rounded-xl border border-amber-700/40 p-5 text-[14px] text-amber-100">
          External reference:{" "}
          <a
            href={artifact.externalUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="underline"
          >
            Open on NEAR Market
          </a>
          . Verify the content and destination before approving.
        </p>
      ) : (
        <p className="mt-7 text-[14px] text-amber-100">
          No preview is available. Do not approve without inspecting the private source.
        </p>
      )}
      {latest?.result === "NEEDS_QUALITATIVE_REVIEW" &&
        artifact.supplierJob?.state === "SUBMITTED" &&
        checks.length > 0 && (
          <OperatorQaReview
            artifactId={id}
            checks={checks}
          />
        )}
      <section className="mt-9">
        <h2 className="text-lg font-semibold">QA history</h2>
        <ul className="mt-3 space-y-2 text-[14px] text-zinc-400">
          {artifact.qaReviews.map((review) => (
            <li key={review.id}>
              {review.result} · {review.policyVersion} · {review.createdAt.toLocaleString()}
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
