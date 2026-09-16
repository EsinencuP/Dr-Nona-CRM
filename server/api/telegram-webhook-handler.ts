import type { OrderStatus } from "@prisma/client";

import {
  replaceAnyStatus,
  STATUS_CANCELLED,
  STATUS_DELIVERY,
  STATUS_DONE,
  STATUS_PROCESSING,
} from "../applications/format-application";
import { deleteTelegramMessage, editTelegramMessage } from "../applications/providers/telegram-edit";
import { sendTelegramApplication } from "../applications/providers/telegram-provider";
import { jsonResponse } from "../http/json-response";
import { type OrderStatusTransitionResult, transitionOrderStatus } from "../orders/order-status-service";
import {
  completeTelegramCommandAudit,
  consumeTelegramCommandRateLimit,
  getOverdueOrderSummary,
  getRedactedOrderSummary,
  reserveTelegramCommandAudit,
  TELEGRAM_MANAGER_HELP,
  telegramActorKey,
} from "../telegram/manager-commands";

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
    reply_to_message?: { message_id: number; from?: { id: number; is_bot?: boolean }; text?: string };
  };
};

export function parseManagerStatusCommand(text: string): OrderStatus | null {
  const normalized = text
    .trim()
    .toLowerCase()
    .replace(/^\/status(?:@[a-z0-9_]+)?\s+/u, "");
  if (DONE_KEYWORDS.has(normalized)) return "DONE";
  if (CANCEL_KEYWORDS.has(normalized)) return "CANCELLED";
  if (PROCESSING_KEYWORDS.has(normalized)) return "PROCESSING";
  if (DELIVERY_KEYWORDS.has(normalized)) return "DELIVERY";
  return null;
}

function getHeader(request: Request, name: string): string | null {
  try {
    if (typeof request.headers?.get === "function") return request.headers.get(name);
    const headers = (request as unknown as { headers?: Record<string, string | string[]> }).headers;
    const value = headers?.[name.toLowerCase()];
    return Array.isArray(value) ? value[0] : (value ?? null);
  } catch {
    return null;
  }
}

async function getUpdatePayload(request: Request): Promise<TelegramUpdate | null> {
  try {
    if (typeof request.json === "function") return (await request.json()) as TelegramUpdate;
    const body = (request as unknown as { body?: unknown }).body;
    if (body && typeof body === "object") return body as TelegramUpdate;
    if (typeof body === "string") return JSON.parse(body) as TelegramUpdate;
  } catch {
    return null;
  }
  return null;
}

type WebhookEnvironment = {
  botToken: string;
  webhookSecret: string;
  chatId: string;
  managerUserIds: ReadonlySet<string>;
};

export type WebhookHandlerDependencies = {
  getEnvironment?: () => WebhookEnvironment | null;
  editMessage?: typeof editTelegramMessage;
  deleteMessage?: typeof deleteTelegramMessage;
  updateOrderStatus?: (
    telegramMessageId: string,
    status: OrderStatus,
    actorKey: string,
  ) => Promise<OrderStatusTransitionResult | boolean>;
  reserveCommand?: typeof reserveTelegramCommandAudit;
  completeCommand?: typeof completeTelegramCommandAudit;
  rateLimit?: (actorKey: string) => Promise<boolean>;
  getOrderSummary?: typeof getRedactedOrderSummary;
  getOverdueSummary?: typeof getOverdueOrderSummary;
  sendText?: (text: string, environment: WebhookEnvironment) => Promise<unknown>;
  logger?: (metadata: Record<string, unknown>) => void;
};

function statusOutcome(result: OrderStatusTransitionResult | boolean) {
  if (typeof result === "boolean") return result ? "updated" : "not_found";
  return result.outcome;
}

