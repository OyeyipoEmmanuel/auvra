const EXACT_CONFIRMATION = "I_UNDERSTAND_THIS_SPENDS_REAL_FUNDS";
const MAX_PHASE_ZERO_BUDGET = 5;
export function authorizePhaseZeroLiveHire(env) {
    if (env.AUVRA_ALLOW_LIVE_HIRE !== "true") {
        throw new Error("Live hire blocked: AUVRA_ALLOW_LIVE_HIRE is not true");
    }
    if (env.AUVRA_TEST_HIRE_CONFIRMATION !== EXACT_CONFIRMATION) {
        throw new Error("Live hire blocked: exact confirmation phrase is missing");
    }
    if (!env.NEAR_MARKET_API_KEY)
        throw new Error("Live hire blocked: marketplace API key is missing");
    if (!env.AUVRA_TEST_SERVICE_ID)
        throw new Error("Live hire blocked: test service ID is missing");
    if (!env.AUVRA_TEST_BUDGET_AMOUNT)
        throw new Error("Live hire blocked: test budget is missing");
    const amount = Number(env.AUVRA_TEST_BUDGET_AMOUNT);
    if (!Number.isFinite(amount) || amount <= 0 || amount > MAX_PHASE_ZERO_BUDGET) {
        throw new Error(`Live hire blocked: budget must be greater than 0 and at most ${MAX_PHASE_ZERO_BUDGET}`);
    }
    return {
        serviceId: env.AUVRA_TEST_SERVICE_ID,
        amount,
        token: env.AUVRA_TEST_BUDGET_TOKEN,
    };
}
