import { validateApplicationInput } from "../../shared/applications/application-schema";
import { processApplication } from "../applications/application-service";
import type { ApplicationProduct } from "../applications/application-types";
import { sendTelegramApplication } from "../applications/providers/telegram-provider";
import { processDueTelegramOutbox } from "../applications/telegram-outbox";
import { type ContactEnvironment, readContactEnvironment } from "../config/contact-env";
import { type ProxyVerification, verifyApplicationProxyRequest } from "../http/application-proxy-signature";
import { applicationRateLimitGuard, type RateLimitDecision } from "../http/application-rate-limit";
import { jsonResponse } from "../http/json-response";
import { readJsonBody, requestOriginIsAllowed } from "../http/request-validation";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
type ProductRecord = ApplicationProduct & {
  publicationStatus: string;
  editorialStatus: string;
};
const productsJson = require("../../src/data/products.json") as ProductRecord[];

const availableProducts = productsJson.filter(
  (product) => product.publicationStatus === "published" && product.editorialStatus === "ready",
);
const productsBySlug = new Map<string, ApplicationProduct>(
  availableProducts.map((product) => [
    product.slug,
    {
      slug: product.slug,
      officialName: product.officialName,
      sku: product.sku,
    },
  ]),
);

export type ApplicationsHandlerDependencies = {
  environment?: () => { success: true; value: ContactEnvironment } | { success: false; missing: string[] };
  process?: typeof processApplication;
  rateLimitGuard?: (request: Request) => Promise<boolean | RateLimitDecision>;
  verifyProxy?: (request: Request, secret: string) => Promise<ProxyVerification>;
  logger?: (metadata: Record<string, unknown>) => void;
};

export function createApplicationsHandler(dependencies: ApplicationsHandlerDependencies = {}) {
  return async function applicationsHandler(request: Request) {
    if (request.method !== "POST") {
      return jsonResponse({ ok: false, code: "METHOD_NOT_ALLOWED" }, 405, { Allow: "POST" });
    }
    const environmentResult = (dependencies.environment ?? readContactEnvironment)();
    if (!environmentResult.success) {
      return jsonResponse({ ok: false, code: "SERVICE_UNAVAILABLE" }, 503);
    }
    const environment = environmentResult.value;
    if (!requestOriginIsAllowed(request, environment.allowedOrigins)) {
      return jsonResponse({ ok: false, code: "FORBIDDEN" }, 403);
    }
    const proxyVerification = await (dependencies.verifyProxy ?? verifyApplicationProxyRequest)(
      request,
      environment.proxySharedSecret,
    );
    if (!proxyVerification.valid) {
      (dependencies.logger ?? console.info)({
        event: "application.proxy.rejected",
        reason: proxyVerification.reason,
      });
      return jsonResponse({ ok: false, code: "FORBIDDEN" }, 403);
    }
    const rateLimitResult = await (dependencies.rateLimitGuard ?? applicationRateLimitGuard)(request);
    const rateLimitAllowed = typeof rateLimitResult === "boolean" ? rateLimitResult : rateLimitResult.allowed;
    if (!rateLimitAllowed) {
      const retryAfterSeconds = typeof rateLimitResult === "boolean" ? 60 : rateLimitResult.retryAfterSeconds;
      if (typeof rateLimitResult !== "boolean" && rateLimitResult.reason !== "limit") {
        return jsonResponse({ ok: false, code: "SERVICE_UNAVAILABLE" }, 503, {
          "Retry-After": String(retryAfterSeconds),
        });
      }
      return jsonResponse({ ok: false, code: "RATE_LIMITED" }, 429, { "Retry-After": String(retryAfterSeconds) });
    }
    const body = await readJsonBody(request);
    if (!body.success) {
      return jsonResponse({ ok: false, code: body.code }, body.status);
    }
    const validation = validateApplicationInput(body.value, {
      allowedProductSlugs: new Set(productsBySlug.keys()),
    });
    if (!validation.success) {
      return jsonResponse(
        {
          ok: false,
          code: "VALIDATION_ERROR",
          fieldErrors: validation.fieldErrors,
        },
        400,
      );
    }
    const idempotencyKey = request.headers.get("idempotency-key")?.trim();
    if (!idempotencyKey || idempotencyKey.length > 128 || !/^[a-zA-Z0-9:_-]+$/u.test(idempotencyKey)) {
      return jsonResponse(
        {
          ok: false,
          code: "VALIDATION_ERROR",
          fieldErrors: {
            idempotencyKey: "Некорректный ключ повторной отправки",
          },
        },
        400,
      );
    }
    const serviceResult = await (dependencies.process ?? processApplication)(
      validation.data,
      {
        productsBySlug,
        sendTelegram: (_record, message) =>
          sendTelegramApplication(message, {
            botToken: environment.telegramBotToken,
            chatId: environment.telegramChatId,
          }),
        logger: dependencies.logger ?? ((metadata) => console.info(metadata)),
      },
      { idempotencyKey },
    );
    if (!dependencies.process && serviceResult.outcome !== "failure" && serviceResult.outcome !== "conflict") {
      await processDueTelegramOutbox(
        (message) =>
          sendTelegramApplication(message, {
            botToken: environment.telegramBotToken,
            chatId: environment.telegramChatId,
          }),
        { limit: 1 },
      ).catch(() => undefined);
    }
    const responseBody = {
      ok: serviceResult.outcome !== "failure",
      requestId: serviceResult.requestId,
      ...(serviceResult.outcome === "failure" ? { code: "DELIVERY_FAILED" } : {}),
      delivery: serviceResult.delivery,
    };
    if (serviceResult.outcome === "success")
      return jsonResponse({ ...responseBody, replayed: serviceResult.replayed ?? false }, 201);
    if (serviceResult.outcome === "conflict") {
      return jsonResponse({ ok: false, code: "IDEMPOTENCY_CONFLICT" }, 409);
    }
    if (serviceResult.outcome === "in_progress") {
      return jsonResponse(
        { ok: true, code: "REQUEST_ACCEPTED", requestId: serviceResult.requestId, delivery: serviceResult.delivery },
        202,
        {
          "Retry-After": "30",
        },
      );
    }
    return jsonResponse({ ok: false, code: "DELIVERY_FAILED", requestId: serviceResult.requestId }, 502);
  };
}

const handler = createApplicationsHandler();

export default {
  fetch: handler,
};
