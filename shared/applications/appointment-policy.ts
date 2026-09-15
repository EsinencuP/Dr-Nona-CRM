export const CHISINAU_TIME_ZONE = "Europe/Chisinau";

export const APPOINTMENT_WINDOWS = {
  consultation: {
    minimumCalendarDays: 0,
    maximumCalendarDays: 90,
  },
  masterclass: {
    minimumCalendarDays: 1,
    maximumCalendarDays: 180,
  },
} as const;

export type AppointmentKind = keyof typeof APPOINTMENT_WINDOWS;
export type AppointmentWindowViolation = "invalid" | "before_minimum" | "after_maximum";

export function chisinauLocalMinute(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: CHISINAU_TIME_ZONE,
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

export function isCalendarDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    Number.isInteger(year) &&
    Number.isInteger(month) &&
    Number.isInteger(day) &&
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function addCalendarDays(date: string, days: number) {
  const value = new Date(`${date}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

export function getAppointmentBounds(kind: AppointmentKind, now = new Date()) {
  const nowMinute = chisinauLocalMinute(now);
  const [today, currentTime] = nowMinute.split("T");
  const policy = APPOINTMENT_WINDOWS[kind];
  if (kind === "consultation") {
    return {
      minimumMinute: nowMinute,
      maximumMinute: `${addCalendarDays(today, policy.maximumCalendarDays)}T${currentTime}`,
      minimumDate: today,
      maximumDate: addCalendarDays(today, policy.maximumCalendarDays),
    };
  }
  return {
    minimumMinute: `${addCalendarDays(today, policy.minimumCalendarDays)}T00:00`,
    maximumMinute: `${addCalendarDays(today, policy.maximumCalendarDays)}T23:59`,
    minimumDate: addCalendarDays(today, policy.minimumCalendarDays),
    maximumDate: addCalendarDays(today, policy.maximumCalendarDays),
  };
}

export function validateAppointmentWindow(
  kind: AppointmentKind,
  date: string,
  time: string,
  now = new Date(),
): AppointmentWindowViolation | null {
  if (!isCalendarDate(date) || !/^(?:[01]\d|2[0-3]):[0-5]\d$/u.test(time)) {
    return "invalid";
  }
  const requestedMinute = `${date}T${time}`;
  const bounds = getAppointmentBounds(kind, now);
  if (requestedMinute < bounds.minimumMinute) return "before_minimum";
  if (requestedMinute > bounds.maximumMinute) return "after_maximum";
  return null;
}
