import type { OrderStatus, PrismaClient } from "@prisma/client";

type NotificationConfig = {
  enabled: true;
  apiToken: string;
  sender: string;
  quietStart: number;
  quietEnd: number;
  templates: Record<"ru-MD" | "ro-MD", string>;
};

export type NotificationConfiguration = NotificationConfig | { enabled: false; reasons: string[] };

type NotificationEnvironment = Readonly<Record<string, string | undefined>>;

export function readNotificationConfiguration(env: NotificationEnvironment = process.env): NotificationConfiguration {
  const reasons: string[] = [];
  if (env.CUSTOMER_STATUS_NOTIFICATIONS_ENABLED !== "true") reasons.push("disabled");
  if (env.CUSTOMER_STATUS_NOTIFICATION_LEGAL_BASIS !== "transactional_status") reasons.push("legal_basis_unapproved");
  const apiToken = env.SMS_MD_API_TOKEN?.trim() ?? "";
  const sender = env.SMS_MD_SENDER?.trim() ?? "";
  const ru = env.CUSTOMER_STATUS_TEMPLATE_PROCESSING_RU?.trim() ?? "";
  const ro = env.CUSTOMER_STATUS_TEMPLATE_PROCESSING_RO?.trim() ?? "";
  if (!apiToken) reasons.push("provider_credentials_missing");
  if (!/^[A-Za-z0-9 ._-]{1,11}$/u.test(sender)) reasons.push("sender_unapproved");
  if (!ru || !ro) reasons.push("templates_unapproved");
  const quiet = /^(\d{2})-(\d{2})$/u.exec(env.CUSTOMER_STATUS_QUIET_HOURS ?? "");
  const quietStart = quiet ? Number(quiet[1]) : Number.NaN;
  const quietEnd = quiet ? Number(quiet[2]) : Number.NaN;
  if (!quiet || quietStart > 23 || quietEnd > 23 || quietStart === quietEnd) reasons.push("quiet_hours_unapproved");
  if (reasons.length) return { enabled: false, reasons };
  return {
    enabled: true,
    apiToken,
    sender,
    quietStart,
    quietEnd,
    templates: { "ru-MD": ru, "ro-MD": ro },
  };
}

function chisinauHour(now: Date) {
  return Number(
    new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Chisinau", hour: "2-digit", hourCycle: "h23" }).format(now),
  );
}

function inQuietHours(hour: number, start: number, end: number) {
  return start < end ? hour >= start && hour < end : hour >= start || hour < end;
}

export async function sendSmsMd(
  input: { to: string; from: string; text: string; apiToken: string },
  fetchImpl: typeof fetch = fetch,
) {
  const response = await fetchImpl("https://api.sms.md/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${input.apiToken}` },
    body: JSON.stringify({ to: input.to, from: input.from, text: input.text }),
    signal: AbortSignal.timeout(10_000),
  });
  const payload: unknown = await response.json().catch(() => null);
  const data = payload && typeof payload === "object" ? (payload as Record<string, unknown>) : {};
  if (!response.ok || typeof data.id !== "string" || data.status === "failed" || data.status === "rejected") {
    return {
      ok: false as const,
      uncertain: response.status >= 500 || (response.ok && typeof data.id !== "string"),
      errorCode: `SMS_MD_${response.status}`,
    };
  }
  return {
    ok: true as const,
    providerMessageId: data.id,
    cost: typeof data.cost === "string" || typeof data.cost === "number" ? Number(data.cost) : null,
    currency: typeof data.currency === "string" ? data.currency : null,
  };
}

export async function processStatusNotification(
  orderId: string,
  status: OrderStatus,
  db: PrismaClient,
  options: { env?: NotificationEnvironment; now?: Date; fetch?: typeof fetch } = {},
) {
  if (status !== "PROCESSING") return { outcome: "not_applicable" as const };
  const config = readNotificationConfiguration(options.env);
  if (!config.enabled) return { outcome: "blocked" as const, reasons: config.reasons };
  const order = await db.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      locale: true,
      client: { select: { phoneNormalized: true, customerNotificationsOptOutAt: true } },
    },
  });
  if (!order) return { outcome: "not_found" as const };
  if (order.client.customerNotificationsOptOutAt) return { outcome: "opted_out" as const };
  if (!/^\+373\d{8}$/u.test(order.client.phoneNormalized)) return { outcome: "invalid_phone" as const };
  const locale = order.locale === "ro-MD" ? "ro-MD" : "ru-MD";
  const body = config.templates[locale].replaceAll("{requestId}", order.id);
  const existing = await db.customerNotification.upsert({
    where: { orderId_status: { orderId: order.id, status } },
    create: {
      orderId: order.id,
      status,
      locale,
      recipient: order.client.phoneNormalized,
      templateKey: `status_processing_${locale}`,
      body,
      provider: "sms.md",
    },
    update: {},
  });
  if (existing.state === "ACCEPTED") return { outcome: "already_accepted" as const };
  if (existing.state === "NEEDS_REVIEW") return { outcome: "needs_review" as const };
  const now = options.now ?? new Date();
  if (inQuietHours(chisinauHour(now), config.quietStart, config.quietEnd))
    return { outcome: "deferred_quiet_hours" as const };
  const acquired = await db.customerNotification.updateMany({
    where: { id: existing.id, state: { in: ["PENDING", "FAILED"] } },
    data: { state: "SENDING", attempts: { increment: 1 }, lastErrorCode: null },
  });
  if (acquired.count !== 1) return { outcome: "in_progress" as const };
  try {
    const result = await sendSmsMd(
      { to: order.client.phoneNormalized, from: config.sender, text: body, apiToken: config.apiToken },
      options.fetch,
    );
    if (!result.ok) {
      await db.customerNotification.update({
        where: { id: existing.id },
        data: { state: result.uncertain ? "NEEDS_REVIEW" : "FAILED", lastErrorCode: result.errorCode },
      });
      return {
        outcome: result.uncertain ? ("needs_review" as const) : ("failed" as const),
        errorCode: result.errorCode,
      };
    }
    await db.customerNotification.update({
      where: { id: existing.id },
      data: {
        state: "ACCEPTED",
        providerMessageId: result.providerMessageId,
        cost: result.cost,
        currency: result.currency,
      },
    });
    return { outcome: "accepted" as const, cost: result.cost, currency: result.currency };
  } catch {
    await db.customerNotification.update({
      where: { id: existing.id },
      data: { state: "NEEDS_REVIEW", lastErrorCode: "SMS_MD_NETWORK" },
    });
    return { outcome: "needs_review" as const, errorCode: "SMS_MD_NETWORK" };
  }
}
