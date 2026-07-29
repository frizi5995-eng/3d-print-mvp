import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { Container } from "@/components/layout/container";
import { ModelViewer } from "@/components/model-viewer/model-viewer";
import { StatusBadge } from "@/components/admin/status-badge";
import { HistoryList } from "@/components/admin/history-list";
import { Button } from "@/components/ui/button";
import { requireCustomerUser } from "@/lib/auth/customer";
import { getMyRequestById } from "@/lib/customer/requests";
import { createServiceClient } from "@/lib/supabase/server";
import { MODEL_STORAGE_BUCKET } from "@/lib/models";
import { formatDateTime, isPast } from "@/lib/utils";
import { formatEUR } from "@/lib/admin/money";
import type { ManufacturingRequest, Model, ModelFileType, StatusHistoryEntry } from "@/types";

export default async function MyRequestDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireCustomerUser();
  const { id } = await params;

  const result = await getMyRequestById(user.id, id);
  if (!result || !result.model) notFound();

  const request = result.request as unknown as ManufacturingRequest;
  const model = result.model as unknown as Model;
  const history = result.history as unknown as StatusHistoryEntry[];

  const supabase = createServiceClient();
  const { data: signed } = await supabase.storage
    .from(MODEL_STORAGE_BUCKET)
    .createSignedUrl(model.storage_path, 3600);

  const total =
    request.customer_manufacturing_price !== null && request.customer_shipping_price !== null
      ? request.customer_manufacturing_price + request.customer_shipping_price
      : null;

  const canViewQuote =
    request.quote_token &&
    (request.status === "quote_ready" || request.status === "quote_sent") &&
    request.quote_expires_at &&
    !isPast(request.quote_expires_at);

  return (
    <Container className="flex flex-col gap-6 py-10 sm:py-14">
      <div className="flex flex-col gap-3">
        <Link
          href="/account/requests"
          className="flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="size-4" />
          Back to my requests
        </Link>
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold tracking-tight">
            Request #{request.reference_number}
          </h1>
          <StatusBadge status={request.status} />
        </div>
        <p className="text-sm text-muted-foreground">
          Submitted {formatDateTime(request.created_at)}
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[11fr_9fr] lg:items-start">
        <div className="aspect-square w-full lg:aspect-4/3">
          {signed?.signedUrl ? (
            <ModelViewer url={signed.signedUrl} fileType={model.file_type as ModelFileType} />
          ) : (
            <div className="flex h-full items-center justify-center rounded-2xl border border-border bg-secondary/40 text-sm text-muted-foreground">
              Preview unavailable
            </div>
          )}
        </div>

        <div className="flex flex-col gap-6">
          <section className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
            <h2 className="text-sm font-medium text-muted-foreground">Request</h2>
            <Field label="Material" value={request.material} />
            <Field label="Color" value={request.color} />
            <Field label="Quantity" value={String(request.quantity)} />
            <Field label="Desired size" value={request.desired_size ?? "Original model size"} />
            <Field label="Notes" value={request.notes ?? "—"} />
          </section>

          <section className="flex flex-col gap-3 rounded-xl border border-border bg-surface-elevated p-4">
            <h2 className="text-sm font-medium text-muted-foreground">Pricing</h2>
            <Field
              label="Manufacturing"
              value={
                request.customer_manufacturing_price !== null
                  ? formatEUR(request.customer_manufacturing_price)
                  : "—"
              }
            />
            <Field
              label="Shipping"
              value={
                request.customer_shipping_price !== null
                  ? formatEUR(request.customer_shipping_price)
                  : "—"
              }
            />
            <Field label="Total" value={total !== null ? formatEUR(total) : "—"} strong />
            {canViewQuote && (
              <Button nativeButton={false} render={<Link href={`/q/${request.quote_token}`} />}>
                View quote
              </Button>
            )}
          </section>

          <section className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
            <h2 className="text-sm font-medium text-muted-foreground">History</h2>
            <HistoryList history={history} />
          </section>
        </div>
      </div>
    </Container>
  );
}

function Field({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className={strong ? "truncate text-right text-base font-semibold" : "truncate text-right font-medium"}>
        {value}
      </span>
    </div>
  );
}
