import Link from "next/link";
import { Container } from "@/components/layout/container";
import { StatusBadge } from "@/components/admin/status-badge";
import { formatDate, isPast, cn } from "@/lib/utils";
import { formatEUR } from "@/lib/admin/money";
import { requireCustomerUser } from "@/lib/auth/customer";
import {
  listMyRequests,
  ACCOUNT_STATUS_FILTERS,
  ACCOUNT_STATUS_FILTER_LABELS,
} from "@/lib/customer/requests";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default async function MyRequestsPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const user = await requireCustomerUser();
  const params = await searchParams;
  const filter = params.filter && params.filter in ACCOUNT_STATUS_FILTERS ? params.filter : "all";

  const { rows } = await listMyRequests({ userId: user.id, filter });

  return (
    <Container className="flex flex-col gap-6 py-10 sm:py-14">
      <h1 className="text-2xl font-semibold tracking-tight">My requests</h1>

      <nav className="flex flex-wrap gap-2">
        {Object.keys(ACCOUNT_STATUS_FILTERS).map((key) => (
          <Link
            key={key}
            href={key === "all" ? "/account/requests" : `/account/requests?filter=${key}`}
            className={cn(
              "rounded-lg border px-3 py-1.5 text-sm transition-colors",
              filter === key
                ? "border-primary bg-primary/10 text-foreground"
                : "border-input text-muted-foreground hover:bg-surface-elevated"
            )}
          >
            {ACCOUNT_STATUS_FILTER_LABELS[key]}
          </Link>
        ))}
      </nav>

      <div className="overflow-x-auto rounded-xl border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Request</TableHead>
              <TableHead>Model</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Total</TableHead>
              <TableHead>Updated</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-12 text-center text-muted-foreground">
                  No requests here yet.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => {
                const total =
                  row.customer_manufacturing_price !== null && row.customer_shipping_price !== null
                    ? row.customer_manufacturing_price + row.customer_shipping_price
                    : null;
                const canViewQuote =
                  row.quote_token &&
                  (row.status === "quote_ready" || row.status === "quote_sent") &&
                  row.quote_expires_at &&
                  !isPast(row.quote_expires_at);

                return (
                  <TableRow key={row.id}>
                    <TableCell className="font-medium">
                      <Link href={`/account/requests/${row.id}`} className="block">
                        #{row.reference_number}
                      </Link>
                    </TableCell>
                    <TableCell className="max-w-40 truncate text-muted-foreground">
                      {row.model?.filename ?? "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(row.created_at)}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={row.status} />
                    </TableCell>
                    <TableCell>{total !== null ? formatEUR(total) : "—"}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(row.updated_at)}
                    </TableCell>
                    <TableCell>
                      {canViewQuote && (
                        <Link href={`/q/${row.quote_token}`} className="text-primary hover:underline">
                          View quote
                        </Link>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </Container>
  );
}
