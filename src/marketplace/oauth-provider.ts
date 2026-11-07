import { randomBytes } from "node:crypto";

import type {
  OAuthClientInformationContext,
  OAuthClientMetadata,
  OAuthClientProvider,
  OAuthDiscoveryState,
  StoredOAuthClientInformation,
  StoredOAuthTokens,
} from "@modelcontextprotocol/client";

/**
 * Phase 0 provider: credentials live only in process memory and disappear on exit.
 * Production will replace this with encrypted, account-scoped persistence.
 */
export class EphemeralOAuthProvider implements OAuthClientProvider {
  private clientInfo: StoredOAuthClientInformation | undefined;
  private tokenSet: StoredOAuthTokens | undefined;
  private verifier: string | undefined;
  private discovery: OAuthDiscoveryState | undefined;
  private readonly expectedState = randomBytes(32).toString("base64url");

  constructor(
    public readonly redirectUrl: string,
    public readonly clientMetadata: OAuthClientMetadata,
    private readonly onRedirect: (url: URL) => void,
  ) {}

  state(): string {
    return this.expectedState;
  }

  verifyCallbackState(params: URLSearchParams): void {
    if (params.get("state") !== this.expectedState)
      throw new Error("OAuth callback state mismatch");
  }

  clientInformation(
    _ctx?: OAuthClientInformationContext,
  ): StoredOAuthClientInformation | undefined {
    return this.clientInfo;
  }

  saveClientInformation(value: StoredOAuthClientInformation): void {
    this.clientInfo = value;
  }

  tokens(_ctx?: OAuthClientInformationContext): StoredOAuthTokens | undefined {
    return this.tokenSet;
  }

  saveTokens(value: StoredOAuthTokens): void {
    this.tokenSet = value;
  }

  redirectToAuthorization(url: URL): void {
    this.onRedirect(url);
  }

  saveCodeVerifier(value: string): void {
    this.verifier = value;
  }

  codeVerifier(): string {
    if (!this.verifier) throw new Error("OAuth PKCE verifier is unavailable");
    return this.verifier;
  }

  saveDiscoveryState(value: OAuthDiscoveryState): void {
    this.discovery = value;
  }

  discoveryState(): OAuthDiscoveryState | undefined {
    return this.discovery;
  }

  invalidateCredentials(scope: "all" | "client" | "tokens" | "verifier" | "discovery"): void {
    if (scope === "all" || scope === "client") this.clientInfo = undefined;
    if (scope === "all" || scope === "tokens") this.tokenSet = undefined;
    if (scope === "all" || scope === "verifier") this.verifier = undefined;
    if (scope === "all" || scope === "discovery") this.discovery = undefined;
  }
}
