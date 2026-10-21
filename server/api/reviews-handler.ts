import { z } from "zod";

import productRecords from "../../src/data/products.json";
import { prisma } from "../../src/lib/prisma";
import { verifyApplicationProxyRequest } from "../http/application-proxy-signature";
import { applicationRateLimitGuard } from "../http/application-rate-limit";
import { jsonResponse } from "../http/json-response";
import { readJsonBody } from "../http/request-validation";
import { reviewInputSchema } from "../reviews/review-schema";
import { listPublicReviews, submitReview } from "../reviews/review-service";

const productSlugs = new Set(
  productRecords
    .filter((product) => product.publicationStatus === "published" && product.editorialStatus === "ready")
    .map((product) => product.slug),
);
const querySchema = z.object({
  page: z.coerce.number().int().min(1).max(10000).default(1),
  product: z.string().max(160).optional(),
});
type Dependencies = {
  secret?: () => string | undefined;
  allowedOrigins?: () => string[];
  verifyProxy?: typeof verifyApplicationProxyRequest;
  rateLimit?: typeof applicationRateLimitGuard;
  submit?: typeof submitReview;
  list?: typeof listPublicReviews;
};

export function createReviewsHandler(dependencies: Dependencies = {}) {
  return async (request: Request) => {
    if (!["GET", "POST"].includes(request.method))
      return jsonResponse({ ok: false, code: "METHOD_NOT_ALLOWED" }, 405, { Allow: "GET, POST" });
    const url = new URL(request.url);
    const secret = dependencies.secret?.() ?? process.env.CONTACT_PROXY_SHARED_SECRET;
    const allowed =
      dependencies.allowedOrigins?.() ??
      (process.env.CONTACT_ALLOWED_ORIGINS ?? "")
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
    if (!secret || !allowed.length) return jsonResponse({ ok: false, code: "SERVICE_UNAVAILABLE" }, 503);
    if (!allowed.includes(request.headers.get("origin") ?? ""))
      return jsonResponse({ ok: false, code: "FORBIDDEN" }, 403);
    // Domain separation prevents a signed application payload from being replayed as a review.
    const verified = await (dependencies.verifyProxy ?? verifyApplicationProxyRequest)(
      request,
      `${secret}:reviews:${request.method}:${url.search}`,
    );
    if (!verified.valid) return jsonResponse({ ok: false, code: "FORBIDDEN" }, 403);
    try {
      if (request.method === "GET") {
        const query = querySchema.safeParse(Object.fromEntries(url.searchParams));
        if (!query.success || (query.data.product && !productSlugs.has(query.data.product)))
          return jsonResponse({ ok: false, code: "VALIDATION_ERROR" }, 400);
        const result = await (dependencies.list ?? listPublicReviews)(prisma, query.data.page, query.data.product);
        return jsonResponse({ ok: true, ...result }, 200, { "Cache-Control": "no-store" });
      }
      const rate = await (dependencies.rateLimit ?? applicationRateLimitGuard)(request);
      if (!rate.allowed)
        return jsonResponse(
          { ok: false, code: rate.reason === "limit" ? "RATE_LIMITED" : "SERVICE_UNAVAILABLE" },
          rate.reason === "limit" ? 429 : 503,
          { "Retry-After": String(rate.retryAfterSeconds) },
        );
      const body = await readJsonBody(request);
      if (!body.success) return jsonResponse({ ok: false, code: body.code }, body.status);
      const parsed = reviewInputSchema.safeParse(body.value);
      const key = request.headers.get("idempotency-key") ?? "";
      if (
        !parsed.success ||
        !/^[a-zA-Z0-9:_-]{16,128}$/u.test(key) ||
        (parsed.data.productSlug && !productSlugs.has(parsed.data.productSlug))
      )
        return jsonResponse({ ok: false, code: "VALIDATION_ERROR" }, 400);
      const result = await (dependencies.submit ?? submitReview)(prisma, parsed.data, key);
      return result === "accepted"
        ? jsonResponse({ ok: true, status: "PENDING" }, 202)
        : jsonResponse({ ok: false, code: "IDEMPOTENCY_CONFLICT" }, 409);
    } catch (error) {
      console.error("reviews.request.failed", error instanceof Error ? error.name : "UnknownError");
      return jsonResponse({ ok: false, code: "SERVICE_UNAVAILABLE" }, 503);
    }
  };
}
