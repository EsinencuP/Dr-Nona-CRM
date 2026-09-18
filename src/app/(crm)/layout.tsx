import type { ReactNode } from "react";

import { getCrmStatusSnapshot } from "@/server/crm-status";

import { CrmShell } from "./_components/crm-shell";

export default async function CrmLayout({ children }: Readonly<{ children: ReactNode }>) {
  const initialStatus = await getCrmStatusSnapshot();
  return <CrmShell initialStatus={initialStatus}>{children}</CrmShell>;
}
