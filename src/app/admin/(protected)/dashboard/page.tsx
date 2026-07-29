import Link from "next/link";
import { getDashboardData, DASHBOARD_RANGE_LABELS, type DashboardRange } from "@/lib/admin/dashboard";
import { StatTile } from "@/components/admin/stat-tile";
import { BarChart } from "@/components/admin/charts/bar-chart";
import { DistributionList } from "@/components/admin/charts/distribution-list";
import { RequestSummaryList } from "@/components/admin/dashboard/request-summary-list";
import { formatEUR } from "@/lib/admin/money";
import { STATUS_LABELS } from "@/lib/constants";
import { cn } from "@/lib/utils";

const RANGES: DashboardRange[] = ["today", "7d", "30d", "90d", "all"];

export default async function AdminDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const params = await searchParams;
  const range = (RANGES.includes(params.range as DashboardRange) ? params.range : "30d") as DashboardRange;

  const data = await getDashboardData(range);
  const pct = (value: number | null) => (value === null ? "—" : `${value.toFixed(1)}%`);
  const eur = (value: number | null) => (value === null ? "—" : formatEUR(value));

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-xl font-semibold tracking-tight">Dashboard</h1>
        <nav className="flex gap-2">
          {RANGES.map((r) => (
            <Link
              key={r}
              href={`/admin/dashboard?range=${r}`}
              className={cn(
                "rounded-lg border px-3 py-1.5 text-sm transition-colors",
                range === r
                  ? "border-primary bg-primary/10 text-foreground"
                  : "border-input text-muted-foreground hover:bg-surface-elevated"
              )}
            >
              {DASHBOARD_RANGE_LABELS[r]}
            </Link>
          ))}
        </nav>
      </div>

      {/* KPIs */}
      <Panel title="Overview">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          <StatTile label="Requests today" value={String(data.kpis.requestsToday)} />
          <StatTile label="Requests this week" value={String(data.kpis.requestsThisWeek)} />
          <StatTile label="Open" value={String(data.kpis.open)} />
          <StatTile label="Awaiting review" value={String(data.kpis.awaitingReview)} />
          <StatTile label="Quotes ready" value={String(data.kpis.quotesReady)} />
          <StatTile label="Accepted" value={String(data.kpis.accepted)} tone="positive" />
          <StatTile label="Manufacturing" value={String(data.kpis.manufacturing)} />
          <StatTile label="Shipped" value={String(data.kpis.shipped)} />
          <StatTile label="Completed" value={String(data.kpis.completed)} tone="positive" />
        </div>
      </Panel>

      {/* Financial + conversion */}
      <div className="grid gap-6 lg:grid-cols-3">
        <Panel title="Financial">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <StatTile label="Quoted revenue" value={eur(data.financial.quotedRevenue)} />
            <StatTile label="Accepted revenue" value={eur(data.financial.acceptedRevenue)} tone="positive" />
            <StatTile label="Internal cost" value={eur(data.financial.internalCost)} />
            <StatTile
              label="Gross profit"
              value={eur(data.financial.grossProfit)}
              tone={
                data.financial.grossProfit !== null
                  ? data.financial.grossProfit >= 0
                    ? "positive"
                    : "negative"
                  : undefined
              }
            />
            <StatTile label="Avg. quote value" value={eur(data.financial.avgQuoteValue)} />
            <StatTile label="Avg. gross margin" value={pct(data.financial.avgGrossMargin)} />
          </div>
        </Panel>

        <Panel title="Business snapshot (paid requests)">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <StatTile label="Quotes sent" value={String(data.business.quotesSent)} />
            <StatTile label="Accepted" value={String(data.business.accepted)} tone="positive" />
            <StatTile label="Paid" value={String(data.business.paid)} tone="positive" />
            <StatTile label="Revenue (paid)" value={eur(data.business.paidRevenue)} tone="positive" />
            <StatTile
              label="Gross profit (paid)"
              value={eur(data.business.paidGrossProfit)}
              tone={
                data.business.paidGrossProfit !== null
                  ? data.business.paidGrossProfit >= 0
                    ? "positive"
                    : "negative"
                  : undefined
              }
            />
          </div>
        </Panel>

        <Panel title="Conversion">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <StatTile label="Requests" value={String(data.conversion.requests)} />
            <StatTile label="Quotes prepared" value={String(data.conversion.quotesPrepared)} />
            <StatTile label="Accepted" value={String(data.conversion.accepted)} tone="positive" />
            <StatTile label="Declined" value={String(data.conversion.declined)} tone="negative" />
            <StatTile
              label="Acceptance rate"
              value={data.conversion.acceptanceRate === null ? "—" : pct(data.conversion.acceptanceRate * 100)}
            />
          </div>
        </Panel>
      </div>

      {/* Charts */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Requests over time">
          <BarChart
            data={data.charts.requestsOverTime.map((d) => ({ label: d.label, count: d.count }))}
            series={[{ key: "count", label: "Requests", colorClassName: "bg-primary" }]}
          />
        </Panel>

        <Panel title="Accepted vs declined">
          <BarChart
            data={data.charts.acceptedVsDeclined.map((d) => ({
              label: d.label,
              accepted: d.accepted,
              declined: d.declined,
            }))}
            series={[
              { key: "accepted", label: "Accepted", colorClassName: "bg-success" },
              { key: "declined", label: "Declined", colorClassName: "bg-destructive" },
            ]}
          />
        </Panel>

        <Panel title="Request status distribution">
          <DistributionList
            items={data.charts.statusDistribution.map((s) => ({
              label: STATUS_LABELS[s.status],
              count: s.count,
            }))}
          />
        </Panel>

        <Panel title="Revenue over time (accepted+)">
          <BarChart
            data={data.charts.revenueOverTime.map((d) => ({ label: d.label, revenue: Math.round(d.revenue) }))}
            series={[{ key: "revenue", label: "Revenue (€)", colorClassName: "bg-info" }]}
          />
        </Panel>
      </div>

      {/* Operations widgets */}
      <div className="grid gap-6 lg:grid-cols-3">
        <Panel title="Newest requests">
          <RequestSummaryList items={data.widgets.newest} />
        </Panel>
        <Panel title="Needing attention (new, 24h+)">
          <RequestSummaryList items={data.widgets.needingAttention} emptyLabel="Nothing waiting." />
        </Panel>
        <Panel title="Oldest open requests">
          <RequestSummaryList items={data.widgets.oldestOpen} emptyLabel="Nothing open." />
        </Panel>
        <Panel title="Quotes expiring soon (48h)">
          <RequestSummaryList items={data.widgets.quotesExpiringSoon} emptyLabel="None expiring soon." />
        </Panel>
        <Panel title="Accepted, unpaid">
          <RequestSummaryList items={data.widgets.acceptedUnpaid} emptyLabel="None waiting." />
        </Panel>
        <Panel title="Paid, ready for manufacturing">
          <RequestSummaryList items={data.widgets.paidReadyForManufacturing} emptyLabel="None waiting." />
        </Panel>
        <Panel title="In manufacturing, awaiting shipment">
          <RequestSummaryList items={data.widgets.awaitingShipment} emptyLabel="None waiting." />
        </Panel>
      </div>

      <Panel title="Suspicious requests">
        <RequestSummaryList items={data.widgets.suspicious} emptyLabel="None flagged." />
      </Panel>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
      <h2 className="text-sm font-medium text-muted-foreground">{title}</h2>
      {children}
    </section>
  );
}
