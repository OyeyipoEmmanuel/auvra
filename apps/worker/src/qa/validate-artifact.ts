import { createHash } from "node:crypto";

export type ArtifactCandidate = {
  text?: string | null;
  externalUrl?: string | null;
  bytes?: Uint8Array | null;
  expectedSha256?: string | null;
  mimeType?: string | null;
};

export type ArtifactValidation = {
  result: "REJECTED" | "NEEDS_QUALITATIVE_REVIEW";
  violations: string[];
  evidence: {
    textCharacters: number;
    byteLength: number | null;
    sha256: string | null;
    externalHost: string | null;
    acceptanceChecks: string[];
  };
};

function acceptanceChecks(value: unknown): string[] | null {
  if (!Array.isArray(value) || !value.every((item) => typeof item === "string")) return null;
  return value.filter((item) => item.trim().length > 0);
}

/** Deterministic safety/integrity checks only; semantic quality is never inferred from file presence. */
export function validateArtifact(
  candidate: ArtifactCandidate,
  validationRulesJson: unknown,
): ArtifactValidation {
  const violations: string[] = [];
  const checks = acceptanceChecks(validationRulesJson);
  if (!checks || checks.length === 0) violations.push("ACCEPTANCE_CHECKS_MISSING");

  const text = candidate.text?.trim() ?? "";
  const bytes = candidate.bytes ?? null;
  let externalHost: string | null = null;
  if (candidate.externalUrl) {
    try {
      const url = new URL(candidate.externalUrl);
      if (url.protocol !== "https:" || url.username || url.password) {
        violations.push("UNSAFE_EXTERNAL_URL");
      } else {
        externalHost = url.hostname;
      }
    } catch {
      violations.push("UNSAFE_EXTERNAL_URL");
    }
  }
  if (!text && !bytes?.length && !candidate.externalUrl) violations.push("EMPTY_DELIVERABLE");
  if (text.length > 1_000_000) violations.push("TEXT_TOO_LARGE");
  if (bytes && bytes.length > 100 * 1024 * 1024) violations.push("FILE_TOO_LARGE");
  if (candidate.mimeType && !/^[\w.+-]+\/[\w.+-]+$/.test(candidate.mimeType)) {
    violations.push("INVALID_MIME_TYPE");
  }

  const sha256 = bytes ? createHash("sha256").update(bytes).digest("hex") : null;
  if (candidate.expectedSha256) {
    if (!/^[0-9a-f]{64}$/i.test(candidate.expectedSha256) || !bytes) {
      violations.push("CHECKSUM_UNVERIFIABLE");
    } else if (sha256 !== candidate.expectedSha256.toLowerCase()) {
      violations.push("CHECKSUM_MISMATCH");
    }
  }
  return {
    result: violations.length ? "REJECTED" : "NEEDS_QUALITATIVE_REVIEW",
    violations,
    evidence: {
      textCharacters: text.length,
      byteLength: bytes?.length ?? null,
      sha256,
      externalHost,
      acceptanceChecks: checks ?? [],
    },
  };
}
