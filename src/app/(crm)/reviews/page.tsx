import Link from "next/link";

import type { Metadata } from "next";

import { prisma } from "@/lib/prisma";
import { products } from "@/lib/products";
import { requireCrmAccess } from "@/server/crm-auth";

import { PageHeader } from "../_components/page-header";
import { ModerationForm } from "./_components/moderation-form";

export const metadata: Metadata = { title: "Отзывы — модерация" };
export const dynamic = "force-dynamic";
const statuses = { PENDING: "Ожидают проверки", APPROVED: "Опубликованы", REJECTED: "Отклонены" } as const;

export default async function ReviewsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; page?: string }>;
}) {
  await requireCrmAccess();
  const query = await searchParams;
  const status = query.status === "APPROVED" || query.status === "REJECTED" ? query.status : "PENDING";
  const requestedPage = Number(query.page ?? 1);
  const page = Number.isInteger(requestedPage) && requestedPage > 0 ? Math.min(requestedPage, 10000) : 1;
  const rows = await prisma.review.findMany({
    where: { status },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    skip: (page - 1) * 20,
    take: 21,
    include: { moderationAudits: { orderBy: { createdAt: "desc" }, take: 20 } },
  });
  return (
    <>
      <PageHeader
        eyebrow="Обратная связь"
        title="Отзывы"
        description="Новые отзывы ждут проверки. Лайк публикует отзыв, дизлайк сохраняет его только в истории CRM. Перед публикацией проверьте персональные данные и недопустимые медицинские утверждения."
      />
      <nav aria-label="Статус отзывов" className="mb-5 flex flex-wrap gap-3">
        {Object.entries(statuses).map(([value, label]) => (
          <Link
            key={value}
            href={`/reviews?status=${value}`}
            aria-current={status === value ? "page" : undefined}
            className={`rounded-lg border px-4 py-3 font-bold ${status === value ? "bg-primary text-primary-foreground" : "bg-white"}`}
          >
            {label}
          </Link>
        ))}
      </nav>
      <div className="space-y-4">
        {!rows.length && <p className="rounded-xl border bg-white p-6">В этом разделе пока нет отзывов.</p>}
        {rows.slice(0, 20).map((review) => {
          const product = products.find((item) => item.slug === review.productSlug);
          return (
            <article key={review.id} className="rounded-xl border bg-white p-5">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="font-bold text-lg">{review.authorName}</h2>
                <time dateTime={review.createdAt.toISOString()} className="text-muted-foreground text-sm">
                  {review.createdAt.toLocaleString("ru-MD", { timeZone: "Europe/Chisinau" })}
                </time>
              </div>
              <p className="mt-1 text-muted-foreground text-sm">
                {product ? `${product.name} · SKU ${product.sku}` : review.productSlug || "Общий отзыв"} ·{" "}
                {review.locale.toUpperCase()} · {statuses[review.status]}
              </p>
              <p className="mt-3 whitespace-pre-wrap break-words">{review.body}</p>
              <ModerationForm id={review.id} version={review.version} status={review.status} />
              {!!review.moderationAudits.length && (
                <details className="mt-3 text-sm">
                  <summary className="cursor-pointer font-bold">История модерации</summary>
                  <ul className="mt-2 space-y-1">
                    {review.moderationAudits.map((audit) => (
                      <li key={audit.id}>
                        {audit.createdAt.toLocaleString("ru-MD", { timeZone: "Europe/Chisinau" })} · {audit.actor}:{" "}
                        {statuses[audit.fromStatus]} → {statuses[audit.toStatus]}
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </article>
          );
        })}
      </div>
      <nav aria-label="Страницы отзывов" className="mt-5 flex gap-4">
        {page > 1 && <Link href={`/reviews?status=${status}&page=${page - 1}`}>Назад</Link>}
        {rows.length > 20 && <Link href={`/reviews?status=${status}&page=${page + 1}`}>Далее</Link>}
      </nav>
    </>
  );
}
