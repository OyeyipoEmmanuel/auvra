import { prisma } from "@/lib/prisma";

export async function getCustomerOverview(customerId: string) {
  const [requests, projects, requestCount, projectCount, quoteReadyCount, notifications] = await Promise.all([
    prisma.serviceRequest.findMany({
      where: { customerId },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { id: true, rawBrief: true, state: true, createdAt: true, updatedAt: true, quotes: { orderBy: { version: "desc" }, take: 1, select: { state: true, customerTotalMinor: true, currency: true } } },
    }),
    prisma.project.findMany({
      where: { customerId },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { id: true, state: true, createdAt: true, request: { select: { rawBrief: true } } },
    }),
    prisma.serviceRequest.count({ where: { customerId } }),
    prisma.project.count({ where: { customerId } }),
    prisma.quote.count({ where: { request: { customerId }, state: "PRESENTED" } }),
    prisma.notification.findMany({ where: { userId: customerId }, orderBy: { createdAt: "desc" }, take: 6, select: { id: true, type: true, title: true, body: true, readAt: true, createdAt: true } }),
  ]);

  return { requests, projects, requestCount, projectCount, quoteReadyCount, notifications };
}
