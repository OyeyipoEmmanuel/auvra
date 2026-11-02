import { z } from "zod";

const envSchema = z.object({
  AUVRA_RUNTIME_MODE: z.enum(["DEMO_SANDBOX", "LIVE_MARKET"]).default("DEMO_SANDBOX"),
  DATABASE_URL: z.string().min(1).optional(),
  REDIS_URL: z.string().url().optional(),
  S3_ENDPOINT: z.string().url().optional(),
  S3_BUCKET: z.string().trim().min(1).optional(),
  S3_ACCESS_KEY: z.string().trim().min(1).optional(),
  S3_SECRET_KEY: z.string().trim().min(1).optional(),
  NEAR_MARKET_BASE_URL: z.string().url().default("https://market.near.ai"),
  AUVRA_MARKET_CATEGORY: z.string().trim().min(1).default("research"),
  MARKETPLACE_WRITES_ENABLED: z.enum(["true", "false"]).default("false").transform((value) => value === "true"),
  MARKETPLACE_MAX_SPEND_MINOR: z.coerce.number().int().nonnegative().default(0),
}).superRefine((value, context) => {
  if (value.AUVRA_RUNTIME_MODE === "LIVE_MARKET") {
    if (!value.DATABASE_URL || !value.REDIS_URL) {
      context.addIssue({ code: "custom", message: "LIVE_MARKET requires DATABASE_URL and REDIS_URL." });
    }
    if (value.MARKETPLACE_WRITES_ENABLED && value.MARKETPLACE_MAX_SPEND_MINOR === 0) {
      context.addIssue({ code: "custom", path: ["MARKETPLACE_MAX_SPEND_MINOR"], message: "Marketplace writes require a positive deterministic spend ceiling." });
    }
  }
  if (value.AUVRA_RUNTIME_MODE === "DEMO_SANDBOX" && value.MARKETPLACE_WRITES_ENABLED) {
    context.addIssue({ code: "custom", path: ["MARKETPLACE_WRITES_ENABLED"], message: "Marketplace writes cannot be enabled in DEMO_SANDBOX." });
  }
});

export type AppEnv = z.infer<typeof envSchema>;

export function readEnv(source: NodeJS.ProcessEnv = process.env): AppEnv {
  return envSchema.parse(source);
}
