import { afterAll, describe, expect, test } from "vitest";

import {
  completeApplicationDelivery,
  deleteOrderFromDb,
  getDbClient,
  markApplicationDeliveryFailed,
  type OrderStatus,
  saveApplicationToDb,
  saveMessageIdToDb,
  updateOrderStatusByTelegramMessageId,
} from "../../server/applications/application-db.js";
import { updateCanonicalClientProfile } from "../../server/clients/client-profile.js";
import {
  createApplicationRateLimitGuard,
  createPrismaRateLimitIncrement,
} from "../../server/http/application-rate-limit.js";

describe("database and status integration", () => {
  const db = getDbClient();
  const runSuffix = `${process.pid}${Date.now()}`.slice(-7);
  const testPhone = `+373 6${runSuffix}`;
  const testPhoneNormalized = `+3736${runSuffix}`;
  const priceTestSlug = `test-price-snapshot-${process.pid}-${Date.now()}`;
  const idempotencyOrderIds: string[] = [];
  const rateLimitClientKeys: string[] = [];

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
    for (const orderId of idempotencyOrderIds) {
      await deleteOrderFromDb(orderId, db);
    }
    await db.applicationRateLimitBucket.deleteMany({ where: { clientKey: { in: rateLimitClientKeys } } });
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
    expect(saveResult).toEqual({ success: true, orderId, disposition: "created" });

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

  test("preserves submitted contact snapshots and audits explicit profile edits", async () => {
    const suffix = `${process.pid}-${Date.now()}`;
    const firstId = `test-client-profile-a-${suffix}`;
    const secondId = `test-client-profile-b-${suffix}`;
    const original = {
      firstName: "Ana",
      lastName: "Popescu",
      phone: testPhone,
      phoneNormalized: testPhoneNormalized,
      email: "ana@example.test",
      region: "Кишинёв",
      type: "order" as const,
      products: [{ slug: "solaris-body-lotion", quantity: 1 }],
    };
    await expect(saveApplicationToDb({ ...original, requestId: firstId }, db)).resolves.toMatchObject({
      success: true,
    });
    await expect(
      saveApplicationToDb(
        {
          ...original,
          requestId: secondId,
          firstName: "Anna typo",
          lastName: "Popesku typo",
          email: undefined,
          region: "Бельцы",
        },
        db,
      ),
    ).resolves.toMatchObject({ success: true });

    const client = await db.client.findUniqueOrThrow({ where: { phoneNormalized: testPhoneNormalized } });
    expect(client).toMatchObject({
      firstName: "Ana",
      lastName: "Popescu",
      email: "ana@example.test",
      region: "Кишинёв",
    });
    const repeated = await db.order.findUniqueOrThrow({ where: { id: secondId } });
    expect(repeated).toMatchObject({
      submittedFirstName: "Anna typo",
      submittedLastName: "Popesku typo",
      submittedEmail: null,
      submittedRegion: "Бельцы",
    });

    await expect(
      updateCanonicalClientProfile(
        client.id,
        {
          firstName: "Ana-Maria",
          lastName: "Popescu",
          phone: testPhone,
          phoneNormalized: testPhoneNormalized,
          email: "ana@example.test",
          region: "Кишинёв",
        },
        "integration-manager",
        db,
      ),
    ).resolves.toEqual({ outcome: "updated" });
    const audit = await db.clientProfileAudit.findFirstOrThrow({ where: { clientId: client.id } });
    expect(audit).toMatchObject({ actor: "integration-manager" });
    expect(audit.before).toMatchObject({ firstName: "Ana" });
    expect(audit.after).toMatchObject({ firstName: "Ana-Maria" });
    expect(await db.order.findUniqueOrThrow({ where: { id: firstId } })).toMatchObject({
      submittedFirstName: "Ana",
    });

    const conflictPhone = `+373 7${runSuffix}`;
    const conflictNormalized = `+3737${runSuffix}`;
    const conflict = await db.client.create({
      data: {
        firstName: "Conflict",
        lastName: "Profile",
        phone: conflictPhone,
        phoneNormalized: conflictNormalized,
        region: "Кишинёв",
      },
    });
    await expect(
      updateCanonicalClientProfile(
        client.id,
        {
          firstName: "Ana-Maria",
          lastName: "Popescu",
          phone: conflictPhone,
          phoneNormalized: conflictNormalized,
          email: null,
          region: "Кишинёв",
        },
        "integration-manager",
        db,
      ),
    ).resolves.toEqual({ outcome: "phone_conflict" });
    await db.client.delete({ where: { id: conflict.id } });
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
    await expect(saveApplicationToDb(input, db)).resolves.toEqual({
      success: true,
      orderId: firstId,
      disposition: "created",
    });
    await db.productCatalog.update({
      where: { slug: priceTestSlug },
      data: { retailPrice: 140, distributorPrice: 90 },
    });
    const secondId = `test-prices-second-${process.pid}-${Date.now()}`;
    await expect(saveApplicationToDb({ ...input, requestId: secondId }, db)).resolves.toEqual({
      success: true,
      orderId: secondId,
      disposition: "created",
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

  test("persists idempotency across concurrent requests, replays success and retries only definite failure", async () => {
    const suffix = `${process.pid}-${Date.now()}`;
    const firstId = `test-idempotency-a-${suffix}`;
    const secondId = `test-idempotency-b-${suffix}`;
    const context = {
      keyHash: `test-key-hash-${suffix}`,
      payloadHash: `test-payload-hash-${suffix}`,
      now: new Date(),
      expiresAt: new Date(Date.now() + 60_000),
    };
    const base = {
      firstName: "Test",
      lastName: "Idempotency",
      phone: testPhone,
      phoneNormalized: testPhoneNormalized,
      region: "Кишинёв",
      type: "order" as const,
      products: [{ slug: "solaris-body-lotion", quantity: 1 }],
    };

    const concurrent = await Promise.all([
      saveApplicationToDb({ ...base, requestId: firstId }, db, context),
      saveApplicationToDb({ ...base, requestId: secondId }, db, context),
    ]);
    const created = concurrent.find((result) => result.success && result.disposition === "created");
    const waiting = concurrent.find((result) => result.success && result.disposition === "in_progress");
    expect(created?.success).toBe(true);
    expect(waiting?.success).toBe(true);
    if (!created?.success) throw new Error("Expected one created idempotent request");
    idempotencyOrderIds.push(created.orderId);
    expect(await db.order.count({ where: { id: { in: [firstId, secondId] } } })).toBe(1);

    await expect(completeApplicationDelivery(created.orderId, `tg-${suffix}`, db)).resolves.toBe(true);
    await expect(
      saveApplicationToDb({ ...base, requestId: `test-idempotency-replay-${suffix}` }, db, context),
    ).resolves.toEqual({
      success: true,
      orderId: created.orderId,
      disposition: "replay",
    });
    await expect(
      saveApplicationToDb({ ...base, requestId: `test-idempotency-conflict-${suffix}` }, db, {
        ...context,
        payloadHash: `${context.payloadHash}-different`,
      }),
    ).resolves.toMatchObject({ success: false, disposition: "conflict" });

    const retryId = `test-idempotency-retry-${suffix}`;
    const retryContext = { ...context, keyHash: `${context.keyHash}-retry` };
    const initialRetry = await saveApplicationToDb({ ...base, requestId: retryId }, db, retryContext);
    expect(initialRetry).toMatchObject({ success: true, orderId: retryId, disposition: "created" });
    idempotencyOrderIds.push(retryId);
    await expect(markApplicationDeliveryFailed(retryId, "NETWORK_ERROR", db)).resolves.toBe(true);
    await expect(
      saveApplicationToDb({ ...base, requestId: `test-idempotency-unused-${suffix}` }, db, retryContext),
    ).resolves.toEqual({ success: true, orderId: retryId, disposition: "retry" });

    const expiredFirstId = `test-idempotency-expired-a-${suffix}`;
    const expiredSecondId = `test-idempotency-expired-b-${suffix}`;
    const expiredContext = {
      ...context,
      keyHash: `${context.keyHash}-expired`,
      now: new Date("2030-01-01T00:00:00.000Z"),
      expiresAt: new Date("2030-01-01T00:00:01.000Z"),
    };
    await expect(
      saveApplicationToDb({ ...base, requestId: expiredFirstId }, db, expiredContext),
    ).resolves.toMatchObject({
      success: true,
      disposition: "created",
    });
    const reused = await saveApplicationToDb({ ...base, requestId: expiredSecondId }, db, {
      ...expiredContext,
      now: new Date("2030-01-01T00:00:02.000Z"),
      expiresAt: new Date("2030-01-02T00:00:02.000Z"),
    });
    expect(reused).toMatchObject({ success: true, orderId: expiredSecondId, disposition: "created" });
    idempotencyOrderIds.push(expiredFirstId, expiredSecondId);
  }, 60_000);

  test("shares a rate-limit counter across independent serverless instances", async () => {
    const clientKey = Buffer.from(`rate-limit-${process.pid}-${Date.now()}`)
      .toString("base64url")
      .padEnd(43, "a")
      .slice(0, 43);
    rateLimitClientKeys.push(clientKey);
    const increment = createPrismaRateLimitIncrement(db);
    const firstInstance = createApplicationRateLimitGuard({ limit: 2, now: () => 1_800_000_000_000, increment });
    const secondInstance = createApplicationRateLimitGuard({ limit: 2, now: () => 1_800_000_000_000, increment });
    const signedRequest = new Request("https://crm.example/api/applications", {
      headers: { "x-dr-nona-client-key": clientKey },
    });

    await expect(firstInstance(signedRequest)).resolves.toMatchObject({ allowed: true });
    await expect(secondInstance(signedRequest)).resolves.toMatchObject({ allowed: true });
    await expect(firstInstance(signedRequest)).resolves.toMatchObject({ allowed: false, reason: "limit" });
    await expect(db.applicationRateLimitBucket.count({ where: { clientKey } })).resolves.toBe(1);
  }, 20_000);
});
