export const CRM_SLA_MINUTES = 60;
export const CRM_TIMEZONE = "Europe/Chisinau" as const;

const chisinauFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: CRM_TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

export function chisinauMidnightUtc(now: Date, dayOffset = 0) {
  const parts = Object.fromEntries(chisinauFormatter.formatToParts(now).map((part) => [part.type, part.value]));
  const target = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day) + dayOffset);
  const probe = new Date(target);
  const localProbe = Object.fromEntries(chisinauFormatter.formatToParts(probe).map((part) => [part.type, part.value]));
  const localProbeAsUtc = Date.UTC(
    Number(localProbe.year),
    Number(localProbe.month) - 1,
    Number(localProbe.day),
    Number(localProbe.hour),
    Number(localProbe.minute),
    Number(localProbe.second),
  );
  return new Date(target - (localProbeAsUtc - target));
}

export function getSlaWindows(now: Date) {
  const weekday = new Intl.DateTimeFormat("en-US", { timeZone: CRM_TIMEZONE, weekday: "short" }).format(now);
  const daysSinceMonday = ({ Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 } as const)[
    weekday as "Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat" | "Sun"
  ];
  return {
    todayStart: chisinauMidnightUtc(now),
    weekStart: chisinauMidnightUtc(now, -daysSinceMonday),
    overdueBefore: new Date(now.getTime() - CRM_SLA_MINUTES * 60_000),
  };
}

export function slaAgeMinutes(createdAt: Date, now: Date) {
  return Math.max(0, Math.floor((now.getTime() - createdAt.getTime()) / 60_000));
}
