import "dotenv/config";
import { createServer } from "node:http";
import { Client, StreamableHTTPClientTransport, UnauthorizedError, } from "@modelcontextprotocol/client";
import { EphemeralOAuthProvider } from "./oauth-provider.js";
const MCP_URL = new URL("https://market.near.ai/mcp");
const CALLBACK_PORT = 8765;
const CALLBACK_URL = `http://127.0.0.1:${CALLBACK_PORT}/callback`;
const CALLBACK_TIMEOUT_MS = 15 * 60 * 1000;
function callbackServer(provider) {
    let resolveParams;
    let rejectParams;
    const params = new Promise((resolve, reject) => {
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
        }
        catch (error) {
            const safeMessage = error instanceof Error ? error.message : "OAuth callback failed";
            response.writeHead(400, { "Content-Type": "text/plain; charset=utf-8" });
            response.end(safeMessage);
            rejectParams(new Error(safeMessage));
        }
    });
    server.listen(CALLBACK_PORT, "127.0.0.1");
    const timeout = setTimeout(() => rejectParams(new Error("OAuth authorization timed out")), CALLBACK_TIMEOUT_MS);
    timeout.unref();
    void params.finally(() => clearTimeout(timeout));
    return { server, params };
}
function redactSensitive(value) {
    if (Array.isArray(value))
        return value.map(redactSensitive);
    if (!value || typeof value !== "object")
        return value;
    return Object.fromEntries(Object.entries(value).map(([key, child]) => {
        if (/^(email|access_token|refresh_token|id_token|client_secret|authorization)$/i.test(key))
            return [key, "[redacted]"];
        return [key, redactSensitive(child)];
    }));
}
function parseTextContent(result) {
    const texts = result.content.flatMap((item) => item.type === "text" ? [item.text] : []);
    return texts.map((text) => {
        try {
            return JSON.parse(text);
        }
        catch {
            return text;
        }
    });
}
async function main() {
    const metadata = {
        client_name: "Auvra Phase 0 Buyer Connection",
        redirect_uris: [CALLBACK_URL],
        grant_types: ["authorization_code", "refresh_token"],
        response_types: ["code"],
        application_type: "native",
        token_endpoint_auth_method: "none",
    };
    const provider = new EphemeralOAuthProvider(CALLBACK_URL, metadata, (url) => {
        console.log(`AUVRA_AUTH_URL=${url.toString()}`);
        console.log("Open the URL above and approve the buyer connection. No marketplace tool has been called yet.");
    });
    const callback = callbackServer(provider);
    const client = new Client({ name: "auvra-phase-0", version: "0.0.0" }, { capabilities: {} });
    try {
        const firstTransport = new StreamableHTTPClientTransport(MCP_URL, { authProvider: provider });
        try {
            await client.connect(firstTransport);
        }
        catch (error) {
            if (!(error instanceof UnauthorizedError))
                throw error;
            const params = await callback.params;
            await firstTransport.finishAuth(params);
            const authenticatedTransport = new StreamableHTTPClientTransport(MCP_URL, { authProvider: provider });
            await client.connect(authenticatedTransport);
        }
        const { tools } = await client.listTools();
        const toolNames = tools.map((tool) => tool.name);
        const whoami = tools.find((tool) => /(^|[_-])whoami$/i.test(tool.name));
        if (!whoami) {
            console.log(JSON.stringify({ connected: true, toolCount: tools.length, toolNames, whoamiAvailable: false }, null, 2));
            return;
        }
        const result = await client.callTool({ name: whoami.name, arguments: {} });
        console.log(JSON.stringify({ connected: true, toolCount: tools.length, toolNames, whoami: redactSensitive(parseTextContent(result)) }, null, 2));
    }
    finally {
        callback.server.close();
        await client.close().catch(() => undefined);
    }
}
await main();
