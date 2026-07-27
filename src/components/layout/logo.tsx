import Link from "next/link";
import { Box } from "lucide-react";
import { cn } from "@/lib/utils";

export function Logo({ className }: { className?: string }) {
  return (
    <Link
      href="/"
      className={cn("flex items-center gap-2 text-base font-semibold tracking-tight", className)}
    >
      <Box className="size-5 text-primary" strokeWidth={2} />
      Fabrik
    </Link>
  );
}
