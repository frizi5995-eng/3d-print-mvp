import { cn } from "@/lib/utils";
import { PAYMENT_STATUS_LABELS } from "@/lib/constants";
import type { PaymentStatus } from "@/types";

const PAYMENT_STATUS_STYLES: Record<PaymentStatus, string> = {
  unpaid: "bg-muted text-muted-foreground",
  invoice_sent: "bg-info/15 text-info",
  paid: "bg-success/15 text-success",
  payment_failed: "bg-destructive/15 text-destructive",
  refunded: "bg-warning/15 text-warning",
};

export function PaymentStatusBadge({ status }: { status: PaymentStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium",
        PAYMENT_STATUS_STYLES[status]
      )}
    >
      {PAYMENT_STATUS_LABELS[status]}
    </span>
  );
}
