import { statusLabels } from "@/lib/crm-labels";
import type { OrderStatus } from "@/lib/crm-types";
import { cn } from "@/lib/utils";

const statusStyles: Record<OrderStatus, string> = {
  NEW: "border-cyan-200 bg-cyan-50 text-cyan-800",
  PROCESSING: "border-amber-200 bg-amber-50 text-amber-800",
  DELIVERY: "border-blue-200 bg-blue-50 text-blue-800",
  DONE: "border-emerald-200 bg-emerald-50 text-emerald-800",
  CANCELLED: "border-rose-200 bg-rose-50 text-rose-800",
};

export function StatusBadge({ status, className }: { status: OrderStatus; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex min-h-6 items-center rounded-full border px-2.5 py-1 font-bold text-xs",
        statusStyles[status],
        className,
      )}
    >
      {statusLabels[status]}
    </span>
  );
}
