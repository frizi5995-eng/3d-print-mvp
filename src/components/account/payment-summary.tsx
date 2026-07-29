import { CheckCircle2, CreditCard } from "lucide-react";
import { formatDateTime } from "@/lib/utils";
import { PAYMENT_STATUS_LABELS } from "@/lib/constants";
import type { PaymentStatus } from "@/types";

/**
 * Presentational only — the caller fetches invoice display data server-side
 * (see src/lib/stripe/invoicing.ts's getInvoiceDisplay) and passes down only
 * what's safe to show a customer: never a Stripe customer/invoice id, secret
 * key, or any other internal payment metadata.
 */
export function PaymentSummary({
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
  if (paymentStatus === "paid") {
    return (
      <div className="flex flex-col gap-2 rounded-lg border border-success/30 bg-success/10 p-3">
        <div className="flex items-center gap-2 text-sm font-medium text-success">
          <CheckCircle2 className="size-4" />
          Payment received
        </div>
        {invoiceNumber && <p className="text-xs text-muted-foreground">Invoice #{invoiceNumber}</p>}
        {paidAt && <p className="text-xs text-muted-foreground">Paid {formatDateTime(paidAt)}</p>}
        {hostedInvoiceUrl && (
          <a href={hostedInvoiceUrl} target="_blank" rel="noreferrer" className="w-fit text-xs text-primary hover:underline">
            View invoice / receipt
          </a>
        )}
      </div>
    );
  }

  if (paymentStatus === "refunded") {
    return (
      <div className="rounded-lg border border-border bg-surface-elevated p-3 text-sm text-muted-foreground">
        {PAYMENT_STATUS_LABELS.refunded} — contact us if you have questions about this order.
      </div>
    );
  }

  // unpaid, invoice_sent, payment_failed — all need the customer to pay or retry.
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border bg-surface-elevated p-3">
      <p className="text-sm font-medium">
        {paymentStatus === "payment_failed" ? "Payment failed — please try again" : "Payment"}
      </p>
      {hostedInvoiceUrl ? (
        <a
          href={hostedInvoiceUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex w-fit items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary-hover"
        >
          <CreditCard className="size-3.5" />
          Pay invoice
        </a>
      ) : (
        <p className="text-xs text-muted-foreground">
          We&apos;re preparing your invoice — you&apos;ll be able to pay here shortly.
        </p>
      )}
    </div>
  );
}
