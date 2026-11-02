import { afterEach, describe, expect, it, vi } from "vitest";
import { normalizeCreatedJob, normalizeServices } from "../src/marketplace/normalize.js";
import { NearMarketplaceAdapter } from "../src/marketplace/near-marketplace-adapter.js";
afterEach(() => vi.unstubAllGlobals());
describe("marketplace response normalization", () => {
    it("normalizes a documented snake_case service response", () => {
        const services = normalizeServices([
            {
                service_id: "service-1",
                agent_id: "agent-1",
                name: "Research brief",
                category: "research",
                price_amount: "2.50",
                price_token: "USDC",
            },
        ], "2026-10-26T00:00:00.000Z");
        expect(services).toHaveLength(1);
        expect(services[0]).toMatchObject({
            externalServiceId: "service-1",
            externalAgentId: "agent-1",
            price: { amount: "2.50", token: "USDC" },
        });
    });
    it("handles a wrapped service array and ignores invalid entries", () => {
        const services = normalizeServices({ services: [{ id: "service-2", title: "Analysis" }, null] });
        expect(services).toHaveLength(1);
        expect(services[0]?.externalServiceId).toBe("service-2");
    });
    it("normalizes the documented instant-job response", () => {
        expect(normalizeCreatedJob({ job_id: "job-1", assignment_id: "assignment-1", status: "in_progress" })).toMatchObject({
            jobId: "job-1",
            assignmentId: "assignment-1",
            status: "in_progress",
        });
    });
    it("creates a private instant job without enabling auto-acceptance", async () => {
        const fetchMock = vi.fn(async (_url, init) => {
            expect(init?.headers).toMatchObject({ Authorization: "Bearer secret-test-key" });
            const body = JSON.parse(String(init?.body));
            expect(body).toMatchObject({
                service_id: "service-1",
                budget_amount: 1,
                budget_token: "USDC",
                is_private: true,
            });
            expect(body).not.toHaveProperty("auto_accept");
            return new Response(JSON.stringify({ job: { job_id: "job-1", status: "in_progress" } }), { status: 200 });
        });
        vi.stubGlobal("fetch", fetchMock);
        const adapter = new NearMarketplaceAdapter({ apiKey: "secret-test-key", baseUrl: "https://market.invalid" });
        const job = await adapter.createHire({
            authorizationId: "authorization-1",
            idempotencyKey: "operation-1",
            serviceId: "service-1",
            title: "A sufficiently long test title",
            description: "A sufficiently long test description for an instant marketplace job request.",
            budget: { amount: 1, token: "USDC" },
        });
        expect(fetchMock).toHaveBeenCalledWith("https://market.invalid/v1/jobs/instant", expect.objectContaining({ method: "POST" }));
        expect(job.jobId).toBe("job-1");
    });
});
