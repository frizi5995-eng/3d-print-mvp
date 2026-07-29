import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, Download, Mail, Phone } from "lucide-react";
import { getRequestById, getCustomerRequestCounts } from "@/lib/admin/requests";
import { getSettings } from "@/lib/admin/settings";
import { createServiceClient } from "@/lib/supabase/server";
import { MODEL_STORAGE_BUCKET } from "@/lib/models";
import { ModelViewer } from "@/components/model-viewer/model-viewer";
import { StatusBadge } from "@/components/admin/status-badge";
import { PricingPanel } from "@/components/admin/pricing-panel";
import { StatusActions } from "@/components/admin/status-actions";
import { HistoryList } from "@/components/admin/history-list";
import { CopyQuoteLink } from "@/components/admin/copy-quote-link";
import { QuoteControls } from "@/components/admin/quote-controls";
import { InternalNotes } from "@/components/admin/internal-notes";
import { TagsEditor } from "@/components/admin/tags-editor";
import { SuspiciousToggle } from "@/components/admin/suspicious-toggle";
import { formatDate } from "@/lib/utils";
import { STATUS_LABELS } from "@/lib/constants";
import { getAppUrl } from "@/lib/env";
import type { ManufacturingRequest, Model, ModelFileType, StatusHistoryEntry } from "@/types";

export default async function AdminRequestDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const result = await getRequestById(id);
  if (!result || !result.model) notFound();

  const request = result.request as unknown as ManufacturingRequest;
  const model = result.model as unknown as Model;
  const history = result.history as unknown as StatusHistoryEntry[];

  const supabase = createServiceClient();
  const [{ data: previewSigned }, { data: downloadSigned }, customerCounts, settings] = await Promise.all([
    supabase.storage.from(MODEL_STORAGE_BUCKET).createSignedUrl(model.storage_path, 3600),
    supabase.storage
      .from(MODEL_STORAGE_BUCKET)
      .createSignedUrl(model.storage_path, 300, { download: model.filename }),
    getCustomerRequestCounts(request.customer_user_id, request.customer_email),
    getSettings(),
  ]);

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex flex-col gap-3">
        <Link
          href="/admin/requests"
          className="flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="size-4" />
          Back to requests
        </Link>
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold tracking-tight">
            Request #{request.reference_number}
          </h1>
          <StatusBadge status={request.status} />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-6">
          <Panel title="Customer">
            <Field label="Name" value={request.customer_name} />
            <Field
              label="Email"
              value={
                <a href={`mailto:${request.customer_email}`} className="flex items-center gap-1.5 text-primary hover:underline">
                  <Mail className="size-3.5" />
                  {request.customer_email}
                </a>
              }
            />
            <Field
              label="Phone"
              value={
                request.customer_phone ? (
                  <a href={`tel:${request.customer_phone}`} className="flex items-center gap-1.5 text-primary hover:underline">
                    <Phone className="size-3.5" />
                    {request.customer_phone}
                  </a>
                ) : (
                  "—"
                )
              }
            />
            <Field label="Country" value={request.country} />
            <Field label="Postal code" value={request.postal_code} />
            <Field label="Account" value={request.customer_user_id ? "Registered" : "Guest"} />
            <Field label="Requests from this customer" value={String(customerCounts.total)} />
            <Field label="Accepted from this customer" value={String(customerCounts.accepted)} />
            <Link
              href={`/admin/customers/${request.customer_user_id ? "u/" + request.customer_user_id : "e/" + encodeURIComponent(request.customer_email)}`}
              className="text-sm text-primary hover:underline"
            >
              View customer
            </Link>
          </Panel>

          <Panel title="Model">
            <div className="aspect-square w-full">
              {previewSigned?.signedUrl ? (
                <ModelViewer
                  url={previewSigned.signedUrl}
                  fileType={model.file_type as ModelFileType}
                />
              ) : (
                <div className="flex h-full items-center justify-center rounded-2xl border border-border bg-secondary/40 text-sm text-muted-foreground">
                  Preview unavailable
                </div>
              )}
            </div>
            <Field label="Filename" value={model.filename} />
            <Field label="File size" value={`${(model.file_size / (1024 * 1024)).toFixed(2)} MB`} />
            <Field label="Uploaded" value={formatDate(model.created_at)} />
            {downloadSigned?.signedUrl ? (
              <a
                href={downloadSigned.signedUrl}
                className="mt-2 inline-flex h-8 w-fit items-center gap-1.5 rounded-lg border border-input px-3 text-sm font-medium transition-colors hover:bg-surface-elevated"
              >
                <Download className="size-3.5" />
                Download original model
              </a>
            ) : (
              <p className="text-sm text-muted-foreground">Download unavailable</p>
            )}
          </Panel>
        </div>

        <div className="flex flex-col gap-6">
          <Panel title="Request details">
            <Field label="Quantity" value={String(request.quantity)} />
            <Field label="Material" value={request.material} />
            <Field label="Color" value={request.color} />
            <Field label="Desired size" value={request.desired_size ?? "Use original model size"} />
            <Field label="Notes" value={request.notes ?? "—"} />
          </Panel>

          <Panel title="Actions">
            <StatusActions
              requestId={request.id}
              status={request.status}
              hasCustomerPrice={
                request.customer_manufacturing_price !== null &&
                request.customer_shipping_price !== null
              }
            />
            {["quote_ready", "quote_sent", "declined"].includes(request.status) && (
              <p className="text-sm text-muted-foreground">
                No actions available for requests in {STATUS_LABELS[request.status].toLowerCase()}.
              </p>
            )}
          </Panel>

          {request.quote_token && (
            <Panel title="Customer quote link">
              <CopyQuoteLink url={`${getAppUrl()}/q/${request.quote_token}`} />
              {request.quote_expires_at && (
                <Field label="Expires" value={formatDate(request.quote_expires_at)} />
              )}
              <QuoteControls requestId={request.id} status={request.status} />
            </Panel>
          )}

          <Panel title="History">
            <HistoryList history={history} />
          </Panel>
        </div>

        <div className="flex flex-col gap-6">
          <Panel title="Production & customer quote">
            <PricingPanel
              requestId={request.id}
              minMarginWarningPercent={settings.minMarginWarningPercent}
              initial={{
                manufacturerName: request.manufacturer_name,
                productionCost: request.production_cost,
                productionShippingCost: request.production_shipping_cost,
                otherCost: request.other_cost,
                customerManufacturingPrice: request.customer_manufacturing_price,
                customerShippingPrice: request.customer_shipping_price,
              }}
            />
          </Panel>

          <Panel title="Internal operations">
            <div className="flex flex-col gap-4">
              <div>
                <p className="mb-2 text-xs font-medium text-muted-foreground">Tags</p>
                <TagsEditor requestId={request.id} initialTags={request.tags} />
              </div>
              <div>
                <p className="mb-2 text-xs font-medium text-muted-foreground">Notes</p>
                <InternalNotes requestId={request.id} initialNotes={request.internal_notes ?? ""} />
              </div>
              <div>
                <p className="mb-2 text-xs font-medium text-muted-foreground">Spam review</p>
                <SuspiciousToggle
                  requestId={request.id}
                  isSuspicious={request.is_suspicious}
                  spamReason={request.spam_reason}
                />
              </div>
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
      <h2 className="text-sm font-medium text-muted-foreground">{title}</h2>
      <div className="flex flex-col gap-3">{children}</div>
    </section>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="truncate text-right font-medium">{value}</span>
    </div>
  );
}
