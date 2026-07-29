import { cn } from "@/lib/utils";
import { EmptyChartState } from "@/components/admin/charts/empty-chart-state";

interface BarChartSeries {
  key: string;
  label: string;
  colorClassName: string;
}

interface BarChartPoint {
  label: string;
  [seriesKey: string]: number | string;
}

/**
 * Minimal dependency-free bar chart — CSS height percentages, not SVG, so
 * it stays responsive without any viewBox/resize math. One or more series
 * per point (e.g. accepted vs. declined stacked side by side per day).
 */
export function BarChart({
  data,
  series,
  height = 140,
}: {
  data: BarChartPoint[];
  series: BarChartSeries[];
  height?: number;
}) {
  if (data.length === 0) return <EmptyChartState />;

  const max = Math.max(1, ...data.flatMap((point) => series.map((s) => Number(point[s.key]) || 0)));
  const showLabels = data.length <= 14;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-end gap-1 overflow-x-auto" style={{ height }}>
        {data.map((point, i) => (
          <div
            key={i}
            title={`${point.label}: ${series.map((s) => `${s.label} ${point[s.key]}`).join(", ")}`}
            className="flex min-w-5 flex-1 items-end justify-center gap-0.5"
            style={{ height }}
          >
            {series.map((s) => {
              const value = Number(point[s.key]) || 0;
              return (
                <div
                  key={s.key}
                  className={cn("w-full min-w-1 rounded-t-sm transition-all", s.colorClassName)}
                  style={{ height: `${Math.max(value > 0 ? 3 : 0, (value / max) * 100)}%` }}
                />
              );
            })}
          </div>
        ))}
      </div>

      {showLabels && (
        <div className="flex gap-1 overflow-x-auto text-[10px] text-muted-foreground">
          {data.map((point, i) => (
            <span key={i} className="min-w-5 flex-1 truncate text-center">
              {point.label}
            </span>
          ))}
        </div>
      )}

      {series.length > 1 && (
        <div className="flex gap-4 text-xs text-muted-foreground">
          {series.map((s) => (
            <span key={s.key} className="flex items-center gap-1.5">
              <span className={cn("size-2 rounded-full", s.colorClassName)} />
              {s.label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
