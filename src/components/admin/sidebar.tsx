"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { LogOut, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/layout/logo";
import { STATUS_LABELS } from "@/lib/constants";
import type { SidebarCounts } from "@/lib/admin/requests";
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

const TOP_LINKS = [
  { href: "/admin/dashboard", label: "Dashboard" },
  { href: "/admin/customers", label: "Customers" },
  { href: "/admin/activity", label: "Activity" },
  { href: "/admin/settings", label: "Settings" },
];

export function AdminSidebar({
  signOutAction,
  counts,
}: {
  signOutAction: () => Promise<void>;
  counts: SidebarCounts;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const activeStatus = searchParams.get("status") ?? "all";
  const activeSuspicious = searchParams.get("suspicious") ?? "all";
  const onRequestsPage = pathname.startsWith("/admin/requests");
  const totalCount = Object.values(counts.byStatus).reduce((sum, n) => sum + (n ?? 0), 0);

  return (
    <aside className="flex h-full w-56 shrink-0 flex-col border-r border-border bg-card">
      <div className="flex h-14 items-center border-b border-border px-4">
        <Logo />
      </div>

      <nav className="flex-1 overflow-y-auto px-2 py-4">
        <ul className="flex flex-col gap-0.5">
          {TOP_LINKS.map((link) => {
            const isActive = pathname === link.href || pathname.startsWith(`${link.href}/`);
            return (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className={cn(
                    "flex items-center rounded-md px-2 py-1.5 text-sm transition-colors",
                    isActive
                      ? "bg-accent text-primary font-medium"
                      : "text-muted-foreground hover:bg-accent hover:text-foreground"
                  )}
                >
                  {link.label}
                </Link>
              </li>
            );
          })}
        </ul>

        <p className="px-2 pt-4 pb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
          Requests
        </p>
        <ul className="flex flex-col gap-0.5">
          {SIDEBAR_STATUSES.map((status) => {
            const isActive = onRequestsPage && activeSuspicious === "all" && activeStatus === status;
            const href = status === "all" ? "/admin/requests" : `/admin/requests?status=${status}`;
            const count = status === "all" ? totalCount : (counts.byStatus[status] ?? 0);
            return (
              <li key={status}>
                <Link
                  href={href}
                  className={cn(
                    "flex items-center justify-between rounded-md px-2 py-1.5 text-sm transition-colors",
                    isActive
                      ? "bg-accent text-primary font-medium"
                      : "text-muted-foreground hover:bg-accent hover:text-foreground"
                  )}
                >
                  <span>{status === "all" ? "All" : STATUS_LABELS[status]}</span>
                  <span className="text-xs tabular-nums text-muted-foreground">{count}</span>
                </Link>
              </li>
            );
          })}
        </ul>

        {counts.suspicious > 0 && (
          <>
            <p className="px-2 pt-4 pb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Attention
            </p>
            <ul className="flex flex-col gap-0.5">
              <li>
                <Link
                  href="/admin/requests?suspicious=suspicious"
                  className={cn(
                    "flex items-center justify-between rounded-md px-2 py-1.5 text-sm transition-colors",
                    onRequestsPage && activeSuspicious === "suspicious"
                      ? "bg-accent text-primary font-medium"
                      : "text-warning hover:bg-accent hover:text-foreground"
                  )}
                >
                  <span className="flex items-center gap-1.5">
                    <AlertTriangle className="size-3.5" />
                    Suspicious
                  </span>
                  <span className="text-xs tabular-nums text-muted-foreground">
                    {counts.suspicious}
                  </span>
                </Link>
              </li>
            </ul>
          </>
        )}
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
