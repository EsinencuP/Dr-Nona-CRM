import type { ReactNode } from "react";

import { CrmShell } from "./_components/crm-shell";

export default function CrmLayout({ children }: Readonly<{ children: ReactNode }>) {
  return <CrmShell>{children}</CrmShell>;
}
