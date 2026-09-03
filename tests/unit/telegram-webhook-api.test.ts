import { describe, expect, test, vi } from "vitest";

import {
  createTelegramWebhookHandler,
  parseManagerStatusCommand,
  type TelegramUpdate,
} from "../../api/telegram-webhook.js";
import type { OrderStatus } from "../../server/applications/application-db.js";
import { STATUS_DELIVERY, STATUS_PENDING, STATUS_PROCESSING } from "../../server/applications/format-application.js";

const env = {
  botToken: "test-bot-token",
  webhookSecret: "test-secret-123",
};

const makeRequest = (
  body: TelegramUpdate | Record<string, unknown> = {},
  overrides: { method?: string; secret?: string } = {},
) =>
  new Request("https://example.test/api/telegram-webhook", {
    method: overrides.method ?? "POST",
    headers: {
      "Content-Type": "application/json",
      ...(overrides.secret !== undefined
        ? { "x-telegram-bot-api-secret-token": overrides.secret }
        : { "x-telegram-bot-api-secret-token": "test-secret-123" }),
    },
    ...(overrides.method === "GET" ? {} : { body: JSON.stringify(body) }),
  });

const replyUpdate = (command: string, statusLine: string = STATUS_PENDING): TelegramUpdate => ({
  update_id: 4,
  message: {
    message_id: 40,
    chat: { id: -100123 },
    from: { id: 777, first_name: "Manager" },
    text: command,
    reply_to_message: {
      message_id: 39,
      from: { id: 999, is_bot: true },
      text: `🛒 НОВЫЙ ЗАКАЗ\nИмя: Test\n\n${statusLine}`,
    },
  },
});

describe("parseManagerStatusCommand", () => {
  test.each([
    ["ok", "DONE"],
    ["ОК", "DONE"],
    ["готово", "DONE"],
    ["сделано", "DONE"],
    ["done", "DONE"],
    ["ready", "DONE"],
    ["выполнено", "DONE"],
    ["отмена", "CANCELLED"],
    ["отменить", "CANCELLED"],
    ["cancel", "CANCELLED"],
    ["отклон", "CANCELLED"],
    ["отказ", "CANCELLED"],
    ["cancelled", "CANCELLED"],
    ["в работе", "PROCESSING"],
    ["процесс", "PROCESSING"],
    ["processing", "PROCESSING"],
    ["in progress", "PROCESSING"],
    ["принято", "PROCESSING"],
    ["беру", "PROCESSING"],
    ["work", "PROCESSING"],
    ["доставка", "DELIVERY"],
    ["в доставке", "DELIVERY"],
    ["отправлено", "DELIVERY"],
    ["курьер", "DELIVERY"],
    ["почта", "DELIVERY"],
    ["delivery", "DELIVERY"],
    ["shipped", "DELIVERY"],
  ] as const)("maps '%s' to %s", (command, status) => {
    expect(parseManagerStatusCommand(`  ${command}  `)).toBe(status);
  });

  test.each(["hello", "нет", "pending", "123", ""])("rejects '%s'", (command) => {
    expect(parseManagerStatusCommand(command)).toBeNull();
  });
});

