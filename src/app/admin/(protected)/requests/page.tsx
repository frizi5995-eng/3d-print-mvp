import Link from "next/link";
import { Search } from "lucide-react";
import { listRequests, getRequestStats } from "@/lib/admin/requests";
import { StatusBadge } from "@/components/admin/status-badge";
import { RequestsOverview } from "@/components/admin/requests-overview";
import { STATUS_ORDER, STATUS_LABELS } from "@/lib/constants";
import { formatDate } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { RequestStatus } from "@/types";

export default async function AdminRequestsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string; page?: string }>;
}) {
  const params = await searchParams;
  const status = (params.status as RequestStatus | "all" | undefined) ?? "all";
  const search = params.q ?? "";
  const page = Math.max(1, Number(params.page) || 1);

  const [{ rows, total, pageSize }, stats] = await Promise.all([
    listRequests({ status, search, page }),
    getRequestStats(),
  ]);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const buildHref = (overrides: Record<string, string | undefined>) => {
    const next = new URLSearchParams();
    const merged = { status, q: search, page: String(page), ...overrides };
    if (merged.status && merged.status !== "all") next.set("status", merged.status);
    if (merged.q) next.set("q", merged.q);
    if (merged.page && merged.page !== "1") next.set("page", merged.page);
    const qs = next.toString();
    return qs ? `/admin/requests?${qs}` : "/admin/requests";
  };

  return (
    <div className="flex flex-col gap-6 p-6">
      <h1 className="text-xl font-semibold tracking-tight">Requests</h1>

      <RequestsOverview stats={stats} />

      <form className="flex flex-wrap items-center gap-3" action="/admin/requests" method="GET">
        {status !== "all" && <input type="hidden" name="status" value={status} />}
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            name="q"
            defaultValue={search}
            placeholder="Search by #, name, email, or filename"
            className="pl-8"
          />
        </div>

        <select
          name="status"
          defaultValue={status}
          className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <option value="all">All statuses</option>
          {STATUS_ORDER.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABELS[s]}
            </option>
          ))}
        </select>

        <button
          type="submit"
          className="inline-flex h-8 items-center justify-center rounded-lg border border-input px-3 text-sm font-medium transition-colors hover:bg-surface-elevated"
        >
          Apply
        </button>
      </form>

      <div className="overflow-x-auto rounded-xl border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Request</TableHead>
              <TableHead>Model</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-12 text-center text-muted-foreground">
                  {status !== "all" || search
                    ? "No requests match this search or filter."
                    : "No requests yet. When customers submit manufacturing requests, they will appear here."}
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => (
                <TableRow key={row.id} className="cursor-pointer">
                  <TableCell className="font-medium">
                    <Link href={`/admin/requests/${row.id}`} className="block">
                      #{row.reference_number}
                    </Link>
                  </TableCell>
                  <TableCell className="max-w-48 truncate text-muted-foreground">
                    {row.model?.filename ?? "—"}
                  </TableCell>
                  <TableCell>{row.customer_name}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDate(row.created_at)}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={row.status} />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            Page {page} of {totalPages} · {total} requests
          </span>
          <div className="flex gap-2">
            {page > 1 && (
              <Link
                href={buildHref({ page: String(page - 1) })}
                className="rounded-lg border border-input px-3 py-1.5 hover:bg-surface-elevated"
              >
                Previous
              </Link>
            )}
            {page < totalPages && (
              <Link
                href={buildHref({ page: String(page + 1) })}
                className="rounded-lg border border-input px-3 py-1.5 hover:bg-surface-elevated"
              >
                Next
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
