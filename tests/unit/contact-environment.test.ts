import { describe, expect, test } from "vitest";

import { readContactEnvironment } from "../../server/config/contact-env";
import { requestOriginIsAllowed } from "../../server/http/request-validation";

describe("contact deployment environment", () => {
  test("requires only the server-side Telegram credentials", () => {
    expect(
      readContactEnvironment({
        TELEGRAM_BOT_TOKEN: "test-token",
        TELEGRAM_CHAT_ID: "test-chat",
      }),
    ).toEqual({
      success: true,
      value: {
        allowedOrigins: new Set(),
        telegramBotToken: "test-token",
        telegramChatId: "test-chat",
      },
    });
  });

  test("adds Vercel preview, branch and production origins", () => {
    const result = readContactEnvironment({
      TELEGRAM_BOT_TOKEN: "test-token",
      TELEGRAM_CHAT_ID: "test-chat",
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
