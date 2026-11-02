import { z } from "zod";
const envSchema = z.object({
    NEAR_MARKET_BASE_URL: z.string().url().default("https://market.near.ai"),
    AUVRA_MARKET_CATEGORY: z.string().trim().min(1).default("research"),
});
export function readEnv(source = process.env) {
    return envSchema.parse(source);
}
