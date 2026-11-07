import type { BachsMode } from "./bachs";

export function bachsPaymentMode(env: NodeJS.ProcessEnv = process.env): BachsMode | null {
  if (env.BACHS_USD_ENABLED !== "true" || !env.BACHS_WEBHOOK_SECRET?.startsWith("whsec_"))
    return null;
  if (env.AUVRA_RUNTIME_MODE === "DEMO_SANDBOX" && env.BACHS_API_KEY?.startsWith("sk_sandbox_"))
    return "SANDBOX";
  if (env.AUVRA_RUNTIME_MODE === "LIVE_MARKET" && env.BACHS_API_KEY?.startsWith("sk_live_"))
    return "LIVE";
  return null;
}

export function liveUsdRailEnabled(env: NodeJS.ProcessEnv = process.env) {
  return bachsPaymentMode(env) === "LIVE";
}

export function bachsUsdRailEnabled(env: NodeJS.ProcessEnv = process.env) {
  return bachsPaymentMode(env) !== null;
}
