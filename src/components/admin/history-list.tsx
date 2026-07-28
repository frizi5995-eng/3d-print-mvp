import { formatDateTime } from "@/lib/utils";
import { STATUS_LABELS } from "@/lib/constants";
import type { StatusHistoryEntry } from "@/types";

export function HistoryList({ history }: { history: StatusHistoryEntry[] }) {
  if (history.length === 0) {
    return <p className="text-sm text-muted-foreground">No history yet.</p>;
  }

  return (
    <ol className="flex flex-col gap-3">
      {history.map((entry, index) => (
        <li key={entry.id} className="flex items-center gap-3 text-sm">
          <span className="size-1.5 shrink-0 rounded-full bg-primary" />
          <span className="w-40 shrink-0 text-muted-foreground">
            {formatDateTime(entry.created_at)}
          </span>
          <span>
            {index === 0 ? "Request created" : `Status changed to ${STATUS_LABELS[entry.status]}`}
          </span>
        </li>
      ))}
    </ol>
  );
}
