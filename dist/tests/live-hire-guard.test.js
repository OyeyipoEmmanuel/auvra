import { describe, expect, it } from "vitest";
import { readEnv } from "../src/config/env.js";
import { authorizePhaseZeroLiveHire } from "../src/marketplace/live-hire-guard.js";
function env(overrides = {}) {
    return readEnv({
        NEAR_MARKET_API_KEY: "test-key",
        AUVRA_ALLOW_LIVE_HIRE: "false",
        AUVRA_TEST_SERVICE_ID: "service-1",
        AUVRA_TEST_BUDGET_AMOUNT: "1",
        AUVRA_TEST_BUDGET_TOKEN: "USDC",
        AUVRA_TEST_HIRE_CONFIRMATION: "I_UNDERSTAND_THIS_SPENDS_REAL_FUNDS",
        ...overrides,
    });
}
describe("phase-zero live hire guard", () => {
    it("blocks live hiring by default", () => {
        expect(() => authorizePhaseZeroLiveHire(env())).toThrow("AUVRA_ALLOW_LIVE_HIRE");
    });
    it("blocks an incorrect confirmation phrase", () => {
        expect(() => authorizePhaseZeroLiveHire(env({ AUVRA_ALLOW_LIVE_HIRE: "true", AUVRA_TEST_HIRE_CONFIRMATION: "yes" }))).toThrow("confirmation phrase");
    });
    it("blocks a budget above the phase-zero ceiling", () => {
        expect(() => authorizePhaseZeroLiveHire(env({ AUVRA_ALLOW_LIVE_HIRE: "true", AUVRA_TEST_BUDGET_AMOUNT: "5.01" }))).toThrow("at most 5");
    });
    it("permits only a fully configured bounded hire", () => {
        expect(authorizePhaseZeroLiveHire(env({ AUVRA_ALLOW_LIVE_HIRE: "true" }))).toEqual({
            serviceId: "service-1",
            amount: 1,
            token: "USDC",
        });
    });
});
