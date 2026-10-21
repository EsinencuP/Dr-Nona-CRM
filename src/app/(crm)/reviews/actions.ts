"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { requireCrmAccess } from "@/server/crm-auth";

import { moderationSchema } from "../../../../server/reviews/review-schema";
import { moderateReview } from "../../../../server/reviews/review-service";

export async function moderateReviewAction(_previous: { message: string }, form: FormData) {
  await requireCrmAccess();
  const parsed = moderationSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { message: "Некорректное решение модерации." };
  try {
    const changed = await moderateReview(prisma, parsed.data, process.env.CRM_BASIC_USER || "local-admin");
    revalidatePath("/reviews");
    return { message: changed ? "Решение сохранено." : "Отзыв уже изменён. Обновите страницу." };
  } catch (error) {
    console.error("reviews.moderation.failed", error instanceof Error ? error.name : "UnknownError");
    return { message: "Не удалось сохранить решение. Повторите попытку." };
  }
}
