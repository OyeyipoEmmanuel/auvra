import "dotenv/config";
import { createServer, type Server } from "node:http";

import {
  Client,
  StreamableHTTPClientTransport,
  UnauthorizedError,
  type OAuthClientMetadata,
} from "@modelcontextprotocol/client";

import { EphemeralOAuthProvider } from "./oauth-provider.js";
import { probeMarketplaceBuyerFunding } from "../../apps/worker/src/marketplace/buyer-funding.js";

const MCP_URL = new URL("https://market.near.ai/mcp");
const CALLBACK_PORT = 8765;
const CALLBACK_URL = `http://127.0.0.1:${CALLBACK_PORT}/callback`;
const CALLBACK_TIMEOUT_MS = 15 * 60 * 1000;

function callbackServer(provider: EphemeralOAuthProvider): {
  server: Server;
  params: Promise<URLSearchParams>;
} {
  let resolveParams!: (params: URLSearchParams) => void;
  let rejectParams!: (error: Error) => void;
  const params = new Promise<URLSearchParams>((resolve, reject) => {
    resolveParams = resolve;
    rejectParams = reject;
  });

  const server = createServer((request, response) => {
    const url = new URL(request.url ?? "/", CALLBACK_URL);
    if (url.pathname !== "/callback") {
      response.writeHead(404).end();
      return;
    }
    try {
      if (url.searchParams.has("error"))
        throw new Error(`OAuth authorization failed: ${url.searchParams.get("error")}`);
      if (!url.searchParams.has("code"))
        throw new Error("OAuth callback did not include an authorization code");
      provider.verifyCallbackState(url.searchParams);
      response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      response.end("<h1>Auvra connected</h1><p>You can close this tab and return to Codex.</p>");
      resolveParams(url.searchParams);
    } catch (error) {
      const safeMessage = error instanceof Error ? error.message : "OAuth callback failed";
      response.writeHead(400, { "Content-Type": "text/plain; charset=utf-8" });
      response.end(safeMessage);
      // A stale browser tab can return to this fixed local port after a new
      // authorization has started. Reject that request, not the active flow.
      // Only the current state and a valid code may resolve the callback.
    }
  });

  server.listen(CALLBACK_PORT, "127.0.0.1");
  const timeout = setTimeout(
    () => rejectParams(new Error("OAuth authorization timed out")),
    CALLBACK_TIMEOUT_MS,
  );
  timeout.unref();
  void params.finally(() => clearTimeout(timeout));
  return { server, params };
}

function redactSensitive(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactSensitive);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value).map(([key, child]) => {
      if (/^(email|access_token|refresh_token|id_token|client_secret|authorization)$/i.test(key))
        return [key, "[redacted]"];
      return [key, redactSensitive(child)];
    }),
  );
}

function parseTextContent(result: Awaited<ReturnType<Client["callTool"]>>): unknown {
  const texts = result.content.flatMap((item) => (item.type === "text" ? [item.text] : []));
  return texts.map((text) => {
    try {
      return JSON.parse(text) as unknown;
    } catch {
      return text;
    }
  });
}

async function main(): Promise<void> {
  const metadata: OAuthClientMetadata = {
    client_name: "Auvra Phase 0 Buyer Connection",
    redirect_uris: [CALLBACK_URL],
    grant_types: ["authorization_code", "refresh_token"],
    response_types: ["code"],
    application_type: "native",
    token_endpoint_auth_method: "none",
  };
  const provider = new EphemeralOAuthProvider(CALLBACK_URL, metadata, (url) => {
    console.log(`AUVRA_AUTH_URL=${url.toString()}`);
    console.log(
      "Open the URL above and approve the buyer connection. No marketplace tool has been called yet.",
    );
  });
  const callback = callbackServer(provider);
  const client = new Client({ name: "auvra-phase-0", version: "0.0.0" }, { capabilities: {} });

  try {
    const firstTransport = new StreamableHTTPClientTransport(MCP_URL, { authProvider: provider });
    try {
      await client.connect(firstTransport);
    } catch (error) {
      if (!(error instanceof UnauthorizedError)) throw error;
      const params = await callback.params;
      await firstTransport.finishAuth(params);
      const authenticatedTransport = new StreamableHTTPClientTransport(MCP_URL, {
        authProvider: provider,
      });
      await client.connect(authenticatedTransport);
    }

    const { tools } = await client.listTools();
    const toolNames = tools.map((tool) => tool.name);
    const whoami = tools.find((tool) => /(^|[_-])whoami$/i.test(tool.name));
    if (!whoami) {
      console.log(
        JSON.stringify(
          { connected: true, toolCount: tools.length, toolNames, whoamiAvailable: false },
          null,
          2,
        ),
      );
      return;
    }
    const result = await client.callTool({ name: whoami.name, arguments: {} });
    let walletProbe: unknown = { verified: false };
    const accessToken = provider.tokens()?.access_token;
    if (accessToken) {
      const identityResponse = await fetch("https://market.near.ai/v1/me", {
        headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
        cache: "no-store",
      });
      if (identityResponse.ok) {
        const identity: unknown = await identityResponse.json();
        const accountId =
          identity &&
          typeof identity === "object" &&
          "account" in identity &&
          identity.account &&
          typeof identity.account === "object" &&
          "account_id" in identity.account &&
          typeof identity.account.account_id === "string"
            ? identity.account.account_id
            : null;
        if (accountId) {
          const [usd, usdc] = await Promise.all([
            probeMarketplaceBuyerFunding({
              accessToken,
              expectedAccountId: accountId,
              asset: "USD",
            }),
            probeMarketplaceBuyerFunding({
              accessToken,
              expectedAccountId: accountId,
              asset: "USDC",
            }),
          ]);
          walletProbe = {
            verified: Boolean(usd && usdc),
            accountId,
            usdAvailableMinor: usd?.availableMinor.toString() ?? null,
            usdcAvailableMinor: usdc?.availableMinor.toString() ?? null,
          };
        }
      }
    }
    console.log(
      JSON.stringify(
        {
          connected: true,
          toolCount: tools.length,
          toolNames,
          whoami: redactSensitive(parseTextContent(result)),
          walletProbe,
        },
        null,
        2,
      ),
    );
  } finally {
    callback.server.close();
    await client.close().catch(() => undefined);
  }
}

await main();
