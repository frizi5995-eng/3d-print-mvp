import { cn } from "@/lib/utils";

const STEPS = ["Upload", "Configure", "Review"] as const;

export function ProgressSteps({ current }: { current: number }) {
  return (
    <ol className="flex items-center gap-3 text-sm">
      {STEPS.map((label, index) => {
        const step = index + 1;
        const active = step === current;
        const done = step < current;
        return (
          <li key={label} className="flex items-center gap-3">
            {index > 0 && <span className="h-px w-6 bg-border" />}
            <span className={cn("flex items-center gap-1.5", !active && "text-muted-foreground")}>
              <span
                className={cn(
                  "font-mono text-xs",
                  active && "text-primary",
                  done && "text-foreground"
                )}
              >
                0{step}
              </span>
              <span className={cn(active && "font-medium text-foreground")}>{label}</span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}
