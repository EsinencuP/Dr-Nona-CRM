export const MAX_APPLICATION_BODY_BYTES = 16 * 1024;

export async function readJsonBody(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().startsWith("application/json")) {
    return { success: false as const, status: 400, code: "INVALID_CONTENT_TYPE" };
  }
  const declaredLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(declaredLength) && declaredLength > MAX_APPLICATION_BODY_BYTES) {
    return { success: false as const, status: 413, code: "PAYLOAD_TOO_LARGE" };
  }
  const text = await request.text();
  if (new TextEncoder().encode(text).byteLength > MAX_APPLICATION_BODY_BYTES) {
    return { success: false as const, status: 413, code: "PAYLOAD_TOO_LARGE" };
  }
  try {
    return { success: true as const, value: JSON.parse(text) as unknown };
  } catch {
    return { success: false as const, status: 400, code: "INVALID_JSON" };
  }
}

export function requestOriginIsAllowed(request: Request, allowedOrigins: ReadonlySet<string>) {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    const normalizedOrigin = new URL(origin).origin;
    const requestOrigin = new URL(request.url).origin;
    return normalizedOrigin === requestOrigin || allowedOrigins.has(normalizedOrigin);
  } catch {
    return false;
  }
}
