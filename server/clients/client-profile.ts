import type { PrismaClient } from "@prisma/client";

export type CanonicalClientProfile = {
  firstName: string;
  lastName: string;
  phone: string;
  phoneNormalized: string;
  email: string | null;
  region: string;
};

export type UpdateClientProfileResult =
  | { outcome: "updated" | "no_change" }
  | { outcome: "not_found" | "phone_conflict" };

export async function updateCanonicalClientProfile(
  clientId: string,
  profile: CanonicalClientProfile,
  actor: string,
  db: PrismaClient,
): Promise<UpdateClientProfileResult> {
  const existing = await db.client.findUnique({ where: { id: clientId } });
  if (!existing) return { outcome: "not_found" };

  const collision = await db.client.findFirst({
    where: {
      phoneNormalized: profile.phoneNormalized,
      id: { not: existing.id },
    },
    select: { id: true },
  });
  if (collision) return { outcome: "phone_conflict" };

  const before: CanonicalClientProfile = {
    firstName: existing.firstName,
    lastName: existing.lastName,
    phone: existing.phone,
    phoneNormalized: existing.phoneNormalized,
    email: existing.email,
    region: existing.region,
  };
  if (JSON.stringify(before) === JSON.stringify(profile)) {
    return { outcome: "no_change" };
  }

  await db.$transaction([
    db.client.update({ where: { id: existing.id }, data: profile }),
    db.clientProfileAudit.create({
      data: { clientId: existing.id, actor, before, after: profile },
    }),
  ]);
  return { outcome: "updated" };
}
