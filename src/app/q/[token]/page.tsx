import { CheckCircle2, XCircle } from "lucide-react";
import { Container } from "@/components/layout/container";
import { ModelViewer } from "@/components/model-viewer/model-viewer";
import { QuoteActions } from "@/components/quote-public/quote-actions";
import { PaymentSummary } from "@/components/account/payment-summary";
import { createServiceClient } from "@/lib/supabase/server";
import { MODEL_STORAGE_BUCKET } from "@/lib/models";
import { getInvoiceDisplay } from "@/lib/stripe/invoicing";
import { formatEUR } from "@/lib/admin/money";
import { isPast } from "@/lib/utils";
import type { ModelFileType, PaymentStatus } from "@/types";

const VIEWABLE_STATUSES = ["quote_ready", "quote_sent"];
const PREVIEW_URL_TTL_SECONDS = 600;

export default async function PublicQuotePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const supabase = createServiceClient();
  const { data: request } = await supabase
    .from("manufacturing_requests")
    .select(
      "status, quantity, material, color, desired_size, customer_manufacturing_price, customer_shipping_price, quote_expires_at, payment_status, stripe_invoice_id, paid_at, models(filename, storage_path, file_type)"
    )
    .eq("quote_token", token)
    .maybeSingle();

  if (!request) return <NotAvailable />;

  if (request.status === "accepted") {
    const invoice = request.stripe_invoice_id ? await getInvoiceDisplay(request.stripe_invoice_id) : null;
    return (
      <AcceptedState
        paymentStatus={request.payment_status}
        invoiceNumber={invoice?.number}
        hostedInvoiceUrl={invoice?.hostedInvoiceUrl}
        paidAt={request.paid_at}
      />
    );
  }
  if (request.status === "declined") return <DeclinedState />;

  if (!VIEWABLE_STATUSES.includes(request.status) || !request.quote_expires_at) {
    return <NotAvailable />;
  }

  if (isPast(request.quote_expires_at)) {
    return <Expired />;
  }

  const model = Array.isArray(request.models) ? request.models[0] : request.models;
  if (!model) return <NotAvailable />;

  const { data: signed } = await supabase.storage
    .from(MODEL_STORAGE_BUCKET)
    .createSignedUrl(model.storage_path, PREVIEW_URL_TTL_SECONDS);

  const manufacturingPrice = request.customer_manufacturing_price ?? 0;
  const shippingPrice = request.customer_shipping_price ?? 0;
  const total = manufacturingPrice + shippingPrice;

  return (
    <Container className="py-8 sm:py-10">
      <div className="grid gap-10 lg:grid-cols-[11fr_9fr] lg:items-start">
        <div className="lg:sticky lg:top-24">
          <div className="aspect-square w-full lg:aspect-4/3">
            {signed?.signedUrl ? (
              <ModelViewer url={signed.signedUrl} fileType={model.file_type as ModelFileType} />
            ) : (
              <div className="flex h-full items-center justify-center rounded-2xl border border-border bg-secondary/40 text-sm text-muted-foreground">
                Preview unavailable
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-6">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Your manufacturing quote</h1>
            <p className="mt-1 text-muted-foreground">
              Review the details below, then accept or decline.
            </p>
          </div>

          <div className="flex flex-col gap-2 rounded-xl border border-border bg-card p-4 text-sm">
            <Row label="Model" value={model.filename} />
            <Row label="Material" value={request.material} />
            <Row label="Color" value={request.color} />
            <Row label="Quantity" value={String(request.quantity)} />
            <Row label="Desired size" value={request.desired_size ?? "Original model size"} />
          </div>

          <div className="flex flex-col gap-2 rounded-xl border border-border bg-surface-elevated p-4 text-sm">
            <Row label="Manufacturing" value={formatEUR(manufacturingPrice)} />
            <Row label="Delivery" value={formatEUR(shippingPrice)} />
            <div className="my-1 h-px bg-border" />
            <div className="flex items-center justify-between">
              <span className="font-medium">Total</span>
              <span className="text-xl font-semibold text-primary">{formatEUR(total)}</span>
            </div>
          </div>

          <QuoteActions token={token} />
        </div>
      </div>
    </Container>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className="truncate font-medium">{value}</span>
    </div>
  );
}

function DeclinedState() {
  return (
    <Container className="flex flex-col items-center gap-4 py-24 text-center">
      <div className="flex size-14 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <XCircle className="size-7" />
      </div>
      <h1 className="text-2xl font-semibold tracking-tight">Quote declined</h1>
      <p className="max-w-md text-muted-foreground">Thanks for letting us know.</p>
    </Container>
  );
}

function AcceptedState({
  paymentStatus,
  invoiceNumber,
  hostedInvoiceUrl,
  paidAt,
}: {
  paymentStatus: PaymentStatus;
  invoiceNumber?: string | null;
  hostedInvoiceUrl?: string | null;
  paidAt?: string | null;
}) {
  return (
    <Container className="flex flex-col items-center gap-4 py-24 text-center">
      <div className="flex size-14 items-center justify-center rounded-full bg-success/15 text-success">
        <CheckCircle2 className="size-7" />
      </div>
      <h1 className="text-2xl font-semibold tracking-tight">Quote accepted</h1>
      <p className="max-w-md text-muted-foreground">
        {paymentStatus === "paid"
          ? "We've received your payment and will begin manufacturing shortly."
          : "We've received your confirmation. Next, pay the invoice below so we can start manufacturing."}
      </p>
      <div className="w-full max-w-sm text-left">
        <PaymentSummary
          paymentStatus={paymentStatus}
          invoiceNumber={invoiceNumber}
          hostedInvoiceUrl={hostedInvoiceUrl}
          paidAt={paidAt}
        />
      </div>
    </Container>
  );
}

function Expired() {
  return (
    <Container className="flex flex-col items-center gap-4 py-24 text-center">
      <h1 className="text-2xl font-semibold tracking-tight">This quote has expired</h1>
      <p className="max-w-md text-muted-foreground">
        Please get in touch with us if you&apos;d still like to move forward.
      </p>
    </Container>
  );
}

function NotAvailable() {
  return (
    <Container className="flex flex-col items-center gap-4 py-24 text-center">
      <h1 className="text-2xl font-semibold tracking-tight">Quote not available</h1>
      <p className="max-w-md text-muted-foreground">
        This link is invalid or no longer active.
      </p>
    </Container>
  );
}
