import type { ConsultationSlotState, Prisma, PrismaClient } from "@prisma/client";

export const CONSULTATION_TIMEZONE = "Europe/Chisinau" as const;
export const CONSULTATION_SLOT_MODES = ["online", "offline"] as const;
export type ConsultationSlotMode = (typeof CONSULTATION_SLOT_MODES)[number];

type SlotDb = PrismaClient | Prisma.TransactionClient;

export function chisinauLocalMinute(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: CONSULTATION_TIMEZONE,
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

export function chisinauMinuteToDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d$/u.test(value)) return null;
  const approximate = Date.parse(`${value}:00.000Z`);
  if (!Number.isFinite(approximate)) return null;
  const candidates: Date[] = [];
  for (let offsetHours = -4; offsetHours <= 4; offsetHours += 1) {
    const candidate = new Date(approximate + offsetHours * 60 * 60 * 1000);
    if (chisinauLocalMinute(candidate) === value) candidates.push(candidate);
  }
  return candidates.length === 1 ? candidates[0] : null;
}

export async function listPublicConsultationSlots(db: SlotDb, now = new Date()) {
  const maximum = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
  return db.consultationSlot.findMany({
    where: { state: "OPEN", startsAt: { gt: now, lte: maximum } },
    select: { id: true, startsAt: true, endsAt: true, mode: true },
    orderBy: [{ startsAt: "asc" }, { id: "asc" }],
    take: 200,
  });
}

export async function createConsultationSlot(
  input: { startsAt: Date; endsAt: Date; mode: ConsultationSlotMode; actor: string },
  db: PrismaClient,
) {
  return db.$transaction(async (transaction) => {
    const overlap = await transaction.consultationSlot.findFirst({
      where: {
        state: { not: "CANCELLED" },
        startsAt: { lt: input.endsAt },
        endsAt: { gt: input.startsAt },
      },
      select: { id: true },
    });
    if (overlap) throw new Error("CONSULTATION_SLOT_OVERLAP");
    const slot = await transaction.consultationSlot.create({
      data: {
        startsAt: input.startsAt,
        endsAt: input.endsAt,
        mode: input.mode,
        createdBy: input.actor.slice(0, 160),
      },
    });
    await transaction.consultationSlotAudit.create({
      data: { slotId: slot.id, actor: input.actor.slice(0, 160), toState: "OPEN", reason: "created" },
    });
    return slot;
  });
}

export async function changeConsultationSlotState(
  input: {
    slotId: string;
    nextState: Extract<ConsultationSlotState, "OPEN" | "CLOSED" | "CANCELLED">;
    actor: string;
    reason?: string;
  },
  db: PrismaClient,
) {
  return db.$transaction(async (transaction) => {
    const slot = await transaction.consultationSlot.findUnique({ where: { id: input.slotId } });
    if (!slot) return { outcome: "not_found" as const };
    if (slot.state === "RESERVED") return { outcome: "reserved" as const };
    if (input.nextState === "OPEN" && slot.startsAt <= new Date()) return { outcome: "past" as const };
    if (slot.state === input.nextState) return { outcome: "unchanged" as const };
    const updated = await transaction.consultationSlot.updateMany({
      where: { id: slot.id, state: slot.state },
      data: {
        state: input.nextState,
        ...(input.nextState === "OPEN" ? { reservedOrderId: null, reservedAt: null } : {}),
      },
    });
    if (updated.count !== 1) return { outcome: "conflict" as const };
    await transaction.consultationSlotAudit.create({
      data: {
        slotId: slot.id,
        actor: input.actor.slice(0, 160),
        fromState: slot.state,
        toState: input.nextState,
        reason: input.reason?.trim().slice(0, 300) || null,
      },
    });
    return { outcome: "updated" as const };
  });
}

export async function releaseConsultationSlotForOrder(
  orderId: string,
  actor: string,
  reason: string,
  db: Prisma.TransactionClient,
) {
  const slot = await db.consultationSlot.findUnique({ where: { reservedOrderId: orderId } });
  if (!slot) return false;
  await db.consultationSlot.update({
    where: { id: slot.id },
    data: { state: "OPEN", reservedOrderId: null, reservedAt: null },
  });
  await db.consultationSlotAudit.create({
    data: {
      slotId: slot.id,
      actor: actor.slice(0, 160),
      fromState: "RESERVED",
      toState: "OPEN",
      reason: reason.slice(0, 300),
    },
  });
  return true;
}
