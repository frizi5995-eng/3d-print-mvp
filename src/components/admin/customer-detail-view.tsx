import Link from "next/link";
import { StatusBadge } from "@/components/admin/status-badge";
import { formatDate, formatDateTime } from "@/lib/utils";
import { formatEUR } from "@/lib/admin/money";
import type { CustomerAccountInfo, CustomerRequestRow } from "@/lib/admin/customers";

export function CustomerDetailView({
  name,
  email,
  isRegistered,
  account,
  requests,
}: {
  name: string;
  email: string;
  isRegistered: boolean;
  account: CustomerAccountInfo | null;
  requests: CustomerRequestRow[];
}) {
  const acceptedValue = requests.reduce((sum, r) => sum + (r.customer_total ?? 0), 0);

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">{name}</h1>
        <p className="text-sm text-muted-foreground">{email}</p>
      </div>

      <section className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
        <h2 className="text-sm font-medium text-muted-foreground">Account</h2>
        <Field label="Type" value={isRegistered ? "Registered" : "Guest"} />
        {account && (
          <>
            <Field label="Account created" value={formatDate(account.createdAt)} />
            <Field
              label="Last sign-in"
              value={account.lastSignInAt ? formatDateTime(account.lastSignInAt) : "—"}
            />
            <Field label="Email confirmed" value={account.emailConfirmed ? "Yes" : "No"} />
          </>
        )}
        {!isRegistered && (
          <p className="text-sm text-muted-foreground">
            This customer hasn&apos;t created an account — grouped by email for convenience only.
          </p>
        )}
      </section>

      <section className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
        <h2 className="text-sm font-medium text-muted-foreground">Summary</h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Field label="Total requests" value={String(requests.length)} />
          <Field
            label="Accepted"
            value={String(requests.filter((r) => r.status === "accepted" || r.status === "manufacturing" || r.status === "shipped" || r.status === "completed").length)}
          />
          <Field label="Completed" value={String(requests.filter((r) => r.status === "completed").length)} />
          <Field label="Accepted value" value={formatEUR(acceptedValue)} />
        </div>
      </section>

      <section className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
        <h2 className="text-sm font-medium text-muted-foreground">Request history</h2>
        {requests.length === 0 ? (
          <p className="text-sm text-muted-foreground">No requests yet.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-border">
            {requests.map((r) => (
              <li key={r.id}>
                <Link
                  href={`/admin/requests/${r.id}`}
                  className="flex items-center justify-between gap-3 py-2.5 text-sm transition-colors hover:text-primary"
                >
                  <span className="truncate">
                    #{r.reference_number} · {r.model_filename ?? "—"} · {formatDate(r.created_at)}
                  </span>
                  <span className="flex shrink-0 items-center gap-3">
                    {r.customer_total !== null && <span>{formatEUR(r.customer_total)}</span>}
                    <StatusBadge status={r.status} />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="truncate text-right font-medium">{value}</span>
    </div>
  );
}
