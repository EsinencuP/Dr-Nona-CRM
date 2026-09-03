import type { ProviderResult } from "../application-types";

type TelegramResponse = {
  ok?: boolean;
  result?: { message_id?: number };
  error_code?: number;
  parameters?: { retry_after?: number };
};

export type TelegramProviderOptions = {
  botToken: string;
  chatId: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
};

export async function sendTelegramApplication(
  message: string,
  options: TelegramProviderOptions,
): Promise<ProviderResult> {
  const startedAt = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? 8_000);
  try {
    const response = await (options.fetchImpl ?? fetch)(`https://api.telegram.org/bot${options.botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: options.chatId,
        text: message,
        disable_web_page_preview: true,
      }),
      signal: controller.signal,
    });
    let payload: TelegramResponse;
    try {
      payload = (await response.json()) as TelegramResponse;
    } catch {
      return {
        provider: "telegram",
        status: "failed",
        statusCode: response.status,
        errorCode: "MALFORMED_RESPONSE",
        durationMs: Date.now() - startedAt,
      };
    }
    if (!response.ok || payload.ok !== true || typeof payload.result?.message_id !== "number") {
      return {
        provider: "telegram",
        status: "failed",
        statusCode: response.status,
        errorCode: response.status === 429 ? "RATE_LIMITED" : `HTTP_${response.status || payload.error_code || 0}`,
        durationMs: Date.now() - startedAt,
      };
    }
    return {
      provider: "telegram",
      status: "sent",
      providerMessageId: String(payload.result.message_id),
      durationMs: Date.now() - startedAt,
    };
  } catch (error) {
    return {
      provider: "telegram",
      status: "failed",
      errorCode: error instanceof DOMException && error.name === "AbortError" ? "TIMEOUT" : "NETWORK_ERROR",
      durationMs: Date.now() - startedAt,
    };
  } finally {
    clearTimeout(timer);
  }
}
