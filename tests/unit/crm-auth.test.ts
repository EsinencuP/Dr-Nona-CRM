import { describe, expect, test } from "vitest";

import { evaluateCrmBasicAuth, isPublicCrmApiPath } from "../../src/server/basic-auth";

const configured = {
  CRM_BASIC_USER: "manager",
  CRM_BASIC_PASSWORD: "secret-value",
};
const validHeader = `Basic ${Buffer.from("manager:secret-value").toString("base64")}`;

describe("CRM Basic Auth boundary", () => {
  test("fails closed in production when credentials are absent or partial", () => {
    expect(evaluateCrmBasicAuth(null, {}, "production")).toBe("unavailable");
    expect(evaluateCrmBasicAuth(null, { CRM_BASIC_USER: "manager" }, "production")).toBe("unavailable");
    expect(evaluateCrmBasicAuth(null, { CRM_BASIC_PASSWORD: "secret" }, "production")).toBe("unavailable");
  });

  test("allows credential-free local development only when both values are absent", () => {
    expect(evaluateCrmBasicAuth(null, {}, "development")).toBe("allow");
    expect(evaluateCrmBasicAuth(null, { CRM_BASIC_USER: "manager" }, "development")).toBe("unavailable");
  });

  test("accepts only the exact configured authorization value", () => {
    expect(evaluateCrmBasicAuth(validHeader, configured, "production")).toBe("allow");
    expect(evaluateCrmBasicAuth(`${validHeader}x`, configured, "production")).toBe("unauthorized");
    expect(evaluateCrmBasicAuth(validHeader.replace(/.$/u, "A"), configured, "production")).toBe("unauthorized");
    expect(evaluateCrmBasicAuth(null, configured, "production")).toBe("unauthorized");
  });

  test("keeps only the guarded application and Telegram endpoints public", () => {
    expect(isPublicCrmApiPath("/api/applications")).toBe(true);
    expect(isPublicCrmApiPath("/api/telegram-webhook")).toBe(true);
    expect(isPublicCrmApiPath("/api/applications/admin")).toBe(false);
    expect(isPublicCrmApiPath("/dashboard")).toBe(false);
    expect(isPublicCrmApiPath("/orders")).toBe(false);
  });
});
