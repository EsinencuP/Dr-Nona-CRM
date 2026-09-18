import { timingSafeEqual } from "node:crypto";

export type CrmAccessDecision = "allow" | "unauthorized" | "unavailable";

function secureEqual(actual: string, expected: string) {
  const actualBuffer = Buffer.from(actual);
  const expectedBuffer = Buffer.from(expected);
  return actualBuffer.length === expectedBuffer.length && timingSafeEqual(actualBuffer, expectedBuffer);
}

export function evaluateCrmBasicAuth(
  authorization: string | null,
  environment: Readonly<Record<string, string | undefined>> = process.env,
  nodeEnvironment: string | undefined = process.env.NODE_ENV,
): CrmAccessDecision {
  const user = environment.CRM_BASIC_USER;
  const password = environment.CRM_BASIC_PASSWORD;

  if (!user && !password) {
    return nodeEnvironment === "production" ? "unavailable" : "allow";
  }
  if (!user || !password) return "unavailable";

  const expected = `Basic ${Buffer.from(`${user}:${password}`).toString("base64")}`;
  return secureEqual(authorization ?? "", expected) ? "allow" : "unauthorized";
}

export function isPublicCrmApiPath(pathname: string) {
  return (
    pathname === "/api/applications" || pathname === "/api/consultation-slots" || pathname === "/api/telegram-webhook"
  );
}
