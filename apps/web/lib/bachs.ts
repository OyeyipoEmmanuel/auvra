import { createHmac, timingSafeEqual } from "node:crypto";

export type BachsMode = "SANDBOX" | "LIVE";

export type BachsPayment = {
  payment_id: string;
  checkout_id: string;
  reference: string;
  status: string;
  amount: string;
  amount_paid: string;
  currency: string;
};

export function bachsApiBase(mode: BachsMode) {
  return mode === "SANDBOX" ? "https://sandbox-api.bachs.io" : "https://api.bachs.io";
}

export function isBachsCheckoutUrl(value: string, mode: BachsMode) {
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      (url.hostname === "checkout.bachs.io" ||
        (mode === "SANDBOX" && url.hostname === "sandbox-checkout.bachs.io")) &&
      url.pathname.startsWith("/c/") &&
      !url.username &&
      !url.password
    );
  } catch {
    return false;
  }
}

/** Bachs redirects only to public HTTPS URLs; never send a localhost callback. */
export function bachsReturnUrls(
  quoteId: string,
  requestId: string,
  authUrl = process.env.AUTH_URL,
) {
  if (!authUrl) return null;
  try {
    const url = new URL(authUrl);
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      ["localhost", "127.0.0.1", "::1"].includes(url.hostname)
    ) {
      return null;
    }
    return {
      success_url: `${url.origin}/app/checkout/return/${quoteId}`,
      cancel_url: `${url.origin}/app/requests/${requestId}`,
    };
  } catch {
    return null;
  }
}

export function usdMinorToDecimal(minor: bigint) {
  if (minor <= BigInt(0)) throw new Error("USD amount must be positive.");
  return `${minor / BigInt(100)}.${(minor % BigInt(100)).toString().padStart(2, "0")}`;
}

export function usdDecimalToMinor(value: string): bigint | null {
  const match = /^(0|[1-9]\d*)\.(\d{2})$/.exec(value);
  return match ? BigInt(match[1]!) * BigInt(100) + BigInt(match[2]!) : null;
}

/** Bachs V2 signs `${timestamp}.${rawBody}` with HMAC-SHA256. */
export function verifyBachsSignature(
  rawBody: string | Uint8Array,
  header: string | null,
  secret: string,
  nowSeconds = Math.floor(Date.now() / 1000),
): boolean {
  if (!header || !secret.startsWith("whsec_")) return false;
  let timestampText: string | null = null;
  const signatures: string[] = [];
  for (const part of header.split(",")) {
    const separator = part.indexOf("=");
    if (separator < 0) continue;
    const key = part.slice(0, separator).trim();
    const value = part.slice(separator + 1).trim();
    if (key === "t") {
      if (timestampText !== null || !/^\d+$/.test(value)) return false;
      timestampText = value;
    } else if (key === "v1") {
      signatures.push(value);
    }
  }
  if (timestampText === null || signatures.length === 0) return false;
  const timestamp = Number(timestampText);
  if (!Number.isSafeInteger(timestamp) || Math.abs(nowSeconds - timestamp) > 300) return false;
  const expected = createHmac("sha256", secret).update(`${timestamp}.`).update(rawBody).digest();
  return signatures.some((signature) =>
    /^[a-f0-9]{64}$/.test(signature)
      ? timingSafeEqual(Buffer.from(signature, "hex"), expected)
      : false,
  );
}

export function matchesBachsPayment(
  actual: BachsPayment,
  expected: { reference: string; checkoutId: string; chargeId: string; amountMinor: bigint },
) {
  return (
    actual.status.toLowerCase() === "succeeded" &&
    actual.payment_id === expected.chargeId &&
    actual.checkout_id === expected.checkoutId &&
    actual.reference === expected.reference &&
    actual.currency === "USD" &&
    usdDecimalToMinor(actual.amount) === expected.amountMinor &&
    usdDecimalToMinor(actual.amount_paid) === expected.amountMinor
  );
}

export async function retrieveBachsPayment(chargeId: string, mode: BachsMode, secretKey: string) {
  const response = await fetch(
    `${bachsApiBase(mode)}/v1/payments/${encodeURIComponent(chargeId)}`,
    {
      headers: { Authorization: `Bearer ${secretKey}` },
      cache: "no-store",
    },
  );
  if (!response.ok) throw new Error(`Bachs payment verification failed: ${response.status}`);
  const payload: unknown = await response.json();
  if (!isBachsPayment(payload)) throw new Error("Invalid Bachs payment verification response.");
  return payload;
}

function isBachsPayment(value: unknown): value is BachsPayment {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return [
    "payment_id",
    "checkout_id",
    "reference",
    "status",
    "amount",
    "amount_paid",
    "currency",
  ].every((key) => typeof record[key] === "string");
}
