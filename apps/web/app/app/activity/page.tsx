import { StateDot, WorkspaceEmpty, WorkspaceHeader, humanState } from "@/components/workspace-ui";
import { requirePageUser } from "@/lib/authz";
import { prisma } from "@/lib/prisma";

const filters = ["all", "request", "quote", "funding", "supplier"] as const;

export default async function ActivityPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>;
}) {
  const user = await requirePageUser();
  const { type: requestedType } = await searchParams;
  const type = filters.includes(requestedType as (typeof filters)[number]) ? requestedType! : "all";
  const [requests, projects, payments, notifications] = await Promise.all([
    prisma.serviceRequest.findMany({ where: { customerId: user.id }, select: { id: true } }),
    prisma.project.findMany({ where: { customerId: user.id }, select: { id: true } }),
    prisma.customerPayment.findMany({ where: { customerId: user.id }, select: { id: true } }),
    prisma.notification.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 30,
      select: { id: true, title: true, body: true, createdAt: true, readAt: true },
    }),
  ]);
  const requestIds = requests.map(({ id }) => id),
    projectIds = projects.map(({ id }) => id),
    paymentIds = payments.map(({ id }) => id);
  const events = await prisma.auditEvent.findMany({
    where: {
      OR: [
        { requestId: { in: requestIds } },
        { projectId: { in: projectIds } },
        { paymentId: { in: paymentIds } },
      ],
    },
    orderBy: { occurredAt: "desc" },
    take: 100,
    select: { id: true, eventType: true, requestId: true, projectId: true, occurredAt: true },
  });
  const visible =
    type === "all"
      ? events
      : events.filter((event) => event.eventType.toLowerCase().includes(type));
  return (
    <main className="mx-auto max-w-[1100px] px-5 py-8 sm:px-8 lg:px-10 lg:py-10">
      <WorkspaceHeader
        title="Activity"
        description="A chronological record of actions tied to your requests and projects."
      />
      <nav
        aria-label="Activity filters"
        className="mt-6 flex flex-wrap gap-2"
      >
        {filters.map((filter) => (
          <a
            key={filter}
            href={filter === "all" ? "/app/activity" : `/app/activity?type=${filter}`}
            aria-current={type === filter ? "page" : undefined}
            className={`rounded-md border px-3 py-1.5 text-[14px] capitalize transition-colors ${type === filter ? "border-[#514265] bg-[#211b29] text-[#d9caff]" : "border-[var(--ws-border)] text-[#92929b] hover:text-white"}`}
          >
            {filter}
          </a>
        ))}
      </nav>
      <section
        aria-label="Business events"
        className="mt-6 overflow-hidden rounded-lg border border-[var(--ws-border)]"
      >
        {visible.length ? (
          visible.map((event) => (
            <div
              key={event.id}
              className="flex gap-4 border-b border-[var(--ws-border)] px-5 py-4 last:border-0"
            >
              <span className="mt-1 size-2 shrink-0 rounded-full bg-[#8b5cf6]" />
              <div className="min-w-0 flex-1">
                <p className="text-[14px] font-medium text-[#e4e4e7]">
                  {humanState(event.eventType)}
                </p>
                <p className="mt-1 text-[13px] text-[#777780]">
                  {event.projectId
                    ? `Project ${event.projectId.slice(0, 8).toUpperCase()}`
                    : event.requestId
                      ? `Request ${event.requestId.slice(0, 8).toUpperCase()}`
                      : "Payment event"}
                </p>
              </div>
              <time className="shrink-0 text-right text-[13px] text-[#777780]">
                {event.occurredAt.toLocaleString()}
              </time>
            </div>
          ))
        ) : (
          <WorkspaceEmpty
            title="No events in this view"
            description={
              type === "all"
                ? "Business actions will appear here as Auvra processes your requests."
                : "Try another event filter."
            }
          />
        )}
      </section>
      {notifications.length > 0 && (
        <section className="mt-10">
          <h2 className="text-[15px] font-semibold">Notifications</h2>
          <div className="mt-4 overflow-hidden rounded-lg border border-[var(--ws-border)]">
            {notifications.map((item) => (
              <div
                key={item.id}
                className="flex gap-3 border-b border-[var(--ws-border)] px-5 py-4 last:border-0"
              >
                <span className="mt-1">
                  <StateDot state={item.readAt ? "CLOSED" : "PENDING"} />
                </span>
                <div className="min-w-0">
                  <p className="text-[14px] font-medium text-[#e4e4e7]">{item.title}</p>
                  <p className="mt-1 text-[14px] leading-5 text-[#92929b]">{item.body}</p>
                  <time className="mt-1 block text-[12px] text-[#777780]">
                    {item.createdAt.toLocaleString()}
                  </time>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
