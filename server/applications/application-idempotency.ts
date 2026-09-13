import type { ApplicationInput } from "../../shared/applications/application-schema";
import { createHash } from "node:crypto";

export const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000;

function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, entry]) => entry !== undefined)
    .sort(([left], [right]) => left.localeCompare(right));
  return `{${entries.map(([key, entry]) => `${JSON.stringify(key)}:${canonicalJson(entry)}`).join(",")}}`;
}

function sha256(value: string) {
  return createHash("sha256").update(value).digest("base64url");
}

export function createApplicationIdempotency(input: ApplicationInput, key: string, now: Date) {
  return {
    keyHash: sha256(key),
    payloadHash: sha256(canonicalJson(input)),
    expiresAt: new Date(now.getTime() + IDEMPOTENCY_TTL_MS),
    now,
  };
}
