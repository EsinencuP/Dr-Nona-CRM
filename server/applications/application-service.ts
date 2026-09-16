import type { ApplicationInput } from "../../shared/applications/application-schema";
import { normalizePhone } from "../../shared/applications/application-schema";
import { type DbWriteInput, saveApplicationToDb } from "./application-db";
import { createApplicationIdempotency } from "./application-idempotency";
import type {
  ApplicationExtraFields,
  ApplicationProduct,
  ApplicationRecord,
  ApplicationServiceResult,
  ProviderResult,
} from "./application-types";
import { formatTelegramApplication } from "./format-application";
import { deliverTelegramOutbox, type OutboxDeliveryResult, type TelegramPayloadSender } from "./telegram-outbox";
import { randomUUID } from "node:crypto";

export type ApplicationServiceDependencies = {
  productsBySlug: ReadonlyMap<string, ApplicationProduct>;
  sendTelegram: (record: ApplicationRecord, message: string) => Promise<ProviderResult>;
  createRequestId?: () => string;
  now?: () => Date;
  logger?: (metadata: Record<string, unknown>) => void;
  extraFields?: ApplicationExtraFields;
  saveApplication?: typeof saveApplicationToDb;
  deliverOutbox?: (orderId: string, send: TelegramPayloadSender) => Promise<OutboxDeliveryResult>;
};

export async function processApplication(
  input: ApplicationInput,
  dependencies: ApplicationServiceDependencies,
  context?: { idempotencyKey: string },
): Promise<ApplicationServiceResult> {
  const startedAt = Date.now();
  const requestId = (dependencies.createRequestId ?? randomUUID)();
  const submittedAt = (dependencies.now ?? (() => new Date()))().toISOString();
  const phone = normalizePhone(input.phone);
  const base = {
    schemaVersion: 1 as const,
    requestId,
    firstName: input.firstName,
    lastName: input.lastName,
    ...phone,
    city: input.city,
    source: "website" as const,
    locale: input.locale,
    submittedAt,
  };
  const quantitiesBySlug =
    input.type === "order" ? new Map(input.items?.map((item) => [item.slug, item.quantity])) : undefined;
  if (input.type === "order" && input.items === undefined) {
    dependencies.logger?.({
      event: "application.contract.legacy_order_items",
      requestId,
      fallbackQuantity: 1,
    });
  }
  let record: ApplicationRecord;
  if (input.type === "order") {
    record = {
      ...base,
      type: "order",
      products: input.productSlugs.map((slug) => {
        const product = dependencies.productsBySlug.get(slug);
        if (!product) throw new Error("Validated product is unavailable");
        return {
          ...product,
          quantity: quantitiesBySlug?.get(slug) ?? 1,
        };
      }),
    };
  } else if (input.type === "consultation") {
    record = {
      ...base,
      type: "consultation",
      consultationMode: input.consultationMode,
      consultationDate: input.consultationDate,
      consultationTime: input.consultationTime,
      timezone: "Europe/Chisinau",
    };
  } else {
    record = {
      ...base,
      type: "masterclass",
      masterclassTopic: input.masterclassTopic,
      eventDate: input.eventDate,
      eventTime: input.eventTime,
      timezone: "Europe/Chisinau",
    };
  }
  let eventDate: string | undefined;
  let eventTime: string | undefined;
  if (input.type === "consultation") {
    eventDate = input.consultationDate;
    eventTime = input.consultationTime;
  } else if (input.type === "masterclass") {
    eventDate = input.eventDate;
    eventTime = input.eventTime;
  }
  const message = formatTelegramApplication(record);
  const dbInput: DbWriteInput = {
    requestId,
    firstName: input.firstName,
    lastName: input.lastName,
    phone: phone.phone,
    phoneNormalized: phone.phoneNormalized,
    email: input.email?.trim() || dependencies.extraFields?.email,
    region: input.city,
    type: input.type,
    comment: input.comment?.trim() || dependencies.extraFields?.comment,
    preferredCallTime: input.preferredCallTime?.trim() || dependencies.extraFields?.preferredCallTime,
    utmSource: input.attribution?.lastTouch.source ?? input.utmSource ?? dependencies.extraFields?.utmSource,
    utmMedium: input.attribution?.lastTouch.medium ?? input.utmMedium ?? dependencies.extraFields?.utmMedium,
    utmCampaign: input.attribution?.lastTouch.campaign ?? input.utmCampaign ?? dependencies.extraFields?.utmCampaign,
    utmContent: input.attribution?.lastTouch.content ?? input.utmContent ?? dependencies.extraFields?.utmContent,
    entryPoint: input.attribution?.entry.path ?? input.entryPoint ?? dependencies.extraFields?.entryPoint,
    sessionHistory: input.attribution
      ? JSON.stringify(input.attribution.sessionHistory)
      : (input.sessionHistory ?? dependencies.extraFields?.sessionHistory),
    attribution: input.attribution,
    telegramPayload: message,
    eventDate,
    eventTime,
    masterclassTopic: input.type === "masterclass" ? input.masterclassTopic : undefined,
    consultationMode: input.type === "consultation" ? input.consultationMode : undefined,
    products:
      record.type === "order"
        ? record.products.map((product) => ({
            slug: product.slug,
            quantity: product.quantity ?? 1,
          }))
        : undefined,
  };
  const idempotency = context
    ? createApplicationIdempotency(input, context.idempotencyKey, new Date(submittedAt))
    : undefined;
  const dbResult = await (dependencies.saveApplication ?? saveApplicationToDb)(dbInput, undefined, idempotency).catch(
    (error: unknown) => ({
      success: false as const,
      disposition: "failure" as const,
      error: String(error),
    }),
  );
  dependencies.logger?.({
    event: "application.db.write",
    requestId,
    outcome: dbResult.success ? "success" : "failure",
    ...(!dbResult.success && { failureClass: "database_write" }),
  });
  if (!dbResult.success) {
    dependencies.logger?.({
      event: "application.delivery.completed",
      requestId,
      type: record.type,
      telegramStatus: "skipped",
      failureClass: "database_write",
      durationMs: Date.now() - startedAt,
    });
    if (dbResult.disposition === "conflict") {
      return {
        requestId,
        type: record.type,
        delivery: { telegram: "pending" },
        outcome: "conflict",
      };
    }
    return {
      requestId,
      type: record.type,
      delivery: { telegram: "failed" },
      outcome: "failure",
    };
  }
  if (dbResult.disposition === "replay") {
    return {
      requestId: dbResult.orderId,
      type: record.type,
      delivery: { telegram: "sent" },
      outcome: "success",
      replayed: true,
    };
  }
  if (dbResult.disposition === "in_progress") {
    return {
      requestId: dbResult.orderId,
      type: record.type,
      delivery: { telegram: "pending" },
      outcome: "in_progress",
    };
  }
  const activeRequestId = dbResult.orderId;
  record = { ...record, requestId: activeRequestId };
  const outboxResult = await (dependencies.deliverOutbox ?? deliverTelegramOutbox)(activeRequestId, (payload) =>
    dependencies.sendTelegram(record, payload),
  );
  const delivery = { telegram: outboxResult.delivery };
  dependencies.logger?.({
    event: "application.delivery.completed",
    requestId: activeRequestId,
    type: record.type,
    telegramStatus: delivery.telegram,
    ...(delivery.telegram !== "sent" && {
      failureClass: "telegram_delivery",
      outboxState: outboxResult.state,
      attempts: outboxResult.attempts,
    }),
    durationMs: Date.now() - startedAt,
  });
  return { requestId: activeRequestId, type: record.type, delivery, outcome: "success" };
}