export function createTelegramWebhookHandler(dependencies: WebhookHandlerDependencies = {}) {
  return async function telegramWebhookHandler(request: Request): Promise<Response> {
    const log = dependencies.logger ?? console.info;
    try {
      if (request.method !== "POST")
        return jsonResponse({ ok: false, code: "METHOD_NOT_ALLOWED" }, 405, { Allow: "POST" });
      const managerIds = new Set(
        (process.env.TELEGRAM_MANAGER_USER_IDS ?? "")
          .split(",")
          .map((value) => value.trim())
          .filter(Boolean),
      );
      const environment = dependencies.getEnvironment
        ? dependencies.getEnvironment()
        : {
            botToken: process.env.TELEGRAM_BOT_TOKEN?.trim() ?? "",
            webhookSecret: process.env.TELEGRAM_WEBHOOK_SECRET?.trim() ?? "",
            chatId: process.env.TELEGRAM_CHAT_ID?.trim() ?? "",
            managerUserIds: managerIds,
          };
      if (
        !environment?.botToken ||
        !environment.webhookSecret ||
        !environment.chatId ||
        environment.managerUserIds.size === 0
      ) {
        return jsonResponse({ ok: false, code: "SERVICE_UNAVAILABLE" }, 503);
      }
      if (getHeader(request, "x-telegram-bot-api-secret-token") !== environment.webhookSecret) {
        return jsonResponse({ ok: false, code: "FORBIDDEN" }, 403);
      }
      const update = await getUpdatePayload(request);
      if (!update?.message) return jsonResponse({ ok: true }, 200);
      const message = update.message;
      const messageText = message.text;
      if (!messageText) return jsonResponse({ ok: true }, 200);
      if (String(message.chat.id) !== environment.chatId) {
        log({ event: "webhook.ignored", reason: "chat_mismatch" });
        return jsonResponse({ ok: true }, 200);
      }
      const senderId = message.from?.id ? String(message.from.id) : "";
      if (!senderId || !environment.managerUserIds.has(senderId)) {
        log({ event: "webhook.ignored", reason: "sender_not_authorized" });
        return jsonResponse({ ok: true }, 200);
      }

      const matchedStatus = parseManagerStatusCommand(messageText);
      const normalized = messageText.trim();
      const commandName = matchedStatus
        ? "status"
        : normalized.match(/^\/(help|order|overdue)(?:@[a-z0-9_]+)?(?:\s|$)/iu)?.[1]?.toLowerCase();
      if (!commandName) return jsonResponse({ ok: true }, 200);

      const actorKey = telegramActorKey(senderId, environment.webhookSecret);
      const isolatedDependencyMode = Boolean(dependencies.updateOrderStatus);
      const rateLimit =
        dependencies.rateLimit ?? (isolatedDependencyMode ? async () => true : consumeTelegramCommandRateLimit);
      if (!(await rateLimit(actorKey))) {
        log({ event: "webhook.ignored", reason: "rate_limit" });
        return jsonResponse({ ok: true }, 200);
      }
      const updateId = String(update.update_id);
      const reserveCommand =
        dependencies.reserveCommand ?? (isolatedDependencyMode ? async () => true : reserveTelegramCommandAudit);
      if (!(await reserveCommand({ updateId, actorKey, command: commandName }))) {
        return jsonResponse({ ok: true }, 200);
      }
      const complete = async (outcome: string, orderId?: string) => {
        const completeCommand =
          dependencies.completeCommand ??
          (isolatedDependencyMode ? async () => undefined : completeTelegramCommandAudit);
        await completeCommand(updateId, outcome, orderId).catch(() => undefined);
      };
      const sendText = async (text: string) => {
        if (dependencies.sendText) return dependencies.sendText(text, environment);
        return sendTelegramApplication(text, { botToken: environment.botToken, chatId: environment.chatId });
      };

      if (matchedStatus) {
        const reply = message.reply_to_message;
        if (!reply?.from?.is_bot) {
          await sendText("Команда /status должна быть ответом на карточку заявки.");
          await complete("REJECTED_NOT_REPLY");
          return jsonResponse({ ok: true }, 200);
        }
        const updateStatus =
          dependencies.updateOrderStatus ??
          ((telegramMessageId, status, key) =>
            transitionOrderStatus({ telegramMessageId, nextStatus: status, source: "telegram_reply", actorKey: key }));
        const result = await updateStatus(String(reply.message_id), matchedStatus, actorKey);
        const outcome = statusOutcome(result);
        let orderId: string | undefined;
        if (typeof result !== "boolean" && "orderId" in result) orderId = result.orderId;
        if (outcome !== "updated" && outcome !== "unchanged") {
          await sendText(
            outcome === "invalid_transition" ? "Этот переход статуса запрещён." : "Карточка не связана с заявкой CRM.",
          );
          await complete(outcome.toUpperCase(), orderId);
          return jsonResponse({ ok: true }, 200);
        }
        const nextStatusLine = STATUS_LINES[matchedStatus];
        const updatedText =
          replaceAnyStatus(reply.text ?? "", nextStatusLine) ??
          [reply.text?.trim(), nextStatusLine].filter(Boolean).join("\n\n");
        const edit = dependencies.editMessage ?? editTelegramMessage;
        const remove = dependencies.deleteMessage ?? deleteTelegramMessage;
        if (matchedStatus === "DONE" || matchedStatus === "CANCELLED") {
          await Promise.resolve(remove(message.chat.id, reply.message_id, { botToken: environment.botToken })).catch(
            () => undefined,
          );
        } else {
          await Promise.resolve(
            edit(message.chat.id, reply.message_id, updatedText, { botToken: environment.botToken }),
          ).catch(() => undefined);
        }
        await Promise.resolve(remove(message.chat.id, message.message_id, { botToken: environment.botToken })).catch(
          () => undefined,
        );
        await complete(outcome.toUpperCase(), orderId);
        log({ event: "webhook.status_update", newStatus: matchedStatus, outcome });
        return jsonResponse({ ok: true }, 200);
      }

      if (commandName === "help") {
        await sendText(TELEGRAM_MANAGER_HELP);
        await complete("HELP_SENT");
      } else if (commandName === "overdue") {
        await sendText(await (dependencies.getOverdueSummary ?? getOverdueOrderSummary)());
        await complete("OVERDUE_SENT");
      } else {
        const orderId = normalized.replace(/^\/order(?:@[a-z0-9_]+)?\s*/iu, "").trim();
        if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(orderId)) {
          await sendText("Укажите полный ID: /order <uuid>.");
          await complete("REJECTED_INVALID_ID");
        } else {
          const summary = await (dependencies.getOrderSummary ?? getRedactedOrderSummary)(orderId);
          await sendText(summary ?? "Заявка не найдена.");
          await complete(summary ? "ORDER_SENT" : "ORDER_NOT_FOUND", summary ? orderId : undefined);
        }
      }
      return jsonResponse({ ok: true }, 200);
    } catch {
      log({ event: "webhook.uncaught", outcome: "ignored" });
      return jsonResponse({ ok: true }, 200);
    }
  };
}

const defaultHandler = createTelegramWebhookHandler();
export default { fetch: defaultHandler };
