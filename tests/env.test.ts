import { describe, expect, it } from "vitest";

import { readEnv } from "../src/config/env.js";

describe("runtime configuration", () => {
  it("defaults to a no-spend sandbox", () => {
    const env = readEnv({});
    expect(env.AUVRA_RUNTIME_MODE).toBe("DEMO_SANDBOX");
    expect(env.MARKETPLACE_WRITES_ENABLED).toBe(false);
    expect(env.MARKETPLACE_MAX_SPEND_MINOR).toBe(0);
  });

  it("rejects writes in sandbox mode", () => {
    expect(() => readEnv({ MARKETPLACE_WRITES_ENABLED: "true", MARKETPLACE_MAX_SPEND_MINOR: "50" })).toThrow();
  });

  it("rejects incomplete live mode", () => {
    expect(() => readEnv({ AUVRA_RUNTIME_MODE: "LIVE_MARKET" })).toThrow(/DATABASE_URL and REDIS_URL/);
  });

  it("requires a positive cap before live writes", () => {
    expect(() => readEnv({
      AUVRA_RUNTIME_MODE: "LIVE_MARKET",
      DATABASE_URL: "postgresql://localhost/auvra",
      REDIS_URL: "redis://localhost:6379",
      MARKETPLACE_WRITES_ENABLED: "true",
      MARKETPLACE_MAX_SPEND_MINOR: "0",
    })).toThrow(/spend ceiling/);
  });
});
