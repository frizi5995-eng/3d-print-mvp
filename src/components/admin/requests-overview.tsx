import { formatEUR } from "@/lib/admin/money";
import { STATUS_LABELS, DECLINE_REASON_LABELS } from "@/lib/constants";
import { StatTile } from "@/components/admin/stat-tile";
import type { RequestStats } from "@/lib/admin/requests";

export function RequestsOverview({ stats }: { stats: RequestStats }) {
  const activeStatusCounts = Object.entries(stats.byStatus).filter(([, count]) => count > 0);
  const declineReasonEntries = Object.entries(stats.declineReasons) as [string, number][];

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <StatTile label="Total requests" value={String(stats.total)} />
        <StatTile label="Quotes prepared" value={String(stats.quotesPrepared)} />
        <StatTile label="Accepted" value={String(stats.accepted)} tone="positive" />
        <StatTile label="Declined" value={String(stats.declined)} tone="negative" />
        <StatTile
          label="Acceptance rate"
          value={stats.acceptanceRate === null ? "—" : `${Math.round(stats.acceptanceRate * 100)}%`}
        />
        <StatTile
          label="Avg. margin"
          value={stats.averageMargin === null ? "—" : formatEUR(stats.averageMargin)}
        />
      </div>

      {(activeStatusCounts.length > 0 ||
        declineReasonEntries.length > 0 ||
        stats.oldestOpenAgeDays !== null) && (
        <div className="flex flex-wrap gap-x-8 gap-y-2 border-t border-border pt-4 text-sm">
          {stats.oldestOpenAgeDays !== null && (
            <p className="text-muted-foreground">
              Oldest open request:{" "}
              <span className="font-medium text-foreground">
                {stats.oldestOpenAgeDays === 0 ? "today" : `${stats.oldestOpenAgeDays}d ago`}
              </span>
            </p>
          )}

          {activeStatusCounts.length > 0 && (
            <p className="text-muted-foreground">
              By status:{" "}
              {activeStatusCounts
                .map(([status, count]) => `${STATUS_LABELS[status as keyof typeof STATUS_LABELS]} (${count})`)
                .join(" · ")}
            </p>
          )}

          {declineReasonEntries.length > 0 && (
            <p className="text-muted-foreground">
              Decline reasons:{" "}
              {declineReasonEntries
                .map(([reason, count]) => `${DECLINE_REASON_LABELS[reason as keyof typeof DECLINE_REASON_LABELS]} (${count})`)
                .join(" · ")}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
