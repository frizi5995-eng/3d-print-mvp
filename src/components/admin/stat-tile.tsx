import { cn } from "@/lib/utils";

export function StatTile({
  label,
  value,
  tone,
  size = "default",
}: {
  label: string;
  value: string;
  tone?: "positive" | "negative";
  size?: "default" | "sm";
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span
        className={cn(
          "font-semibold",
          size === "sm" ? "text-lg" : "text-2xl",
          tone === "positive" && "text-success",
          tone === "negative" && "text-destructive"
        )}
      >
        {value}
      </span>
    </div>
  );
}
