import { prisma } from "../../src/lib/prisma";
import { listPublicConsultationSlots } from "../consultations/consultation-slots";
import { verifyApplicationProxyRequest } from "../http/application-proxy-signature";
import { applicationRateLimitGuard, type RateLimitDecision } from "../http/application-rate-limit";
import { jsonResponse } from "../http/json-response";
import { requestOriginIsAllowed } from "../http/request-validation";

type Dependencies = {
  secret?: () => string | undefined;
  allowedOrigins?: () => string[];
  verifyProxy?: typeof verifyApplicationProxyRequest;
  rateLimitGuard?: (request: Request) => Promise<boolean | RateLimitDecision>;
  listSlots?: typeof listPublicConsultationSlots;
};

export function createConsultationSlotsHandler(dependencies: Dependencies = {}) {
  return async function consultationSlotsHandler(request: Request) {
    if (request.method !== "GET") return jsonResponse({ ok: false, code: "METHOD_NOT_ALLOWED" }, 405, { Allow: "GET" });
    const secret = dependencies.secret?.() ?? process.env.CONTACT_PROXY_SHARED_SECRET;
    const allowedOrigins =
      dependencies.allowedOrigins?.() ??
      (process.env.CONTACT_ALLOWED_ORIGINS ?? "")
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean);
    if (!secret || !allowedOrigins.length) return jsonResponse({ ok: false, code: "SERVICE_UNAVAILABLE" }, 503);
    if (!requestOriginIsAllowed(request, new Set(allowedOrigins)))
      return jsonResponse({ ok: false, code: "FORBIDDEN" }, 403);
    const verified = await (dependencies.verifyProxy ?? verifyApplicationProxyRequest)(request, secret);
    if (!verified.valid) return jsonResponse({ ok: false, code: "FORBIDDEN" }, 403);
    const rateLimit = await (dependencies.rateLimitGuard ?? applicationRateLimitGuard)(request);
    const allowed = typeof rateLimit === "boolean" ? rateLimit : rateLimit.allowed;
    if (!allowed) {
      const retryAfter = typeof rateLimit === "boolean" ? 60 : rateLimit.retryAfterSeconds;
      return jsonResponse({ ok: false, code: "RATE_LIMITED" }, 429, { "Retry-After": String(retryAfter) });
    }
    const slots = await (dependencies.listSlots ?? listPublicConsultationSlots)(prisma);
    return jsonResponse(
      {
        ok: true,
        timezone: "Europe/Chisinau",
        slots: slots.map((slot) => ({
          id: slot.id,
          startsAt: slot.startsAt.toISOString(),
          endsAt: slot.endsAt.toISOString(),
          mode: slot.mode,
        })),
      },
      200,
      { "Cache-Control": "private, max-age=30" },
    );
  };
}
