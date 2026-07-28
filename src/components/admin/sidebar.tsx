"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/layout/logo";
import { STATUS_LABELS } from "@/lib/constants";
import type { RequestStatus } from "@/types";

const SIDEBAR_STATUSES: (RequestStatus | "all")[] = [
  "all",
  "new",
  "checking",
  "waiting_for_partner",
  "quote_ready",
  "quote_sent",
  "accepted",
  "manufacturing",
  "completed",
];

export function AdminSidebar({ signOutAction }: { signOutAction: () => Promise<void> }) {
  const searchParams = useSearchParams();
  const activeStatus = searchParams.get("status") ?? "all";

  return (
    <aside className="flex h-full w-56 shrink-0 flex-col border-r border-border bg-card">
      <div className="flex h-14 items-center border-b border-border px-4">
        <Logo />
      </div>

      <nav className="flex-1 overflow-y-auto px-2 py-4">
        <p className="px-2 pb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
          Requests
        </p>
        <ul className="flex flex-col gap-0.5">
          {SIDEBAR_STATUSES.map((status) => {
            const isActive = activeStatus === status;
            const href = status === "all" ? "/admin/requests" : `/admin/requests?status=${status}`;
            return (
              <li key={status}>
                <Link
                  href={href}
                  className={cn(
                    "flex items-center rounded-md px-2 py-1.5 text-sm transition-colors",
                    isActive
                      ? "bg-accent text-primary font-medium"
                      : "text-muted-foreground hover:bg-accent hover:text-foreground"
                  )}
                >
                  {status === "all" ? "All" : STATUS_LABELS[status]}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="border-t border-border p-2">
        <form action={signOutAction}>
          <button
            type="submit"
            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <LogOut className="size-4" />
            Logout
          </button>
        </form>
      </div>
    </aside>
  );
}
