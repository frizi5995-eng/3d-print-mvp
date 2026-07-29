import Link from "next/link";
import { listSuppliers } from "@/lib/admin/suppliers";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default async function AdminSuppliersPage() {
  const suppliers = await listSuppliers();

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Suppliers</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manufacturing partners across Europe. Disabled suppliers keep their quote history.
          </p>
        </div>
        <Link
          href="/admin/suppliers/new"
          className="inline-flex h-8 items-center justify-center rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary-hover"
        >
          New supplier
        </Link>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Country</TableHead>
              <TableHead>Technologies</TableHead>
              <TableHead>API</TableHead>
              <TableHead>Reliability</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {suppliers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-12 text-center text-muted-foreground">
                  No suppliers yet.
                </TableCell>
              </TableRow>
            ) : (
              suppliers.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">
                    <Link href={`/admin/suppliers/${s.id}`} className="block">
                      {s.preferred && <span className="mr-1.5 text-primary">★</span>}
                      {s.name}
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{s.country}</TableCell>
                  <TableCell className="max-w-56 truncate text-muted-foreground">
                    {s.technologies.length ? s.technologies.join(", ") : "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {s.api_enabled ? (s.api_provider ?? "enabled") : "manual"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {s.reliability_score !== null ? s.reliability_score.toFixed(1) : "—"}
                  </TableCell>
                  <TableCell>
                    {s.active ? (
                      <span className="rounded-full bg-success/10 px-2.5 py-1 text-xs font-medium text-success">
                        Active
                      </span>
                    ) : (
                      <span className="rounded-full bg-secondary px-2.5 py-1 text-xs font-medium text-muted-foreground">
                        Disabled
                      </span>
                    )}
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
