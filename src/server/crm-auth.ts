import { headers } from "next/headers";

import { timingSafeEqual } from "node:crypto";

function configuredCredentials() {
  const user = process.env.CRM_BASIC_USER;
  const password = process.env.CRM_BASIC_PASSWORD;

  if (!user && !password) {
    return null;
  }

  if (!user || !password) {
    throw new Error("CRM Basic Auth настроен не полностью.");
  }

  return `Basic ${Buffer.from(`${user}:${password}`).toString("base64")}`;
}

function secureEqual(actual: string, expected: string) {
  const actualBuffer = Buffer.from(actual);
  const expectedBuffer = Buffer.from(expected);
  return actualBuffer.length === expectedBuffer.length && timingSafeEqual(actualBuffer, expectedBuffer);
}

export async function requireCrmAccess() {
  const expected = configuredCredentials();
  if (!expected) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("CRM недоступна: production-доступ не настроен.");
    }
    return;
  }

  const actual = (await headers()).get("authorization") ?? "";
  if (!secureEqual(actual, expected)) {
    throw new Error("Недостаточно прав для изменения данных CRM.");
  }
}
