import type { OrderStatus, OrderType, PrismaClient } from "@prisma/client";
import { ApplicationSubmissionState, Prisma } from "@prisma/client";

import { getPrismaClient } from "../../src/lib/prisma";

function databaseFailureMetadata(error: unknown) {
  return {
    errorName: error instanceof Error ? error.name : "UnknownError",
    ...(error instanceof Prisma.PrismaClientKnownRequestError ? { errorCode: error.code } : {}),
  };
}

export function getDbClient(): PrismaClient {
  return getPrismaClient();
}

export type DbWriteInput = {
  requestId: string;
  firstName: string;
  lastName: string;
  phone: string;
  phoneNormalized: string;
  email?: string;
  region: string;
  type: OrderType;
  comment?: string;
  preferredCallTime?: string;
  eventDate?: string;
  eventTime?: string;
  masterclassTopic?: string;
  consultationMode?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmContent?: string;
  entryPoint?: string;
  sessionHistory?: string;
  attribution?: Prisma.InputJsonValue;
  telegramPayload: string;
  products?: Array<{
    slug: string;
    quantity: number;
  }>;
};

export type IdempotencyWriteContext = {
  keyHash: string;
  payloadHash: string;
  expiresAt: Date;
  now: Date;
};

export type DbWriteResult =
  | { success: true; orderId: string; disposition: "created" | "retry" | "replay" | "in_progress" }
  | { success: false; disposition: "conflict" | "failure"; error: string };

export type { OrderStatus };

export async function deleteOrderFromDb(orderId: string, db: PrismaClient = getDbClient()): Promise<boolean> {
  const existing = await db.order.findUnique({
    where: { id: orderId },
    select: { clientId: true },
  });
  if (!existing) return false;

  await db.$transaction(async (transaction) => {
    await transaction.orderItem.deleteMany({ where: { orderId } });
    await transaction.order.delete({ where: { id: orderId } });

    const remainingOrders = await transaction.order.count({ where: { clientId: existing.clientId } });
    if (remainingOrders === 0) {
      await transaction.client.delete({ where: { id: existing.clientId } });
    }
  });

  return true;
}

export async function saveApplicationToDb(
  input: DbWriteInput,
  db: PrismaClient = getDbClient(),
  idempotency?: IdempotencyWriteContext,
  allowExpiredRetry = true,
): Promise<DbWriteResult> {
  try {
    const order = await db.$transaction(async (transaction) => {
      const catalogPrices = input.products?.length
        ? await transaction.productCatalog.findMany({
            where: { slug: { in: input.products.map((product) => product.slug) } },
            select: { slug: true, retailPrice: true, distributorPrice: true },
          })
        : [];
      const priceMap = new Map(catalogPrices.map((product) => [product.slug, product]));
      const client = await transaction.client.upsert({
        where: { phoneNormalized: input.phoneNormalized },
        update: {},
        create: {
          firstName: input.firstName,
          lastName: input.lastName,
          phone: input.phone,
          phoneNormalized: input.phoneNormalized,
          email: input.email ?? null,
          region: input.region,
        },
      });

      const createdOrder = await transaction.order.create({
        data: {
          id: input.requestId,
          clientId: client.id,
          type: input.type,
          status: "NEW",
          comment: input.comment ?? null,
          preferredCallTime: input.preferredCallTime ?? null,
          eventDate: input.eventDate ?? null,
          eventTime: input.eventTime ?? null,
          masterclassTopic: input.masterclassTopic ?? null,
          consultationMode: input.consultationMode ?? null,
          submittedFirstName: input.firstName,
          submittedLastName: input.lastName,
          submittedPhone: input.phone,
          submittedEmail: input.email ?? null,
          submittedRegion: input.region,
          utmSource: input.utmSource ?? null,
          utmMedium: input.utmMedium ?? null,
          utmCampaign: input.utmCampaign ?? null,
          utmContent: input.utmContent ?? null,
          entryPoint: input.entryPoint ?? null,
          sessionHistory: input.sessionHistory ?? null,
          attribution: input.attribution ?? Prisma.JsonNull,
          ...(input.products?.length
            ? {
                items: {
                  create: input.products.map((product) => ({
                    productSlug: product.slug,
                    quantity: product.quantity,
                    priceAtPurchase: priceMap.get(product.slug)?.retailPrice ?? 0,
                    retailPriceAtPurchase: priceMap.get(product.slug)?.retailPrice ?? 0,
                    distributorPriceAtPurchase: priceMap.get(product.slug)?.distributorPrice ?? 0,
                  })),
                },
              }
            : {}),
        },
      });
      if (idempotency) {
        await transaction.applicationSubmission.create({
          data: {
            keyHash: idempotency.keyHash,
            payloadHash: idempotency.payloadHash,
            requestId: createdOrder.id,
            expiresAt: idempotency.expiresAt,
          },
        });
      }
      await transaction.telegramOutbox.create({
        data: {
          orderId: createdOrder.id,
          payload: input.telegramPayload,
        },
      });
      return createdOrder;
    });

    return { success: true, orderId: order.id, disposition: "created" };
  } catch (error) {
    if (idempotency && error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const existing = await db.applicationSubmission.findUnique({ where: { keyHash: idempotency.keyHash } });
      if (existing) {
        if (existing.expiresAt <= idempotency.now && allowExpiredRetry) {
          await db.applicationSubmission.deleteMany({
            where: { keyHash: idempotency.keyHash, expiresAt: { lte: idempotency.now } },
          });
          return saveApplicationToDb(input, db, idempotency, false);
        }
        if (existing.payloadHash !== idempotency.payloadHash) {
          return { success: false, disposition: "conflict", error: "IDEMPOTENCY_CONFLICT" };
        }
        if (existing.state === ApplicationSubmissionState.DELIVERED) {
          return { success: true, orderId: existing.requestId, disposition: "replay" };
        }
        if (existing.state === ApplicationSubmissionState.DELIVERY_STARTED) {
          return { success: true, orderId: existing.requestId, disposition: "in_progress" };
        }
        const [acquired] = await db.$transaction([
          db.applicationSubmission.updateMany({
            where: {
              keyHash: idempotency.keyHash,
              payloadHash: idempotency.payloadHash,
              state: ApplicationSubmissionState.DELIVERY_FAILED,
            },
            data: {
              state: ApplicationSubmissionState.DELIVERY_STARTED,
              lastErrorCode: null,
              expiresAt: idempotency.expiresAt,
            },
          }),
          db.telegramOutbox.updateMany({
            where: { orderId: existing.requestId, state: { in: ["TERMINAL", "NEEDS_REVIEW", "CANCELLED"] } },
            data: { state: "PENDING", attempts: 0, nextAttemptAt: idempotency.now, lastErrorCode: null },
          }),
        ]);
        return acquired.count === 1
          ? { success: true, orderId: existing.requestId, disposition: "retry" }
          : { success: true, orderId: existing.requestId, disposition: "in_progress" };
      }
    }
    const message = error instanceof Error ? error.message : String(error);
    return { success: false, disposition: "failure", error: message };
  }
}

