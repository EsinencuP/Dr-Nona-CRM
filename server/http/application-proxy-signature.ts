import { createHash, createHmac, timingSafeEqual } from "node:crypto";

export const PROXY_SIGNATURE_VERSION = "1";
export const PROXY_SIGNATURE_MAX_SKEW_SECONDS = 300;
const CLIENT_KEY_PATTERN = /^[A-Za-z0-9_-]{43}$/u;
const SIGNATURE_PATTERN = /^[A-Za-z0-9_-]{43}$/u;

function bodyHash(body: ArrayBuffer) {
  return createHash("sha256").update(Buffer.from(body)).digest("base64url");
}

function secureEqual(actual: string, expected: string) {
  const actualBuffer = Buffer.from(actual);
  const expectedBuffer = Buffer.from(expected);
  return actualBuffer.length === expectedBuffer.length && timingSafeEqual(actualBuffer, expectedBuffer);
}

export function proxySignaturePayload(timestamp: string, clientKey: string, hash: string) {
  return `${PROXY_SIGNATURE_VERSION}:${timestamp}:${clientKey}:${hash}`;
}

export function signProxyPayload(secret: string, payload: string) {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

export type ProxyVerification =
  | { valid: true; clientKey: string }
  | { valid: false; reason: "missing" | "malformed" | "expired" | "signature" };

export async function verifyApplicationProxyRequest(
  request: Request,
  secret: string,
  now: () => number = Date.now,
): Promise<ProxyVerification> {
  const version = request.headers.get("x-dr-nona-proxy-version") ?? "";
  const timestamp = request.headers.get("x-dr-nona-proxy-timestamp") ?? "";
  const clientKey = request.headers.get("x-dr-nona-client-key") ?? "";
  const signature = request.headers.get("x-dr-nona-proxy-signature") ?? "";
  if (!version || !timestamp || !clientKey || !signature) return { valid: false, reason: "missing" };
  if (
    version !== PROXY_SIGNATURE_VERSION ||
    !/^\d{10}$/u.test(timestamp) ||
    !CLIENT_KEY_PATTERN.test(clientKey) ||
    !SIGNATURE_PATTERN.test(signature)
  ) {
    return { valid: false, reason: "malformed" };
  }
  const ageSeconds = Math.abs(Math.floor(now() / 1000) - Number(timestamp));
  if (!Number.isSafeInteger(ageSeconds) || ageSeconds > PROXY_SIGNATURE_MAX_SKEW_SECONDS) {
    return { valid: false, reason: "expired" };
  }
  const hash = bodyHash(await request.clone().arrayBuffer());
  const expected = signProxyPayload(secret, proxySignaturePayload(timestamp, clientKey, hash));
  return secureEqual(signature, expected) ? { valid: true, clientKey } : { valid: false, reason: "signature" };
}
