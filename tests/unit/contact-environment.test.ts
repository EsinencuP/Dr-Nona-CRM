import { describe, expect, test } from "vitest";

import { readContactEnvironment } from "../../server/config/contact-env";
import { requestOriginIsAllowed } from "../../server/http/request-validation";

describe("contact deployment environment", () => {
  test("requires the server-side Telegram credentials and proxy secret", () => {
    expect(
      readContactEnvironment({
        TELEGRAM_BOT_TOKEN: "test-token",
        TELEGRAM_CHAT_ID: "test-chat",
        CONTACT_PROXY_SHARED_SECRET: "test-shared-secret",
      }),
    ).toEqual({
      success: true,
      value: {
        allowedOrigins: new Set(),
        telegramBotToken: "test-token",
        telegramChatId: "test-chat",
        proxySharedSecret: "test-shared-secret",
        telegramWebhookSecret: undefined,
        telegramManagerUserIds: new Set(),
      },
    });
  });

  test("adds Vercel preview, branch and production origins", () => {
    const result = readContactEnvironment({
      TELEGRAM_BOT_TOKEN: "test-token",
      TELEGRAM_CHAT_ID: "test-chat",
      CONTACT_PROXY_SHARED_SECRET: "test-shared-secret",
      VERCEL_URL: "dr-nona-preview.vercel.app",
      VERCEL_BRANCH_URL: "dr-nona-git-main.vercel.app",
      VERCEL_PROJECT_PRODUCTION_URL: "dr-nona.md",
    });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.value.allowedOrigins).toEqual(
      new Set(["https://dr-nona-preview.vercel.app", "https://dr-nona-git-main.vercel.app", "https://dr-nona.md"]),
    );
  });

  test("fails closed when the proxy secret is missing", () => {
    expect(
      readContactEnvironment({
        TELEGRAM_BOT_TOKEN: "test-token",
        TELEGRAM_CHAT_ID: "test-chat",
      }),
    ).toEqual({ success: false, missing: ["CONTACT_PROXY_SHARED_SECRET"] });
  });

  test("accepts the deployment's own origin without a hardcoded domain", () => {
    const request = new Request("https://dr-nona-preview.vercel.app/api/applications", {
      headers: { Origin: "https://dr-nona-preview.vercel.app" },
    });

    expect(requestOriginIsAllowed(request, new Set())).toBe(true);
  });

  test("rejects a foreign origin even on a Vercel deployment", () => {
    const request = new Request("https://dr-nona-preview.vercel.app/api/applications", {
      headers: { Origin: "https://example.test" },
    });

    expect(requestOriginIsAllowed(request, new Set())).toBe(false);
  });
});
