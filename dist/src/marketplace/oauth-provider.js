import { randomBytes } from "node:crypto";
/**
 * Phase 0 provider: credentials live only in process memory and disappear on exit.
 * Production will replace this with encrypted, account-scoped persistence.
 */
export class EphemeralOAuthProvider {
    redirectUrl;
    clientMetadata;
    onRedirect;
    clientInfo;
    tokenSet;
    verifier;
    discovery;
    expectedState = randomBytes(32).toString("base64url");
    constructor(redirectUrl, clientMetadata, onRedirect) {
        this.redirectUrl = redirectUrl;
        this.clientMetadata = clientMetadata;
        this.onRedirect = onRedirect;
    }
    state() {
        return this.expectedState;
    }
    verifyCallbackState(params) {
        if (params.get("state") !== this.expectedState)
            throw new Error("OAuth callback state mismatch");
    }
    clientInformation(_ctx) {
        return this.clientInfo;
    }
    saveClientInformation(value) {
        this.clientInfo = value;
    }
    tokens(_ctx) {
        return this.tokenSet;
    }
    saveTokens(value) {
        this.tokenSet = value;
    }
    redirectToAuthorization(url) {
        this.onRedirect(url);
    }
    saveCodeVerifier(value) {
        this.verifier = value;
    }
    codeVerifier() {
        if (!this.verifier)
            throw new Error("OAuth PKCE verifier is unavailable");
        return this.verifier;
    }
    saveDiscoveryState(value) {
        this.discovery = value;
    }
    discoveryState() {
        return this.discovery;
    }
    invalidateCredentials(scope) {
        if (scope === "all" || scope === "client")
            this.clientInfo = undefined;
        if (scope === "all" || scope === "tokens")
            this.tokenSet = undefined;
        if (scope === "all" || scope === "verifier")
            this.verifier = undefined;
        if (scope === "all" || scope === "discovery")
            this.discovery = undefined;
    }
}
