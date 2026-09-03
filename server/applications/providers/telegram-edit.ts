import type { TelegramProviderOptions } from "./telegram-provider";

type TelegramApiResult = { ok: true } | { ok: false; errorCode: string; statusCode?: number };

/**
 * Edit an existing Telegram message text via Bot API `editMessageText`.
 */
export async function editTelegramMessage(
  chatId: string | number,
  messageId: number,
  text: string,
  options: Pick<TelegramProviderOptions, "botToken" | "fetchImpl" | "timeoutMs">,
): Promise<TelegramApiResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? 8_000);
  try {
    const response = await (options.fetchImpl ?? fetch)(
      `https://api.telegram.org/bot${options.botToken}/editMessageText`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          message_id: messageId,
          text,
        }),
        signal: controller.signal,
      },
    );
    if (!response.ok) {
      return {
        ok: false,
        errorCode: `HTTP_${response.status}`,
        statusCode: response.status,
      };
    }
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      errorCode: error instanceof DOMException && error.name === "AbortError" ? "TIMEOUT" : "NETWORK_ERROR",
    };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Delete a Telegram message via Bot API `deleteMessage`.
 */
export async function deleteTelegramMessage(
  chatId: string | number,
  messageId: number,
  options: Pick<TelegramProviderOptions, "botToken" | "fetchImpl" | "timeoutMs">,
): Promise<TelegramApiResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? 8_000);
  try {
    const response = await (options.fetchImpl ?? fetch)(
      `https://api.telegram.org/bot${options.botToken}/deleteMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          message_id: messageId,
        }),
        signal: controller.signal,
      },
    );
    if (!response.ok) {
      return {
        ok: false,
        errorCode: `HTTP_${response.status}`,
        statusCode: response.status,
      };
    }
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      errorCode: error instanceof DOMException && error.name === "AbortError" ? "TIMEOUT" : "NETWORK_ERROR",
    };
  } finally {
    clearTimeout(timer);
  }
}
