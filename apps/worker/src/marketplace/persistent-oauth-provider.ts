import { randomBytes } from "node:crypto";

import type { PrismaClient } from "@prisma/client";
import type {
  OAuthClientMetadata,
  OAuthClientProvider,
  OAuthDiscoveryState,
  StoredOAuthClientInformation,
  StoredOAuthTokens,
} from "@modelcontextprotocol/client";

import {
  loadBuyerOAuthState,
  saveBuyerOAuthState,
  type BuyerOAuthSnapshot,
  type BuyerOAuthState,
} from "./buyer-oauth-store.js";

const CALLBACK_URL = "http://127.0.0.1:8765/callback";

export const buyerClientMetadata: OAuthClientMetadata = {
  client_name: "Auvra Buyer Worker",
  redirect_uris: [CALLBACK_URL],
  grant_types: ["authorization_code", "refresh_token"],
  response_types: ["code"],
  application_type: "native",
  token_endpoint_auth_method: "none",
};

/** The SDK can rotate tokens; every rotation is encrypted and versioned in Postgres. */
export class PersistentBuyerOAuthProvider implements OAuthClientProvider {
  readonly redirectUrl = CALLBACK_URL;
  readonly clientMetadata = buyerClientMetadata;
  private readonly expectedState = randomBytes(32).toString("base64url");
  private pending: Promise<void> = Promise.resolve();

  private constructor(
    private readonly db: PrismaClient,
    private readonly key: Buffer,
    private stored: BuyerOAuthState,
    private readonly onRedirect?: (url: URL) => void,
  ) {}

  static async load(
    db: PrismaClient,
    key: Buffer,
    onRedirect?: (url: URL) => void,
  ): Promise<PersistentBuyerOAuthProvider> {
    return new PersistentBuyerOAuthProvider(
      db,
      key,
      await loadBuyerOAuthState(db, key),
      onRedirect,
    );
  }

  get accountId(): string | null {
    return this.stored.accountId;
  }

  state(): string {
    return this.expectedState;
  }

  verifyCallbackState(params: URLSearchParams): void {
    if (params.get("state") !== this.expectedState)
      throw new Error("OAuth callback state mismatch.");
  }

  private persist(
    change: (snapshot: BuyerOAuthSnapshot) => BuyerOAuthSnapshot,
    accountId?: string,
  ) {
    this.pending = this.pending.then(async () => {
      const next = {
        accountId: accountId ?? this.stored.accountId,
        snapshot: change(this.stored.snapshot),
      };
      this.stored = await saveBuyerOAuthState(this.db, this.key, this.stored, next);
    });
    return this.pending;
  }

  async bindAccount(accountId: string): Promise<void> {
    if (!/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(accountId)) {
      throw new Error("Invalid marketplace buyer account ID.");
    }
    if (this.stored.accountId && this.stored.accountId !== accountId) {
      throw new Error("Marketplace buyer account changed; refusing to replace credentials.");
    }
    await this.persist((snapshot) => snapshot, accountId);
  }

  async clientInformation(): Promise<StoredOAuthClientInformation | undefined> {
    await this.pending;
    return this.stored.snapshot.clientInfo;
  }

  saveClientInformation(value: StoredOAuthClientInformation): Promise<void> {
    return this.persist((snapshot) => ({ ...snapshot, clientInfo: value }));
  }

  async tokens(): Promise<StoredOAuthTokens | undefined> {
    await this.pending;
    return this.stored.snapshot.tokens;
  }

  saveTokens(value: StoredOAuthTokens): Promise<void> {
    return this.persist((snapshot) => ({ ...snapshot, tokens: value }));
  }

  redirectToAuthorization(url: URL): void {
    if (!this.onRedirect) throw new Error("Buyer OAuth reauthorization required.");
    this.onRedirect(url);
  }

  saveCodeVerifier(value: string): Promise<void> {
    return this.persist((snapshot) => ({ ...snapshot, verifier: value }));
  }

  async codeVerifier(): Promise<string> {
    await this.pending;
    if (!this.stored.snapshot.verifier) throw new Error("Buyer OAuth verifier unavailable.");
    return this.stored.snapshot.verifier;
  }

  saveDiscoveryState(value: OAuthDiscoveryState): Promise<void> {
    return this.persist((snapshot) => ({ ...snapshot, discovery: value }));
  }

  async discoveryState(): Promise<OAuthDiscoveryState | undefined> {
    await this.pending;
    return this.stored.snapshot.discovery;
  }

  invalidateCredentials(scope: "all" | "client" | "tokens" | "verifier" | "discovery") {
    return this.persist((snapshot) => ({
      clientInfo: scope === "all" || scope === "client" ? undefined : snapshot.clientInfo,
      tokens: scope === "all" || scope === "tokens" ? undefined : snapshot.tokens,
      verifier: scope === "all" || scope === "verifier" ? undefined : snapshot.verifier,
      discovery: scope === "all" || scope === "discovery" ? undefined : snapshot.discovery,
    }));
  }
}
