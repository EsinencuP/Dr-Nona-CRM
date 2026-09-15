import { describe, expect, test } from "vitest";

import { verifyApplicationProxyRequest } from "../../server/http/application-proxy-signature";
import { createHash, createHmac } from "node:crypto";

const secret = "test-shared-secret-at-least-32-bytes";
const timestamp = "1800000000";
const clientKey = createHmac("sha256", secret).update("client:203.0.113.20").digest("base64url");
const body = JSON.stringify({ locale: "ru-MD", type: "consultation", firstName: "Ana" });
const bodyHash = createHash("sha256").update(body).digest("base64url");
const signature = createHmac("sha256", secret).update(`1:${timestamp}:${clientKey}:${bodyHash}`).digest("base64url");

expect(clientKey).toBe("tF6F8G4h8B5npHadMGeGvVvVoCOVu5u4JLz-UAIars8");
expect(bodyHash).toBe("-oLn2LVW-E8SN7pLQZTRzlxmCPXrVW9Sy8KFq_szf2A");
expect(signature).toBe("0v55Hs8WlyNFhC7uOZTXMG_3DE3jyLnK_5YWzAwNG_w");

function request(overrides: { body?: string; timestamp?: string; signature?: string; omit?: string } = {}) {
  const headers = new Headers({
    "Content-Type": "application/json",
    "x-dr-nona-proxy-version": "1",
    "x-dr-nona-proxy-timestamp": overrides.timestamp ?? timestamp,
    "x-dr-nona-client-key": clientKey,
    "x-dr-nona-proxy-signature": overrides.signature ?? signature,
  });
  if (overrides.omit) headers.delete(overrides.omit);
  return new Request("https://crm.example/api/applications", {
    method: "POST",
    headers,
    body: overrides.body ?? body,
  });
}

describe("catalog proxy signature verification", () => {
  test("accepts the shared cross-repository signature vector", async () => {
    await expect(verifyApplicationProxyRequest(request(), secret, () => 1_800_000_000_000)).resolves.toEqual({
      valid: true,
      clientKey,
    });
  });

  test("rejects tampered bodies, stale timestamps and missing headers", async () => {
    await expect(
      verifyApplicationProxyRequest(request({ body: `${body} ` }), secret, () => 1_800_000_000_000),
    ).resolves.toEqual({ valid: false, reason: "signature" });
    await expect(
      verifyApplicationProxyRequest(request({ timestamp: "1799999000" }), secret, () => 1_800_000_000_000),
    ).resolves.toEqual({ valid: false, reason: "expired" });
    await expect(
      verifyApplicationProxyRequest(request({ omit: "x-dr-nona-proxy-signature" }), secret, () => 1_800_000_000_000),
    ).resolves.toEqual({ valid: false, reason: "missing" });
  });
});
