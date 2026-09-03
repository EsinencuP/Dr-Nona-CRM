import { z } from "zod";

import { MASTERCLASS_TOPICS } from "../constants/masterclass-topics";
import { MOLDOVA_REGIONS } from "../constants/moldova-regions";

const NAME_MAX = 60;
const PHONE_MAX = 32;
const SLUG_MAX = 100;

const trimmedText = (label: string, max: number) =>
  z
    .string({ error: `${label}: обязательное поле` })
    .trim()
    .min(1, `${label}: обязательное поле`)
    .max(max, `${label}: слишком длинное значение`);

const baseApplicationSchema = z.object({
  locale: z.enum(["ru-MD", "ro-MD"]),
  firstName: trimmedText("Имя", NAME_MAX),
  lastName: trimmedText("Фамилия", NAME_MAX),
  phone: z
    .string({ error: "Некорректный номер телефона" })
    .trim()
    .min(1, "Некорректный номер телефона")
    .max(PHONE_MAX, "Некорректный номер телефона")
    .regex(/^[\d\s+()-]+$/u, "Некорректный номер телефона")
    .refine((value) => {
      const digits = value.replace(/\D/g, "");
      return digits.length >= 7 && digits.length <= 15;
    }, "Некорректный номер телефона"),
  city: z
    .string({ error: "Выберите регион" })
    .trim()
    .min(1, "Выберите регион из списка")
    .refine((value) => MOLDOVA_REGIONS.some((region) => region === value), "Выберите регион из списка"),
  consentAccepted: z.literal(true, {
    error: "Необходимо принять условия обработки данных",
  }),
  website: z.string().max(0, "Некорректные данные формы").optional(),
  email: z.string().trim().email("Некорректный адрес электронной почты").optional().or(z.literal("")),
  comment: z.string().trim().max(500, "Комментарий: не более 500 символов").optional(),
  preferredCallTime: z.string().trim().max(100, "Время звонка: слишком длинное значение").optional(),
  utmSource: z.string().trim().max(200).optional(),
  utmMedium: z.string().trim().max(200).optional(),
  utmCampaign: z.string().trim().max(200).optional(),
  utmContent: z.string().trim().max(200).optional(),
  entryPoint: z.string().trim().max(500).optional(),
  sessionHistory: z.string().trim().max(2000).optional(),
});

export const orderItemSchema = z.object({
  slug: z
    .string()
    .trim()
    .min(1, "Некорректный товар")
    .max(SLUG_MAX, "Некорректный товар")
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/u, "Некорректный товар"),
  quantity: z
    .number()
    .int("Количество должно быть целым числом")
    .min(1, "Минимум 1 шт.")
    .max(99, "Максимум 99 шт.")
    .default(1),
});

export type OrderItemInput = z.infer<typeof orderItemSchema>;

const orderApplicationSchema = baseApplicationSchema.extend({
  type: z.literal("order"),
  productSlugs: z
    .array(
      z
        .string()
        .trim()
        .min(1, "Некорректный товар")
        .max(SLUG_MAX, "Некорректный товар")
        .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/u, "Некорректный товар"),
    )
    .min(1, "Выберите хотя бы один товар")
    .max(20, "Можно выбрать не более 20 товаров")
    .transform((slugs) => [...new Set(slugs)]),
  items: z.array(orderItemSchema).max(20).optional(),
});

const consultationApplicationSchema = baseApplicationSchema.extend({
  type: z.literal("consultation"),
  consultationMode: z.enum(["online", "offline"], {
    error: "Выберите формат консультации",
  }),
  consultationDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/u, "Некорректная дата"),
  consultationTime: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/u, "Некорректное время"),
});

const masterclassApplicationSchema = baseApplicationSchema.extend({
  type: z.literal("masterclass"),
  masterclassTopic: z.enum(MASTERCLASS_TOPICS, {
    error: "Выберите тему мастер-класса из списка",
  }),
  eventDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/u, "Некорректная дата"),
  eventTime: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/u, "Некорректное время"),
});

export const applicationInputSchema = z.discriminatedUnion("type", [
  orderApplicationSchema,
  consultationApplicationSchema,
  masterclassApplicationSchema,
]);

export type ApplicationInput = z.infer<typeof applicationInputSchema>;
export type OrderApplicationInput = Extract<ApplicationInput, { type: "order" }>;
export type ConsultationApplicationInput = Extract<ApplicationInput, { type: "consultation" }>;
export type MasterclassApplicationInput = Extract<ApplicationInput, { type: "masterclass" }>;

export type ApplicationValidationOptions = {
  allowedProductSlugs: ReadonlySet<string>;
  now?: Date;
};

export type ApplicationValidationResult =
  | { success: true; data: ApplicationInput }
  | { success: false; fieldErrors: Record<string, string> };

function isCalendarDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function chisinauLocalMinute(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Chisinau",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}T${value.hour}:${value.minute}`;
}

function flattenFieldErrors(error: z.ZodError) {
  const errors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    errors[key] ??= issue.message;
  }
  return errors;
}

export function validateApplicationInput(
  raw: unknown,
  options: ApplicationValidationOptions,
): ApplicationValidationResult {
  const parsed = applicationInputSchema.safeParse(raw);
  if (!parsed.success) {
    return { success: false, fieldErrors: flattenFieldErrors(parsed.error) };
  }

  const data = parsed.data;
  const fieldErrors: Record<string, string> = {};
  if (data.type === "order") {
    if (data.productSlugs.some((slug) => !options.allowedProductSlugs.has(slug))) {
      fieldErrors.productSlugs = "Один или несколько товаров недоступны";
    }
    if (data.items) {
      const selectedSlugs = new Set(data.productSlugs);
      const itemSlugs = data.items.map((item) => item.slug);
      if (
        new Set(itemSlugs).size !== itemSlugs.length ||
        itemSlugs.some((slug) => !selectedSlugs.has(slug) || !options.allowedProductSlugs.has(slug))
      ) {
        fieldErrors.items = "Некорректные данные о количестве товаров";
      }
    }
  } else if (data.type === "consultation") {
    if (!isCalendarDate(data.consultationDate)) {
      fieldErrors.consultationDate = "Некорректная дата";
    } else if (`${data.consultationDate}T${data.consultationTime}` < chisinauLocalMinute(options.now ?? new Date())) {
      fieldErrors.consultationDate = "Выберите будущую дату и время по часовому поясу Кишинёва";
    }
  } else if (!isCalendarDate(data.eventDate)) {
    fieldErrors.eventDate = "Некорректная дата";
  } else if (`${data.eventDate}T${data.eventTime}` < chisinauLocalMinute(options.now ?? new Date())) {
    fieldErrors.eventDate = "Выберите будущую дату и время по часовому поясу Кишинёва";
  }

  return Object.keys(fieldErrors).length ? { success: false, fieldErrors } : { success: true, data };
}

export function normalizePhone(phone: string) {
  const trimmed = phone.trim().replace(/\s+/g, " ");
  const normalized = `${trimmed.startsWith("+") ? "+" : ""}${trimmed.replace(/\D/g, "")}`;
  return { phone: trimmed, phoneNormalized: normalized };
}
