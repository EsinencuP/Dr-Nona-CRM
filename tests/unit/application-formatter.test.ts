import { describe, expect, test } from "vitest";

import type { ApplicationRecord } from "../../server/applications/application-types";
import {
  ALL_STATUS_LINES,
  formatTelegramApplication,
  replaceAnyStatus,
  replaceStatus,
  STATUS_CANCELLED,
  STATUS_DELIVERY,
  STATUS_DONE,
  STATUS_PENDING,
  STATUS_PROCESSING,
} from "../../server/applications/format-application";
import { MASTERCLASS_TOPICS } from "../../shared/constants/masterclass-topics";

const common = {
  schemaVersion: 1 as const,
  requestId: "request-123",
  firstName: "Ana",
  lastName: "Popescu",
  phone: "+373 69 123 456",
  phoneNormalized: "+37369123456",
  city: "Кишинёв",
  source: "website" as const,
  locale: "ru-MD" as const,
  submittedAt: "2030-06-19T08:30:00.000Z",
};

describe("application formatter", () => {
  test("formats exact plain-text order notification", () => {
    const record: ApplicationRecord = {
      ...common,
      type: "order",
      products: [
        { slug: "first", officialName: "First", sku: "001", quantity: 3 },
        { slug: "second", officialName: "Second", sku: "", quantity: 1 },
      ],
    };
    expect(formatTelegramApplication(record)).toBe(
      [
        "🛒 НОВЫЙ ЗАКАЗ",
        "",
        "Язык: RU",
        "Имя Фамилия: Ana Popescu",
        "Телефон: +373 69 123 456",
        "Регион: Кишинёв",
        "",
        "Товары:",
        "1. First × 3 шт. — SKU 001",
        "2. Second — SKU не указан",
        "",
        "ID заявки: request-123",
        "Получено: 19.06.2030, 11:30:00",
        "Источник: сайт Dr. Nona Moldova",
        "",
        STATUS_PENDING,
      ].join("\n"),
    );
  });

  test("formats exact plain-text consultation notification", () => {
    const record: ApplicationRecord = {
      ...common,
      type: "consultation",
      consultationMode: "offline",
      consultationDate: "2030-06-20",
      consultationTime: "14:30",
      timezone: "Europe/Chisinau",
    };
    const message = formatTelegramApplication(record);
    expect(message).toContain("💬 НОВАЯ КОНСУЛЬТАЦИЯ");
    expect(message).toContain("Формат: Офлайн");
    expect(message).toContain("Дата и время: 20.06.2030, 14:30");
    expect(message).toContain("Часовой пояс: Europe/Chisinau");
    expect(message).toContain(STATUS_PENDING);
    expect(message).not.toMatch(/\[object Object\]|undefined|[*_`]/u);
  });

  test("preserves the Romanian application locale for the consultant", () => {
    const record: ApplicationRecord = {
      ...common,
      locale: "ro-MD",
      type: "consultation",
      consultationMode: "online",
      consultationDate: "2030-06-20",
      consultationTime: "10:00",
      timezone: "Europe/Chisinau",
    };
    expect(formatTelegramApplication(record)).toContain("Язык: RO");
  });

  test("formats a masterclass notification with topic and Chisinau time", () => {
    const record: ApplicationRecord = {
      ...common,
      type: "masterclass",
      masterclassTopic: MASTERCLASS_TOPICS[0],
      eventDate: "2030-06-20",
      eventTime: "14:30",
      timezone: "Europe/Chisinau",
    };

    const message = formatTelegramApplication(record);
    expect(message).toContain("🎓 НОВАЯ ЗАПИСЬ НА МАСТЕР-КЛАСС");
    expect(message).toContain(`Тема: ${MASTERCLASS_TOPICS[0]}`);
    expect(message).toContain("Дата и время: 20.06.2030, 14:30");
    expect(message).toContain("Часовой пояс: Europe/Chisinau");
    expect(message).toContain(STATUS_PENDING);
    expect(message).not.toMatch(/\[object Object\]|undefined|[*_`]/u);
  });
});

describe("replaceStatus", () => {
  test("replaces pending status with done", () => {
    const text = `Some message\n\n${STATUS_PENDING}`;
    const result = replaceStatus(text, STATUS_PENDING, STATUS_DONE);
    expect(result).toBe(`Some message\n\n${STATUS_DONE}`);
  });

  test("returns null when target status is not found", () => {
    const text = `Some message\n\n${STATUS_DONE}`;
    const result = replaceStatus(text, STATUS_PENDING, STATUS_DONE);
    expect(result).toBeNull();
  });

  test.each(ALL_STATUS_LINES)("replaces lifecycle status %s", (statusLine) => {
    const text = `Some message\n\n${statusLine}`;
    expect(replaceAnyStatus(text, STATUS_DELIVERY)).toBe(`Some message\n\n${STATUS_DELIVERY}`);
  });

  test("exposes all five lifecycle status lines", () => {
    expect(ALL_STATUS_LINES).toEqual([
      STATUS_PENDING,
      STATUS_PROCESSING,
      STATUS_DELIVERY,
      STATUS_DONE,
      STATUS_CANCELLED,
    ]);
  });

  test("does not alter a message without a lifecycle status", () => {
    expect(replaceAnyStatus("Some message", STATUS_PROCESSING)).toBeNull();
  });
});
