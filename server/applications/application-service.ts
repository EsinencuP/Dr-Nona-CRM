import type { ApplicationInput } from "../../shared/applications/application-schema";
import { normalizePhone } from "../../shared/applications/application-schema";
import { type DbWriteInput, saveApplicationToDb, saveMessageIdToDb } from "./application-db";
import type {
  ApplicationExtraFields,
  ApplicationProduct,
  ApplicationRecord,
  ApplicationServiceResult,
  ProviderResult,
} from "./application-types";
import { formatTelegramApplication } from "./format-application";
import { randomUUID } from "node:crypto";

export type ApplicationServiceDependencies = {
  productsBySlug: ReadonlyMap<string, ApplicationProduct>;
  sendTelegram: (record: ApplicationRecord, message: string) => Promise<ProviderResult>;
  createRequestId?: () => string;
  now?: () => Date;
  logger?: (metadata: Record<string, unknown>) => void;
  extraFields?: ApplicationExtraFields;
  saveApplication?: typeof saveApplicationToDb;
  saveMessageId?: typeof saveMessageIdToDb;
};

export async function processApplication(
  input: ApplicationInput,
  dependencies: ApplicationServiceDependencies,
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
    utmSource: input.utmSource ?? dependencies.extraFields?.utmSource,
    utmMedium: input.utmMedium ?? dependencies.extraFields?.utmMedium,
    utmCampaign: input.utmCampaign ?? dependencies.extraFields?.utmCampaign,
    utmContent: input.utmContent ?? dependencies.extraFields?.utmContent,
    entryPoint: input.entryPoint ?? dependencies.extraFields?.entryPoint,
    sessionHistory: input.sessionHistory ?? dependencies.extraFields?.sessionHistory,
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
  const dbResult = await (dependencies.saveApplication ?? saveApplicationToDb)(dbInput).catch((error: unknown) => ({
    success: false as const,
    error: String(error),
  }));
  dependencies.logger?.({
    event: "application.db.write",
    requestId,
    dbSuccess: dbResult.success,
    ...(!dbResult.success && { dbError: dbResult.error }),
  });
  const message = formatTelegramApplication(record);
  const telegramResult = await dependencies.sendTelegram(record, message).catch(() => undefined);
  if (dbResult.success && telegramResult?.status === "sent" && telegramResult.providerMessageId) {
    await (dependencies.saveMessageId ?? saveMessageIdToDb)(requestId, telegramResult.providerMessageId);
  }
  const delivery = {
    telegram:
      telegramResult?.provider === "telegram" && telegramResult.status === "sent"
        ? ("sent" as const)
        : ("failed" as const),
  };
  const outcome = delivery.telegram === "sent" ? "success" : "failure";
  dependencies.logger?.({
    event: "application.delivery.completed",
    requestId,
    type: record.type,
    telegramStatus: delivery.telegram,
    durationMs: Date.now() - startedAt,
  });
  return { requestId, type: record.type, delivery, outcome };
}
