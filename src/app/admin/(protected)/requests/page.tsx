import Link from "next/link";
import { Search, AlertTriangle } from "lucide-react";
import { listRequests, getFilterOptions, type ListRequestsParams } from "@/lib/admin/requests";
import { StatusBadge } from "@/components/admin/status-badge";
import { QuickActions } from "@/components/admin/quick-actions";
import { STATUS_ORDER, STATUS_LABELS, MATERIALS } from "@/lib/constants";
import { formatDate, isPast } from "@/lib/utils";
import { formatEUR } from "@/lib/admin/money";
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

const SORT_OPTIONS: { value: NonNullable<ListRequestsParams["sort"]>; label: string }[] = [
  { value: "newest", label: "Newest" },
  { value: "oldest", label: "Oldest" },
  { value: "updated", label: "Last updated" },
  { value: "value_desc", label: "Highest value" },
  { value: "margin_desc", label: "Highest margin" },
  { value: "margin_asc", label: "Lowest margin" },
];

function needsAttention(row: {
  is_suspicious: boolean;
  status: RequestStatus;
  quote_expires_at: string | null;
}): boolean {
  if (row.is_suspicious) return true;
  if (
    (row.status === "quote_ready" || row.status === "quote_sent") &&
    row.quote_expires_at
  ) {
    if (isPast(row.quote_expires_at)) return true;
    if (new Date(row.quote_expires_at).getTime() - Date.now() < 48 * 60 * 60 * 1000) return true;
  }
  return false;
}

export default async function AdminRequestsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const status = (sp.status as RequestStatus | "all" | undefined) ?? "all";
  const search = sp.q ?? "";
  const accountType = (sp.account as ListRequestsParams["accountType"]) ?? "all";
  const suspicious = (sp.suspicious as ListRequestsParams["suspicious"]) ?? "all";
  const material = sp.material ?? "all";
  const country = sp.country ?? "all";
  const hasPrice = (sp.hasPrice as ListRequestsParams["hasPrice"]) ?? "all";
  const quoteExpiry = (sp.quoteExpiry as ListRequestsParams["quoteExpiry"]) ?? "all";
  const sort = (sp.sort as ListRequestsParams["sort"]) ?? "newest";
  const dateFrom = sp.from || undefined;
  const dateTo = sp.to || undefined;
  const page = Math.max(1, Number(sp.page) || 1);

  const [{ rows, total, pageSize }, { countries }] = await Promise.all([
    listRequests({
      status,
      search,
      accountType,
      suspicious,
      material,
      country,
      hasPrice,
      quoteExpiry,
      sort,
      dateFrom,
      dateTo,
      page,
    }),
    getFilterOptions(),
  ]);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const buildHref = (overrides: Record<string, string | undefined>) => {
    const merged: Record<string, string | undefined> = {
      status,
      q: search,
      account: accountType,
      suspicious,
      material,
      country,
      hasPrice,
      quoteExpiry,
      sort,
      from: dateFrom,
      to: dateTo,
      page: String(page),
      ...overrides,
    };
    const next = new URLSearchParams();
    for (const [key, value] of Object.entries(merged)) {
      if (value && value !== "all" && value !== "1") next.set(key, value);
    }
    const qs = next.toString();
    return qs ? `/admin/requests?${qs}` : "/admin/requests";
  };

  return (
    <div className="flex flex-col gap-6 p-6">
      <h1 className="text-xl font-semibold tracking-tight">Requests</h1>

      <form className="flex flex-col gap-3" action="/admin/requests" method="GET">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative w-full max-w-xs">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              name="q"
              defaultValue={search}
              placeholder="Search by #, name, email, phone, filename"
              className="pl-8"
            />
          </div>

          <Select name="status" defaultValue={status}>
            <option value="all">All statuses</option>
            {STATUS_ORDER.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s]}
              </option>
            ))}
          </Select>

          <Select name="account" defaultValue={accountType}>
            <option value="all">Guest + registered</option>
            <option value="guest">Guest only</option>
            <option value="registered">Registered only</option>
          </Select>

          <Select name="suspicious" defaultValue={suspicious}>
            <option value="all">Suspicious + normal</option>
            <option value="suspicious">Suspicious only</option>
            <option value="normal">Normal only</option>
          </Select>

          <Select name="material" defaultValue={material}>
            <option value="all">All materials</option>
            {MATERIALS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </Select>

          <Select name="country" defaultValue={country}>
            <option value="all">All countries</option>
            {countries.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>

          <Select name="hasPrice" defaultValue={hasPrice}>
            <option value="all">Price: any</option>
            <option value="yes">Has price</option>
            <option value="no">Missing price</option>
          </Select>

          <Select name="quoteExpiry" defaultValue={quoteExpiry}>
            <option value="all">Quote expiry: any</option>
            <option value="expiring_soon">Expiring soon (48h)</option>
            <option value="expired">Expired</option>
            <option value="none">No quote yet</option>
          </Select>

          <Select name="sort" defaultValue={sort}>
            {SORT_OPTIONS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </Select>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            From
            <input
              type="date"
              name="from"
              defaultValue={dateFrom?.slice(0, 10)}
              className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            />
          </label>
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            To
            <input
              type="date"
              name="to"
              defaultValue={dateTo?.slice(0, 10)}
              className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            />
          </label>

          <button
            type="submit"
            className="inline-flex h-8 items-center justify-center rounded-lg border border-input px-3 text-sm font-medium transition-colors hover:bg-surface-elevated"
          >
            Apply
          </button>
          <Link
            href="/admin/requests"
            className="text-sm text-muted-foreground underline decoration-dotted hover:text-foreground"
          >
            Clear filters
          </Link>
        </div>
      </form>

      <div className="overflow-x-auto rounded-xl border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead />
              <TableHead>Reference</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Model</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Account</TableHead>
              <TableHead>Created</TableHead>
              <TableHead>Updated</TableHead>
              <TableHead>Total</TableHead>
              <TableHead>Margin</TableHead>
              <TableHead>Quick actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={11} className="py-12 text-center text-muted-foreground">
                  {status !== "all" || search
                    ? "No requests match this search or filter."
                    : "No requests yet. When customers submit manufacturing requests, they will appear here."}
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>
                    {needsAttention(row) && (
                      <AlertTriangle className="size-3.5 text-warning" aria-label="Needs attention" />
                    )}
                  </TableCell>
                  <TableCell className="font-medium">
                    <Link href={`/admin/requests/${row.id}`} className="block">
                      #{row.reference_number}
                    </Link>
                  </TableCell>
                  <TableCell className="max-w-36 truncate">{row.customer_name}</TableCell>
                  <TableCell className="max-w-36 truncate text-muted-foreground">
                    {row.model?.filename ?? "—"}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={row.status} />
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {row.is_registered ? "Registered" : "Guest"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{formatDate(row.created_at)}</TableCell>
                  <TableCell className="text-muted-foreground">{formatDate(row.updated_at)}</TableCell>
                  <TableCell>{row.customer_total !== null ? formatEUR(row.customer_total) : "—"}</TableCell>
                  <TableCell>{row.margin !== null ? formatEUR(row.margin) : "—"}</TableCell>
                  <TableCell>
                    <QuickActions
                      requestId={row.id}
                      status={row.status}
                      hasCustomerPrice={row.customer_total !== null}
                      quoteToken={row.quote_token}
                    />
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

function Select({
  name,
  defaultValue,
  children,
}: {
  name: string;
  defaultValue?: string;
  children: React.ReactNode;
}) {
  return (
    <select
      name={name}
      defaultValue={defaultValue}
      className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      {children}
    </select>
  );
}