export async function completeApplicationDelivery(
  orderId: string,
  telegramMessageId: string,
  db: PrismaClient = getDbClient(),
): Promise<boolean> {
  try {
    await db.$transaction([
      db.order.update({ where: { id: orderId }, data: { telegramMessageId } }),
      db.applicationSubmission.updateMany({
        where: { requestId: orderId, state: ApplicationSubmissionState.DELIVERY_STARTED },
        data: {
          state: ApplicationSubmissionState.DELIVERED,
          providerMessageId: telegramMessageId,
          lastErrorCode: null,
        },
      }),
      db.telegramOutbox.updateMany({
        where: { orderId },
        data: {
          state: "DELIVERED",
          providerMessageId: telegramMessageId,
          lastErrorCode: null,
          lockedAt: null,
        },
      }),
    ]);
    return true;
  } catch (error) {
    console.error("[applications.db] Delivery completion update failed", {
      orderId,
      ...databaseFailureMetadata(error),
    });
    return false;
  }
}

export async function markApplicationDeliveryFailed(
  orderId: string,
  errorCode: string,
  db: PrismaClient = getDbClient(),
): Promise<boolean> {
  try {
    const [result] = await db.$transaction([
      db.applicationSubmission.updateMany({
        where: { requestId: orderId, state: ApplicationSubmissionState.DELIVERY_STARTED },
        data: { state: ApplicationSubmissionState.DELIVERY_FAILED, lastErrorCode: errorCode.slice(0, 100) },
      }),
      db.telegramOutbox.updateMany({
        where: { orderId },
        data: { state: "TERMINAL", lastErrorCode: errorCode.slice(0, 100), lockedAt: null },
      }),
    ]);
    return result.count === 1;
  } catch (error) {
    console.error("[applications.db] Delivery failure state update failed", {
      orderId,
      ...databaseFailureMetadata(error),
    });
    return false;
  }
}

export async function saveMessageIdToDb(
  orderId: string,
  telegramMessageId: string,
  db: PrismaClient = getDbClient(),
): Promise<void> {
  try {
    await db.order.update({
      where: { id: orderId },
      data: { telegramMessageId },
    });
  } catch (error) {
    console.error("[applications.db] Telegram message ID update failed", {
      orderId,
      ...databaseFailureMetadata(error),
    });
  }
}

export async function updateOrderStatusByTelegramMessageId(
  telegramMessageId: string,
  status: OrderStatus,
  db: PrismaClient = getDbClient(),
): Promise<boolean> {
  const { transitionOrderStatus, transitionSucceeded } = await import("../orders/order-status-service");
  const result = await transitionOrderStatus(
    {
      telegramMessageId,
      nextStatus: status,
      source: "telegram_reply",
      actorKey: "telegram:legacy",
    },
    db,
  );
  return transitionSucceeded(result);
}
