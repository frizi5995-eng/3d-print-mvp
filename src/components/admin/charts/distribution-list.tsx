import { cn } from "@/lib/utils";
import { EmptyChartState } from "@/components/admin/charts/empty-chart-state";

export function DistributionList({
  items,
}: {
  items: { label: string; count: number; colorClassName?: string }[];
}) {
  if (items.length === 0) return <EmptyChartState />;
  const total = items.reduce((sum, item) => sum + item.count, 0);

  return (
    <div className="flex flex-col gap-2.5">
      {items.map((item) => (
        <div key={item.label} className="flex items-center gap-3 text-sm">
          <span className="w-32 shrink-0 truncate text-muted-foreground">{item.label}</span>
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-elevated">
            <div
              className={cn("h-full rounded-full", item.colorClassName ?? "bg-primary")}
              style={{ width: `${total > 0 ? (item.count / total) * 100 : 0}%` }}
            />
          </div>
          <span className="w-8 shrink-0 text-right font-medium">{item.count}</span>
        </div>
      ))}
    </div>
  );
}
