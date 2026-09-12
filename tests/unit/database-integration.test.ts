import { afterAll, describe, expect, test } from "vitest";

import {
  deleteOrderFromDb,
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
  const priceTestSlug = `test-price-snapshot-${process.pid}-${Date.now()}`;

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
    await db.productCatalog.deleteMany({ where: { slug: priceTestSlug } });
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

    await expect(deleteOrderFromDb(orderId, db)).resolves.toBe(true);
    await expect(deleteOrderFromDb(orderId, db)).resolves.toBe(false);
    await expect(db.order.findUnique({ where: { id: orderId } })).resolves.toBeNull();
    await expect(db.client.findUnique({ where: { phoneNormalized: testPhoneNormalized } })).resolves.toBeNull();
  }, 20_000);

  test("snapshots both fixed prices and never rewrites old items after catalogue changes", async () => {
    await db.productCatalog.create({
      data: { slug: priceTestSlug, sku: "TEST", retailPrice: 125.5, distributorPrice: 80.25 },
    });
    const firstId = `test-prices-first-${process.pid}-${Date.now()}`;
    const input = {
      requestId: firstId,
      firstName: "Test",
      lastName: "Snapshot",
      phone: testPhone,
      phoneNormalized: testPhoneNormalized,
      region: "Кишинёв",
      type: "order" as const,
      products: [{ slug: priceTestSlug, quantity: 2 }],
    };
    await expect(saveApplicationToDb(input, db)).resolves.toEqual({ success: true, orderId: firstId });
    await db.productCatalog.update({
      where: { slug: priceTestSlug },
      data: { retailPrice: 140, distributorPrice: 90 },
    });
    const secondId = `test-prices-second-${process.pid}-${Date.now()}`;
    await expect(saveApplicationToDb({ ...input, requestId: secondId }, db)).resolves.toEqual({
      success: true,
      orderId: secondId,
    });
    const first = await db.orderItem.findFirstOrThrow({ where: { orderId: firstId } });
    const second = await db.orderItem.findFirstOrThrow({ where: { orderId: secondId } });
    expect(first).toMatchObject({
      retailPriceAtPurchase: 125.5,
      distributorPriceAtPurchase: 80.25,
      priceAtPurchase: 125.5,
    });
    expect(second).toMatchObject({ retailPriceAtPurchase: 140, distributorPriceAtPurchase: 90 });
    await deleteOrderFromDb(firstId, db);
    await deleteOrderFromDb(secondId, db);
  }, 20_000);
});
