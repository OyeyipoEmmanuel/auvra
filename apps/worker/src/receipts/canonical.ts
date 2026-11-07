import { createHash } from "node:crypto";

export type CanonicalValue =
  null | boolean | string | number | CanonicalValue[] | { [key: string]: CanonicalValue };

/** UTF-8 JSON with lexical object keys and integer-only numbers. Never put this private record on chain. */
export function canonicalJson(value: CanonicalValue): string {
  if (value === null || typeof value === "boolean" || typeof value === "string") {
    return JSON.stringify(value);
  }
  if (typeof value === "number") {
    if (!Number.isSafeInteger(value)) throw new Error("Canonical records require safe integers.");
    return String(value);
  }
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  const fields = Object.keys(value)
    .sort()
    .map((key) => {
      const item = value[key];
      if (item === undefined) throw new Error("Canonical records cannot contain undefined.");
      return `${JSON.stringify(key)}:${canonicalJson(item)}`;
    });
  return `{${fields.join(",")}}`;
}

export function sha256Canonical(value: CanonicalValue): string {
  return createHash("sha256").update(canonicalJson(value), "utf8").digest("hex");
}

export function sha256Text(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}
