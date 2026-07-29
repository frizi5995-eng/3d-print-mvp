import Link from "next/link";
import { StatusBadge } from "@/components/admin/status-badge";
import type { RequestSummary } from "@/lib/admin/dashboard";

export function RequestSummaryList({
  items,
  emptyLabel = "None right now.",
}: {
  items: RequestSummary[];
  emptyLabel?: string;
}) {
  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyLabel}</p>;
  }

  return (
    <ul className="flex flex-col divide-y divide-border">
      {items.map((item) => (
        <li key={item.id}>
          <Link
            href={`/admin/requests/${item.id}`}
            className="flex items-center justify-between gap-3 py-2 text-sm transition-colors hover:text-primary"
          >
            <span className="truncate">
              #{item.reference_number} · {item.customer_name}
            </span>
            <StatusBadge status={item.status} />
          </Link>
        </li>
      ))}
    </ul>
  );
}