describe("POST /api/telegram-webhook", () => {
  test("returns 405 for non-POST method", async () => {
    const handler = createTelegramWebhookHandler({
      getEnvironment: () => env,
    });
    const response = await handler(makeRequest({}, { method: "GET" }));
    expect(response.status).toBe(405);
    expect(response.headers.get("Allow")).toBe("POST");
  });

  test("returns 503 when environment is missing", async () => {
    const handler = createTelegramWebhookHandler({
      getEnvironment: () => null,
    });
    const response = await handler(makeRequest({}));
    expect(response.status).toBe(503);
  });

  test("returns 403 when secret token is wrong", async () => {
    const handler = createTelegramWebhookHandler({
      getEnvironment: () => env,
    });
    const response = await handler(makeRequest({}, { secret: "wrong-secret" }));
    expect(response.status).toBe(403);
  });

  test("ignores updates that are not replies to bot messages", async () => {
    const editMessage = vi.fn();
    const updateOrderStatus = vi.fn();
    const handler = createTelegramWebhookHandler({
      getEnvironment: () => env,
      editMessage,
      updateOrderStatus,
    });
    const response = await handler(
      makeRequest({
        update_id: 2,
        message: {
          message_id: 20,
          chat: { id: 123 },
          text: "ok",
          reply_to_message: {
            message_id: 19,
            from: { id: 456, is_bot: false },
            text: `Заявка\n\n${STATUS_PENDING}`,
          },
        },
      }),
    );

    expect(response.status).toBe(200);
    expect(editMessage).not.toHaveBeenCalled();
    expect(updateOrderStatus).not.toHaveBeenCalled();
  });

  test("ignores unknown commands and bot messages without a status line", async () => {
    const editMessage = vi.fn();
    const deleteMessage = vi.fn();
    const updateOrderStatus = vi.fn();
    const handler = createTelegramWebhookHandler({
      getEnvironment: () => env,
      editMessage,
      deleteMessage,
      updateOrderStatus,
    });

    const unknownResponse = await handler(makeRequest(replyUpdate("вопрос по заявке")));
    const unrelatedMessage = replyUpdate("готово");
    if (unrelatedMessage.message?.reply_to_message) {
      unrelatedMessage.message.reply_to_message.text = "Служебное сообщение";
    }
    const unrelatedResponse = await handler(makeRequest(unrelatedMessage));

    expect(unknownResponse.status).toBe(200);
    expect(unrelatedResponse.status).toBe(200);
    expect(updateOrderStatus).not.toHaveBeenCalled();
    expect(editMessage).not.toHaveBeenCalled();
    expect(deleteMessage).not.toHaveBeenCalled();
  });

  test.each([
    ["беру", "PROCESSING", STATUS_PROCESSING, STATUS_PENDING],
    ["отправлено", "DELIVERY", STATUS_DELIVERY, STATUS_PROCESSING],
  ] as const)(
    "%s updates DB and edits the active card without deleting it",
    async (command, status, nextStatusLine, currentStatusLine) => {
      const editMessage = vi.fn(async () => ({ ok: true as const }));
      const deleteMessage = vi.fn(async () => ({ ok: true as const }));
      const updateOrderStatus = vi.fn(async () => true);
      const logger = vi.fn();
      const handler = createTelegramWebhookHandler({
        getEnvironment: () => env,
        editMessage,
        deleteMessage,
        updateOrderStatus,
        logger,
      });

      const response = await handler(makeRequest(replyUpdate(command, currentStatusLine)));

      expect(response.status).toBe(200);
      expect(updateOrderStatus).toHaveBeenCalledWith("39", status);
      expect(editMessage).toHaveBeenCalledWith(-100123, 39, `🛒 НОВЫЙ ЗАКАЗ\nИмя: Test\n\n${nextStatusLine}`, {
        botToken: "test-bot-token",
      });
      expect(deleteMessage).toHaveBeenCalledTimes(1);
      expect(deleteMessage).toHaveBeenCalledWith(-100123, 40, {
        botToken: "test-bot-token",
      });
      expect(deleteMessage).not.toHaveBeenCalledWith(-100123, 39, expect.any(Object));
      expect(logger).toHaveBeenCalledWith(
        expect.objectContaining({
          event: "webhook.status_update",
          originalMessageId: 39,
          newStatus: status,
          databaseUpdated: true,
        }),
      );
    },
  );

  test.each([
    ["готово", "DONE", STATUS_DELIVERY],
    ["отмена", "CANCELLED", STATUS_DELIVERY],
  ] as const)(
    "%s updates DB and deletes both the terminal card and command",
    async (command, status, currentStatusLine) => {
      const editMessage = vi.fn();
      const deleteMessage = vi.fn(async () => ({ ok: true as const }));
      const updateOrderStatus = vi.fn(async () => true);
      const handler = createTelegramWebhookHandler({
        getEnvironment: () => env,
        editMessage,
        deleteMessage,
        updateOrderStatus,
      });

      const response = await handler(makeRequest(replyUpdate(command, currentStatusLine)));

      expect(response.status).toBe(200);
      expect(updateOrderStatus).toHaveBeenCalledWith("39", status);
      expect(editMessage).not.toHaveBeenCalled();
      expect(deleteMessage).toHaveBeenCalledTimes(2);
      expect(deleteMessage).toHaveBeenNthCalledWith(1, -100123, 39, {
        botToken: "test-bot-token",
      });
      expect(deleteMessage).toHaveBeenNthCalledWith(2, -100123, 40, {
        botToken: "test-bot-token",
      });
    },
  );

  test("deletes the manager command even when an intermediate edit fails", async () => {
    const editMessage = vi.fn(async () => ({
      ok: false as const,
      errorCode: "HTTP_400",
      statusCode: 400,
    }));
    const deleteMessage = vi.fn(async () => ({ ok: true as const }));
    const handler = createTelegramWebhookHandler({
      getEnvironment: () => env,
      editMessage,
      deleteMessage,
      updateOrderStatus: vi.fn(async () => true),
    });

    const response = await handler(makeRequest(replyUpdate("в работе")));

    expect(response.status).toBe(200);
    expect(deleteMessage).toHaveBeenCalledWith(-100123, 40, {
      botToken: "test-bot-token",
    });
  });

  test("accepts every manager-controlled database status", async () => {
    const observedStatuses: OrderStatus[] = [];
    const updateOrderStatus = vi.fn(async (_messageId: string, status: OrderStatus) => {
      observedStatuses.push(status);
      return true;
    });
    const handler = createTelegramWebhookHandler({
      getEnvironment: () => env,
      editMessage: vi.fn(async () => ({ ok: true as const })),
      deleteMessage: vi.fn(async () => ({ ok: true as const })),
      updateOrderStatus,
    });

    for (const command of ["беру", "доставка", "готово", "отмена"]) {
      await handler(makeRequest(replyUpdate(command)));
    }

    expect(observedStatuses).toEqual(["PROCESSING", "DELIVERY", "DONE", "CANCELLED"]);
  });
});
