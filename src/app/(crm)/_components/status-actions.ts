"use server";

import { getCrmStatusSnapshot } from "@/server/crm-status";

export async function refreshCrmStatus() {
  return getCrmStatusSnapshot();
}
