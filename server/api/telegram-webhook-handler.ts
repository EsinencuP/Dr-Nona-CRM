import { type OrderStatus, updateOrderStatusByTelegramMessageId } from "../applications/application-db";
import {
  replaceAnyStatus,
  STATUS_CANCELLED,
  STATUS_DELIVERY,
  STATUS_DONE,
  STATUS_PROCESSING,
} from "../applications/format-application";
import { deleteTelegramMessage, editTelegramMessage } from "../applications/providers/telegram-edit";
import { jsonResponse } from "../http/json-response";

const DONE_KEYWORDS = new Set(["ok", "ок", "готово", "сделано", "done", "ready", "выполнено"]);

const CANCEL_KEYWORDS = new Set(["отмена", "отменить", "cancel", "отклон", "отказ", "cancelled"]);

const PROCESSING_KEYWORDS = new Set(["в работе", "процесс", "processing", "in progress", "принято", "беру", "work"]);

const DELIVERY_KEYWORDS = new Set(["доставка", "в доставке", "отправлено", "курьер", "почта", "delivery", "shipped"]);

const STATUS_LINES: Record<OrderStatus, string> = {
  NEW: STATUS_PROCESSING,
  PROCESSING: STATUS_PROCESSING,
  DELIVERY: STATUS_DELIVERY,
  DONE: STATUS_DONE,
  CANCELLED: STATUS_CANCELLED,
};

export type TelegramUpdate = {
  update_id: number;
  message?: {
    message_id: number;
    chat: { id: number | string };
    from?: { id: number; first_name?: string };
    text?: string;
    reply_to_message?: {
      message_id: number;
      from?: { id: number; is_bot?: boolean };
      text?: string;
    };
  };
};

export function parseManagerStatusCommand(text: string): OrderStatus | null {
  const normalized = text.trim().toLowerCase();
  if (DONE_KEYWORDS.has(normalized)) return "DONE";
  if (CANCEL_KEYWORDS.has(normalized)) return "CANCELLED";
  if (PROCESSING_KEYWORDS.has(normalized)) return "PROCESSING";
  if (DELIVERY_KEYWORDS.has(normalized)) return "DELIVERY";
  return null;
}

function getHeader(request: Request, name: string): string | null {
  try {
    if (typeof request.headers?.get === "function") {
      return request.headers.get(name);
    }
    const headersObj = (request as unknown as { headers?: Record<string, string | string[]> }).headers;
    if (headersObj && typeof headersObj === "object") {
      const val = headersObj[name.toLowerCase()];
      return Array.isArray(val) ? val[0] : (val ?? null);
    }
  } catch {
    return null;
  }
  return null;
}

async function getUpdatePayload(request: Request): Promise<TelegramUpdate | null> {
  try {
    if (typeof request.json === "function") {
      return (await request.json()) as TelegramUpdate;
    }
    const reqObj = request as unknown as { body?: unknown };
    if (reqObj.body && typeof reqObj.body === "object") {
      return reqObj.body as TelegramUpdate;
    }
    if (typeof reqObj.body === "string") {
      return JSON.parse(reqObj.body) as TelegramUpdate;
    }
  } catch {
    return null;
  }
  return null;
}

export type WebhookHandlerDependencies = {
  getEnvironment?: () => { botToken: string; webhookSecret: string } | null;
  editMessage?: typeof editTelegramMessage;
  deleteMessage?: typeof deleteTelegramMessage;
  updateOrderStatus?: typeof updateOrderStatusByTelegramMessageId;
  logger?: (metadata: Record<string, unknown>) => void;
};

export function createTelegramWebhookHandler(dependencies: WebhookHandlerDependencies = {}) {
  return async function telegramWebhookHandler(request: Request): Promise<Response> {
    try {
      if (request.method !== "POST") {
        return jsonResponse({ ok: false, code: "METHOD_NOT_ALLOWED" }, 405, {
          Allow: "POST",
        });
      }

      const env = dependencies.getEnvironment
        ? dependencies.getEnvironment()
        : {
            botToken: process.env.TELEGRAM_BOT_TOKEN?.trim() ?? "",
            webhookSecret: process.env.TELEGRAM_WEBHOOK_SECRET?.trim() ?? "",
          };

      if (!env?.botToken || !env?.webhookSecret) {
        return jsonResponse({ ok: false, code: "SERVICE_UNAVAILABLE" }, 503);
      }

      // Verify the secret token sent by Telegram
      const secretHeader = getHeader(request, "x-telegram-bot-api-secret-token");
      if (secretHeader !== env.webhookSecret) {
        return jsonResponse({ ok: false, code: "FORBIDDEN" }, 403);
      }

      const update = await getUpdatePayload(request);
      if (!update?.message) {
        return jsonResponse({ ok: true }, 200);
      }

      const message = update.message;
      if (!message.text || !message.reply_to_message) {
        return jsonResponse({ ok: true }, 200);
      }

      // Only react when the reply is to a bot message
      if (!message.reply_to_message.from?.is_bot) {
        return jsonResponse({ ok: true }, 200);
      }

      const originalText = message.reply_to_message.text;
      if (!originalText) {
        return jsonResponse({ ok: true }, 200);
      }

      const matchedStatus = parseManagerStatusCommand(message.text);
      if (!matchedStatus) {
        return jsonResponse({ ok: true }, 200);
      }

      const nextStatusLine = STATUS_LINES[matchedStatus];
      const updatedText = replaceAnyStatus(originalText, nextStatusLine);
      if (!updatedText) {
        return jsonResponse({ ok: true }, 200);
      }

      const updateStatusFn = dependencies.updateOrderStatus ?? updateOrderStatusByTelegramMessageId;
      const editFn = dependencies.editMessage ?? editTelegramMessage;
      const deleteFn = dependencies.deleteMessage ?? deleteTelegramMessage;
      const logFn = dependencies.logger ?? console.info;
      const orderMessageId = message.reply_to_message.message_id;
      const managerCommandMessageId = message.message_id;
      const chatId = message.chat.id;

      const databaseUpdated = await updateStatusFn(String(orderMessageId), matchedStatus).catch(() => false);

      if (matchedStatus === "DONE" || matchedStatus === "CANCELLED") {
        await deleteFn(chatId, orderMessageId, {
          botToken: env.botToken,
        }).catch(() => undefined);
        await deleteFn(chatId, managerCommandMessageId, {
          botToken: env.botToken,
        }).catch(() => undefined);
      } else {
        await editFn(chatId, orderMessageId, updatedText, {
          botToken: env.botToken,
        }).catch(() => undefined);
        await deleteFn(chatId, managerCommandMessageId, {
          botToken: env.botToken,
        }).catch(() => undefined);
      }

      logFn({
        event: "webhook.status_update",
        chatId,
        originalMessageId: orderMessageId,
        replyFrom: message.from?.first_name,
        newStatus: matchedStatus,
        databaseUpdated,
      });

      return jsonResponse({ ok: true }, 200);
    } catch (error) {
      console.error("Telegram webhook uncaught error:", error);
      return jsonResponse({ ok: true }, 200);
    }
  };
}

const defaultHandler = createTelegramWebhookHandler();

export default {
  fetch: defaultHandler,
};
