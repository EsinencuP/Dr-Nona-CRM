import { afterAll, describe, expect, test } from "vitest";

import {
  getDbClient,
  type OrderStatus,
  saveApplicationToDb,
  saveMessageIdToDb,
  updateOrderStatusByTelegramMessageId,
} from "../../server/applications/application-db.js";

describe("database and status integration", () => {
  const db = getDbClient();
  const runSuffix = `${process.pid}${Date.now()}`.slice(-7);
  const testPhone = `+373 6${runSuffix}`;
  const testPhoneNormalized = `+3736${runSuffix}`;

  afterAll(async () => {
    const client = await db.client.findUnique({
      where: { phoneNormalized: testPhoneNormalized },
    });
    if (client) {
      const orders = await db.order.findMany({
        where: { clientId: client.id },
        select: { id: true },
      });
      const orderIds = orders.map((order) => order.id);
      await db.$transaction([
        db.orderItem.deleteMany({ where: { orderId: { in: orderIds } } }),
        db.order.deleteMany({ where: { clientId: client.id } }),
        db.client.delete({ where: { id: client.id } }),
      ]);
    }
    await db.$disconnect();
  });

  test("persists an order and every lifecycle status transition", async () => {
    const orderId = `test-order-lifecycle-${process.pid}-${Date.now()}`;
    const telegramMessageId = `tg-${process.pid}-${Date.now()}`;
    const saveResult = await saveApplicationToDb(
      {
        requestId: orderId,
        firstName: "Алексей",
        lastName: "Морарь",
        phone: testPhone,
        phoneNormalized: testPhoneNormalized,
        region: "Кишинёв",
        type: "order",
        products: [{ slug: "solaris-body-lotion", quantity: 3 }],
      },
      db,
    );
    expect(saveResult).toEqual({ success: true, orderId });

    await saveMessageIdToDb(orderId, telegramMessageId, db);

    const persisted = await db.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    });
    expect(persisted).toMatchObject({
      id: orderId,
      type: "order",
      status: "NEW",
      telegramMessageId,
      items: [
        {
          productSlug: "solaris-body-lotion",
          quantity: 3,
        },
      ],
    });

    const transitions: OrderStatus[] = ["PROCESSING", "DELIVERY", "CANCELLED", "DONE"];
    for (const status of transitions) {
      await expect(updateOrderStatusByTelegramMessageId(telegramMessageId, status, db)).resolves.toBe(true);
      await expect(
        db.order.findUnique({
          where: { id: orderId },
          select: { status: true },
        }),
      ).resolves.toEqual({ status });
    }

    await expect(updateOrderStatusByTelegramMessageId("unknown-message", "DONE", db)).resolves.toBe(false);
    await expect(
      db.order.findUnique({
        where: { id: orderId },
        select: { status: true },
      }),
    ).resolves.toEqual({ status: "DONE" });
  });
});
