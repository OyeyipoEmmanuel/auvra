import Link from "next/link";

import { OperatorPolicyToggle } from "@/components/operator-policy-toggle";
import { requirePageRole } from "@/lib/authz";
import { prisma } from "@/lib/prisma";

export default async function OperatorPoliciesPage() {
  const user = await requirePageRole(["OPERATOR", "ADMIN"]);
  const [policies, approvals] = await Promise.all([
    prisma.policyVersion.findMany({
      orderBy: [{ policyKey: "asc" }, { version: "desc" }],
      take: 50,
    }),
    prisma.approval.findMany({ orderBy: { createdAt: "desc" }, take: 30 }),
  ]);
  const active = policies.find(
    (policy) => policy.policyKey === "LIVE_PROCUREMENT" && policy.active,
  );
  const activeRules =
    active?.rulesJson && typeof active.rulesJson === "object" && !Array.isArray(active.rulesJson)
      ? (active.rulesJson as Record<string, unknown>)
      : null;
  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <Link
        href="/ops"
        className="text-[14px] text-zinc-400 hover:text-white"
      >
        ← Operations
      </Link>
      <h1 className="mt-7 text-3xl font-semibold tracking-tight">Policies and approvals</h1>
      <p className="mt-3 max-w-3xl text-[15px] leading-6 text-zinc-400">
        Versioned controls recorded in PostgreSQL. Pause changes are audited; supplier hiring still
        has separate gates.
      </p>
      {active && typeof activeRules?.paused === "boolean" && (
        <OperatorPolicyToggle
          version={active.version}
          paused={activeRules.paused}
          canResume={user.role === "ADMIN" && process.env.AUVRA_RUNTIME_MODE === "LIVE_MARKET"}
        />
      )}
      <section className="mt-10">
        <h2 className="text-lg font-semibold">Policy versions</h2>
        <div className="mt-4 overflow-hidden rounded-xl border border-zinc-800">
          {policies.length ? (
            policies.map((policy) => {
              const rules =
                policy.rulesJson &&
                typeof policy.rulesJson === "object" &&
                !Array.isArray(policy.rulesJson)
                  ? (policy.rulesJson as Record<string, unknown>)
                  : {};
              return (
                <div
                  key={policy.id}
                  className="flex flex-wrap justify-between gap-3 border-b border-zinc-800 px-5 py-4 text-[14px] last:border-0"
                >
                  <div>
                    <p className="font-medium">
                      {policy.policyKey} · v{policy.version}
                    </p>
                    <p className="mt-1 text-zinc-500">
                      Created {policy.createdAt.toLocaleString()}
                    </p>
                  </div>
                  <span
                    className={
                      policy.active && rules.paused !== true ? "text-emerald-300" : "text-amber-300"
                    }
                  >
                    {policy.active
                      ? rules.paused === true
                        ? "Active · paused"
                        : "Active"
                      : "Inactive"}
                  </span>
                </div>
              );
            })
          ) : (
            <p className="p-5 text-[14px] text-zinc-400">
              No policy versions. Live procurement cannot proceed.
            </p>
          )}
        </div>
      </section>
      <section className="mt-10">
        <h2 className="text-lg font-semibold">Recent approvals</h2>
        <div className="mt-4 overflow-hidden rounded-xl border border-zinc-800">
          {approvals.length ? (
            approvals.map((approval) => (
              <div
                key={approval.id}
                className="flex flex-wrap justify-between gap-3 border-b border-zinc-800 px-5 py-4 text-[14px] last:border-0"
              >
                <div>
                  <p className="font-medium">{approval.approvalType}</p>
                  <p className="mt-1 text-zinc-500">
                    {approval.reason} · {approval.createdAt.toLocaleString()}
                  </p>
                </div>
                <span className="text-zinc-300">{approval.state}</span>
              </div>
            ))
          ) : (
            <p className="p-5 text-[14px] text-zinc-400">No approval records.</p>
          )}
        </div>
      </section>
    </main>
  );
}
