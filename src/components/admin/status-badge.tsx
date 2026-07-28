import { cn } from "@/lib/utils";
import { STATUS_LABELS } from "@/lib/constants";
import type { RequestStatus } from "@/types";

const STATUS_STYLES: Record<RequestStatus, string> = {
  new: "bg-info/15 text-info",
  checking: "bg-muted text-muted-foreground",
  waiting_for_partner: "bg-warning/15 text-warning",
  quote_ready: "bg-primary/15 text-primary",
  quote_sent: "bg-info/15 text-info",
  accepted: "bg-success/15 text-success",
  declined: "bg-destructive/15 text-destructive",
  manufacturing: "bg-primary/15 text-primary",
  shipped: "bg-info/15 text-info",
  completed: "bg-success/15 text-success",
};

export function StatusBadge({ status }: { status: RequestStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium",
        STATUS_STYLES[status]
      )}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}
