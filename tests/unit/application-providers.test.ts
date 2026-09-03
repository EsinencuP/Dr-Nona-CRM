import { describe, expect, test, vi } from "vitest";

import { sendTelegramApplication } from "../../server/applications/providers/telegram-provider";

const hangingFetch: typeof fetch = (_input, init) =>
  new Promise((_resolve, reject) => {
    init?.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
  });

describe("Telegram provider", () => {
  test("sends JSON without parse_mode and returns message ID", async () => {
    const fetchImpl = vi.fn(async () => Response.json({ ok: true, result: { message_id: 42 } }));
    const result = await sendTelegramApplication("plain text", {
      botToken: "test-token",
      chatId: "test-chat",
      fetchImpl,
    });
    expect(result).toMatchObject({
      provider: "telegram",
      status: "sent",
      providerMessageId: "42",
    });
    const calls = fetchImpl.mock.calls as unknown as [RequestInfo | URL, RequestInit?][];
    const body = JSON.parse(String(calls[0][1]?.body));
    expect(body).toEqual({
      chat_id: "test-chat",
      text: "plain text",
      disable_web_page_preview: true,
    });
    expect(body).not.toHaveProperty("parse_mode");
  });

  test.each([400, 401, 403, 429, 500])("handles HTTP %s", async (status) => {
    const result = await sendTelegramApplication("message", {
      botToken: "test",
      chatId: "chat",
      fetchImpl: async () => Response.json({ ok: false, error_code: status }, { status }),
    });
    expect(result).toMatchObject({ status: "failed", statusCode: status });
  });

  test("handles non-JSON and malformed success responses", async () => {
    for (const response of [new Response("bad", { status: 500 }), Response.json({ ok: true })]) {
      const result = await sendTelegramApplication("message", {
        botToken: "test",
        chatId: "chat",
        fetchImpl: async () => response,
      });
      expect(result.status).toBe("failed");
    }
  });

  test("times out", async () => {
    const result = await sendTelegramApplication("message", {
      botToken: "test",
      chatId: "chat",
      fetchImpl: hangingFetch,
      timeoutMs: 1,
    });
    expect(result).toMatchObject({ status: "failed", errorCode: "TIMEOUT" });
  });
});
