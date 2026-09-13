import { headers } from "next/headers";

import { evaluateCrmBasicAuth } from "./basic-auth";

export async function requireCrmAccess() {
  const actual = (await headers()).get("authorization") ?? "";
  const decision = evaluateCrmBasicAuth(actual);
  if (decision === "allow") return;
  if (decision === "unavailable") throw new Error("CRM недоступна: production-доступ не настроен.");
  throw new Error("Недостаточно прав для изменения данных CRM.");
}
