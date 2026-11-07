import { describe, expect, it } from "vitest";

import {
  exactMinor,
  mcpBody,
  parseLiveAgentProfile,
} from "../apps/worker/src/marketplace/live-hire-preflight";

const profile = {
  agent_id: "10f2da15-7980-4cb0-9cae-6de98db773ae",
  name: "Geo",
  accepting_work: true,
  price: "15",
  price_token: "USD",
  payable_with: ["USD", "USDC"],
  required_roles: [],
  page_url: "https://market.near.ai/a/geo",
  sla_seconds: 3600,
};

describe("M8 live supplier preflight", () => {
  it("reads the observed MCP structured-content contract", () => {
    expect(mcpBody({ structuredContent: profile, content: [], isError: false })).toEqual(profile);
    expect(mcpBody({ content: [{ type: "text", text: JSON.stringify(profile) }] })).toEqual(
      profile,
    );
    expect(mcpBody({ content: [{ type: "text", text: "not json" }] })).toBeNull();
    expect(mcpBody({ structuredContent: profile, isError: true })).toBeNull();
  });

  it("uses exact minor units and rejects rounding or negative prices", () => {
    expect(exactMinor("15", 2)).toBe(1500n);
    expect(exactMinor("15.01", 2)).toBe(1501n);
    expect(exactMinor("0.123456", 6)).toBe(123456n);
    expect(exactMinor("15.001", 2)).toBeNull();
    expect(exactMinor("-1", 2)).toBeNull();
    expect(exactMinor(15, 2)).toBeNull();
  });

  it("requires a matching agent, payable asset and trusted listing URL", () => {
    expect(parseLiveAgentProfile(profile, profile.agent_id)).toMatchObject({
      agentId: profile.agent_id,
      priceMinor: 1500n,
      currency: "USD",
      acceptingWork: true,
    });
    expect(parseLiveAgentProfile(profile, "other-agent")).toBeNull();
    expect(
      parseLiveAgentProfile({ ...profile, payable_with: ["USDC"] }, profile.agent_id),
    ).toBeNull();
    expect(
      parseLiveAgentProfile(
        { ...profile, page_url: "https://evil.example/a/geo" },
        profile.agent_id,
      ),
    ).toBeNull();
    expect(parseLiveAgentProfile({ ...profile, price: "15.001" }, profile.agent_id)).toBeNull();
  });
});
