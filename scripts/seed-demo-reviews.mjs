import { PrismaClient } from "@prisma/client";

import products from "../src/data/products.json" with { type: "json" };
import { createHash } from "node:crypto";

const prefix = "demo-reviews-v1-";
const args = new Set(process.argv.slice(2));
const supported = new Set(["--dry-run", "--cleanup", "--json"]);
for (const argument of args) if (!supported.has(argument)) throw new Error(`Unknown argument: ${argument}`);
if (args.has("--dry-run") && args.has("--cleanup")) throw new Error("Choose --dry-run or --cleanup.");

const examples = [
  [
    "ru",
    "solaris-body-lotion",
    "Опубликованный пример о Solaris Body Lotion. Проверьте название товара, SKU и расположение текста.",
  ],
  ["ru", null, "Опубликованный общий пример. Он показывает, как выглядит отзыв без привязки к определённому товару."],
  [
    "ro",
    "lord-deodorant",
    "Exemplu publicat despre Deodorant LORD. Verificați numele produsului, SKU și afișarea diacriticelor.",
  ],
  ["ro", null, "Exemplu general publicat. Acest text demonstrează afișarea unei recenzii fără un produs selectat."],
  [
    "ru",
    "gonseen",
    "Пример о Gonseen Tea для проверки одобрения. Нажмите лайк в CRM: эта запись должна появиться на открытой публичной странице.",
  ],
  [
    "ru",
    "night-cream",
    "Пример о Night Cream для проверки отклонения. Нажмите дизлайк: запись должна остаться в истории CRM.",
  ],
  [
    "ru",
    null,
    "Общий пример на модерации. Одобрите его, проверьте появление на сайте, затем отклоните и проверьте исчезновение.",
  ],
  [
    "ro",
    "solaris-body-lotion",
    "Exemplu în așteptare despre Solaris Body Lotion. Aprobați recenzia în CRM și urmăriți apariția ei pe pagina publică deschisă.",
  ],
  [
    "ro",
    "lord-deodorant",
    "Exemplu în așteptare despre Deodorant LORD. Respingeți recenzia pentru a verifica păstrarea ei în istoricul CRM.",
  ],
  ["ro", null, "Exemplu general în așteptare. Testați aprobarea și respingerea fără a selecta un produs."],
];

const published = new Set(
  products
    .filter((product) => product.publicationStatus === "published" && product.editorialStatus === "ready")
    .map((product) => product.slug),
);
const fixtures = examples.map(([locale, productSlug, text], index) => {
  if (productSlug && !published.has(productSlug)) throw new Error(`Unavailable demo product: ${productSlug}`);
  const number = String(index + 1).padStart(2, "0");
  return {
    idempotencyKey: `${prefix}${number}`,
    authorName: `${locale === "ru" ? "ТЕСТ · Отзыв" : "TEST · Recenzie"} ${number}`,
    body: `${locale === "ru" ? "ТЕСТОВЫЕ ДАННЫЕ — не отзыв реального клиента." : "DATE DE TEST — nu este recenzia unui client real."}\n\n${text}`,
    productSlug,
    locale,
    status: index < 4 ? "APPROVED" : "PENDING",
  };
});

const plan = { mode: "dry-run", total: 10, approved: 4, pending: 6, fixtures };
if (args.has("--dry-run")) {
  console.log(JSON.stringify(plan, null, args.has("--json") ? undefined : 2));
} else {
  // This helper is deliberately limited to the isolated database used for local review QA.
  const url = new URL(process.env.DATABASE_URL || "postgresql://invalid/invalid");
  if (
    process.env.NODE_ENV === "production" ||
    !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) ||
    !["/drnona_reviews", "/drnona_reviews_utf8"].includes(url.pathname)
  ) {
    throw new Error(
      "Demo reviews require a loopback DATABASE_URL with database drnona_reviews or drnona_reviews_utf8 and a non-production environment.",
    );
  }
  const db = new PrismaClient();
  try {
    const [database] = await db.$queryRaw`SELECT current_setting('server_encoding') AS encoding`;
    if (database.encoding !== "UTF8") throw new Error("Demo reviews require a UTF8 database for RU/RO text.");
    const keys = fixtures.map((fixture) => fixture.idempotencyKey);
    if (args.has("--cleanup")) {
      const rows = await db.review.findMany({ where: { idempotencyKey: { in: keys } }, select: { id: true } });
      const ids = rows.map((row) => row.id);
      await db.$transaction([
        db.reviewModerationAudit.deleteMany({ where: { reviewId: { in: ids } } }),
        db.review.deleteMany({ where: { id: { in: ids } } }),
      ]);
      console.log(JSON.stringify({ mode: "cleanup", removed: rows.length }));
    } else {
      const now = new Date();
      await db.$transaction(async (tx) => {
        for (const [index, fixture] of fixtures.entries()) {
          const approved = fixture.status === "APPROVED";
          await tx.review.upsert({
            where: { idempotencyKey: fixture.idempotencyKey },
            update: {},
            create: {
              ...fixture,
              consentAcceptedAt: now,
              createdAt: new Date(now.getTime() - index * 60_000),
              payloadHash: createHash("sha256").update(JSON.stringify(fixture)).digest("hex"),
              version: approved ? 1 : 0,
              ...(approved
                ? {
                    moderatedAt: now,
                    moderatedBy: "demo-seed",
                    moderationAudits: { create: { fromStatus: "PENDING", toStatus: "APPROVED", actor: "demo-seed" } },
                  }
                : {}),
            },
          });
        }
      });
      const statuses = await db.review.groupBy({
        by: ["status"],
        where: { idempotencyKey: { in: keys } },
        _count: { _all: true },
      });
      console.log(JSON.stringify({ mode: "seed", statuses, preservesExistingDecisions: true }));
    }
  } finally {
    await db.$disconnect();
  }
}
