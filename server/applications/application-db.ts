import { PrismaClient } from "@prisma/client";

let prisma: PrismaClient | undefined;

export function getDbClient(): PrismaClient {
  if (!prisma) {
    prisma = new PrismaClient();
  }
  return prisma;
}

export type DbWriteInput = {
  requestId: string;
  firstName: string;
  lastName: string;
  phone: string;
  phoneNormalized: string;
  email?: string;
  region: string;
  type: "order" | "consultation" | "masterclass";
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
  products?: Array<{
    slug: string;
    quantity: number;
  }>;
};

export type DbWriteResult = { success: true; orderId: string } | { success: false; error: string };

export type OrderStatus = "NEW" | "PROCESSING" | "DELIVERY" | "DONE" | "CANCELLED";

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
): Promise<DbWriteResult> {
  try {
    const order = await db.$transaction(async (transaction) => {
      const client = await transaction.client.upsert({
        where: { phoneNormalized: input.phoneNormalized },
        update: {
          firstName: input.firstName,
          lastName: input.lastName,
          email: input.email ?? null,
          region: input.region,
        },
        create: {
          firstName: input.firstName,
          lastName: input.lastName,
          phone: input.phone,
          phoneNormalized: input.phoneNormalized,
          email: input.email ?? null,
          region: input.region,
        },
      });

      return transaction.order.create({
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
          utmSource: input.utmSource ?? null,
          utmMedium: input.utmMedium ?? null,
          utmCampaign: input.utmCampaign ?? null,
          utmContent: input.utmContent ?? null,
          entryPoint: input.entryPoint ?? null,
          sessionHistory: input.sessionHistory ?? null,
          ...(input.products?.length
            ? {
                items: {
                  create: input.products.map((product) => ({
                    productSlug: product.slug,
                    quantity: product.quantity,
                    priceAtPurchase: 0,
                  })),
                },
              }
            : {}),
        },
      });
    });

    return { success: true, orderId: order.id };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { success: false, error: message };
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
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export async function updateOrderStatusByTelegramMessageId(
  telegramMessageId: string,
  status: OrderStatus,
  db: PrismaClient = getDbClient(),
): Promise<boolean> {
  try {
    const order = await db.order.findUnique({
      where: { telegramMessageId },
    });
    if (!order) return false;

    await db.order.update({
      where: { id: order.id },
      data: { status },
    });
    return true;
  } catch (error) {
    console.error("Failed to update order status in DB:", error);
    return false;
  }
}
