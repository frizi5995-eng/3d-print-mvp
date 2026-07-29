import Link from "next/link";
import { listCustomers } from "@/lib/admin/customers";
import { formatDate } from "@/lib/utils";
import { formatEUR } from "@/lib/admin/money";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default async function AdminCustomersPage() {
  const customers = await listCustomers();

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Customers</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Registered customers are grouped by account. Guest requests are grouped by email for
          operational convenience only — this is not verified identity.
        </p>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name / Email</TableHead>
              <TableHead>Account</TableHead>
              <TableHead>Total requests</TableHead>
              <TableHead>Accepted</TableHead>
              <TableHead>Completed</TableHead>
              <TableHead>Open</TableHead>
              <TableHead>Accepted value</TableHead>
              <TableHead>Last request</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {customers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="py-12 text-center text-muted-foreground">
                  No customers yet.
                </TableCell>
              </TableRow>
            ) : (
              customers.map((c) => (
                <TableRow key={c.key}>
                  <TableCell className="max-w-56">
                    <Link
                      href={`/admin/customers/${c.isRegistered ? "u/" + c.userId : "e/" + encodeURIComponent(c.email)}`}
                      className="block"
                    >
                      <span className="block truncate font-medium">{c.name}</span>
                      <span className="block truncate text-xs text-muted-foreground">{c.email}</span>
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {c.isRegistered ? "Registered" : "Guest"}
                  </TableCell>
                  <TableCell>{c.totalRequests}</TableCell>
                  <TableCell>{c.acceptedRequests}</TableCell>
                  <TableCell>{c.completedRequests}</TableCell>
                  <TableCell>{c.openRequests}</TableCell>
                  <TableCell>{formatEUR(c.totalAcceptedValue)}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDate(c.lastRequestAt)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
