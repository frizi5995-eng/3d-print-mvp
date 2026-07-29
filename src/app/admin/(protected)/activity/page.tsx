import Link from "next/link";
import {
  listActivityLog,
  adminEmailAllowlist,
  ACTIVITY_ACTIONS,
  ACTIVITY_ACTION_LABELS,
  type ListActivityParams,
} from "@/lib/admin/activity";
import { formatDateTime } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

function describeMetadata(action: string, metadata: Record<string, unknown> | null): string {
  if (!metadata) return "—";
  if (action === "status_changed" && metadata.from && metadata.to) {
    return `${metadata.from} → ${metadata.to}`;
  }
  if (action === "tags_updated" && Array.isArray(metadata.tags)) {
    return metadata.tags.length ? metadata.tags.join(", ") : "cleared";
  }
  if (action === "flagged_suspicious") {
    const flagged = metadata.isSuspicious ? "flagged" : "cleared";
    const reason = typeof metadata.reason === "string" && metadata.reason ? ` (${metadata.reason})` : "";
    return `${flagged}${reason}`;
  }
  if (action === "quote_expiry_extended" && metadata.new_expiry) {
    return `new expiry: ${String(metadata.new_expiry)}`;
  }
  if (action === "settings_updated" && Array.isArray(metadata.changedFields)) {
    return metadata.changedFields.join(", ");
  }
  return "—";
}

export default async function AdminActivityPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const adminEmail = sp.admin ?? "all";
  const action = sp.action ?? "all";
  const dateFrom = sp.from || undefined;
  const dateTo = sp.to || undefined;
  const page = Math.max(1, Number(sp.page) || 1);

  const params: ListActivityParams = { adminEmail, action, dateFrom, dateTo, page };
  const { rows, total, pageSize } = await listActivityLog(params);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const admins = adminEmailAllowlist();

  const buildHref = (overrides: Record<string, string | undefined>) => {
    const merged: Record<string, string | undefined> = {
      admin: adminEmail,
      action,
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
    return qs ? `/admin/activity?${qs}` : "/admin/activity";
  };

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Activity log</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Operational audit trail of admin actions on requests. Not user surveillance.
        </p>
      </div>

      <form className="flex flex-wrap items-center gap-3" action="/admin/activity" method="GET">
        <Select name="admin" defaultValue={adminEmail}>
          <option value="all">All admins</option>
          {admins.map((email) => (
            <option key={email} value={email}>
              {email}
            </option>
          ))}
        </Select>

        <Select name="action" defaultValue={action}>
          <option value="all">All actions</option>
          {ACTIVITY_ACTIONS.map((a) => (
            <option key={a} value={a}>
              {ACTIVITY_ACTION_LABELS[a]}
            </option>
          ))}
        </Select>

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
          href="/admin/activity"
          className="text-sm text-muted-foreground underline decoration-dotted hover:text-foreground"
        >
          Clear filters
        </Link>
      </form>

      <div className="overflow-x-auto rounded-xl border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>When</TableHead>
              <TableHead>Admin</TableHead>
              <TableHead>Action</TableHead>
              <TableHead>Request</TableHead>
              <TableHead>Details</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-12 text-center text-muted-foreground">
                  No activity recorded yet.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="text-muted-foreground">{formatDateTime(row.created_at)}</TableCell>
                  <TableCell>{row.admin_email}</TableCell>
                  <TableCell>
                    {ACTIVITY_ACTION_LABELS[row.action as keyof typeof ACTIVITY_ACTION_LABELS] ?? row.action}
                  </TableCell>
                  <TableCell>
                    {row.request_id && row.request_reference_number !== null ? (
                      <Link href={`/admin/requests/${row.request_id}`} className="text-primary hover:underline">
                        #{row.request_reference_number}
                      </Link>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell className="max-w-72 truncate text-muted-foreground">
                    {describeMetadata(row.action, row.metadata)}
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
            Page {page} of {totalPages} · {total} entries
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
