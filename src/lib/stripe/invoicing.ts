import "server-only";
import { createServiceClient } from "@/lib/supabase/server";
import { getStripeClient } from "@/lib/stripe/client";
import type { RequestStatus } from "@/types";

// A request only becomes invoice-eligible once its quote was accepted, but
// may have moved further along the operational workflow by the time an
// admin retries invoice creation (e.g. after a manual status correction) —
// any status downstream of "accepted" still counts.
const INVOICE_ELIGIBLE_STATUSES: RequestStatus[] = [
  "accepted",
  "manufacturing",
  "shipped",
  "completed",
];

const INVOICE_DAYS_UNTIL_DUE = 14;

export type CreateInvoiceResult =
  | { created: true; invoiceId: string }
  | {
      created: false;
      reason: "not_configured" | "already_exists" | "not_eligible" | "error";
      message?: string;
    };

function toCents(euros: number): number {
  return Math.round(euros * 100);
}

/**
 * Creates a Stripe Customer for this request if one doesn't already exist.
 * Deliberately does NOT set a structured Stripe `address` — this app's
 * `country` field is free text typed by the customer (see quote-form.tsx),
 * not a validated ISO-3166 code, and Stripe's address.country requires a
 * 2-letter code. Sending unvalidated text there would risk a Stripe API
 * error on every invoice creation, so billing address collection is left to
 * Stripe's own hosted invoice page if/when that's needed.
 */
async function getOrCreateStripeCustomer(
  stripe: NonNullable<Awaited<ReturnType<typeof getStripeClient>>>,
  request: { id: string; customer_name: string; customer_email: string; stripe_customer_id: string | null }
): Promise<string> {
  if (request.stripe_customer_id) return request.stripe_customer_id;

  const customer = await stripe.customers.create({
    name: request.customer_name,
    email: request.customer_email,
    metadata: { fabrik_request_id: request.id },
  });

  // Best-effort save so a near-simultaneous second call for the SAME
  // request reuses this customer instead of creating a second one. The real
  // duplicate-invoice guard is the guarded UPDATE in
  // createInvoiceForRequest() below, not this write.
  const supabase = createServiceClient();
  await supabase
    .from("manufacturing_requests")
    .update({ stripe_customer_id: customer.id })
    .eq("id", request.id)
    .is("stripe_customer_id", null);

  return customer.id;
}

/**
 * Creates, finalizes, and sends a Stripe invoice for an accepted request's
 * manufacturing + delivery total. Idempotent: if this request already has a
 * stripe_invoice_id, returns { created: false, reason: "already_exists" }
 * without calling Stripe again — safe to call on every "accept" and to
 * retry from the admin panel.
 *
 * Prices are read exclusively from the manufacturing_requests row fetched
 * here, server-side — this function takes no amount parameter at all, so
 * there is no code path by which a caller (browser or otherwise) could
 * supply a different total.
 */
export async function createInvoiceForRequest(requestId: string): Promise<CreateInvoiceResult> {
  const stripe = await getStripeClient();
  if (!stripe) return { created: false, reason: "not_configured" };

  const supabase = createServiceClient();
  const { data: request } = await supabase
    .from("manufacturing_requests")
    .select(
      "id, status, stripe_customer_id, stripe_invoice_id, customer_name, customer_email, customer_manufacturing_price, customer_shipping_price"
    )
    .eq("id", requestId)
    .maybeSingle();

  if (!request) return { created: false, reason: "not_eligible", message: "Request not found." };
  if (!INVOICE_ELIGIBLE_STATUSES.includes(request.status as RequestStatus)) {
    return { created: false, reason: "not_eligible", message: "This request's quote was never accepted." };
  }
  if (request.stripe_invoice_id) {
    return { created: false, reason: "already_exists" };
  }
  if (request.customer_manufacturing_price === null || request.customer_shipping_price === null) {
    return { created: false, reason: "not_eligible", message: "Pricing is missing." };
  }

  try {
    const customerId = await getOrCreateStripeCustomer(stripe, {
      id: request.id,
      customer_name: request.customer_name,
      customer_email: request.customer_email,
      stripe_customer_id: request.stripe_customer_id,
    });

    const invoice = await stripe.invoices.create({
      customer: customerId,
      collection_method: "send_invoice",
      days_until_due: INVOICE_DAYS_UNTIL_DUE,
      currency: "eur",
      auto_advance: false,
      metadata: { fabrik_request_id: request.id },
    });

    await stripe.invoiceItems.create({
      customer: customerId,
      invoice: invoice.id,
      amount: toCents(request.customer_manufacturing_price),
      currency: "eur",
      description: "Manufacturing",
    });
    await stripe.invoiceItems.create({
      customer: customerId,
      invoice: invoice.id,
      amount: toCents(request.customer_shipping_price),
      currency: "eur",
      description: "Delivery",
    });

    const finalized = await stripe.invoices.finalizeInvoice(invoice.id!);

    const expectedTotalCents =
      toCents(request.customer_manufacturing_price) + toCents(request.customer_shipping_price);
    if (finalized.amount_due !== expectedTotalCents) {
      // Should be unreachable (no tax/discounts are configured on these
      // invoices), but this is a hard requirement — never send an invoice
      // whose total doesn't exactly match the accepted quote.
      await stripe.invoices.voidInvoice(finalized.id!).catch(() => {});
      console.error(
        `Invoice total mismatch for request ${requestId}: expected ${expectedTotalCents}, got ${finalized.amount_due}`
      );
      return { created: false, reason: "error", message: "Invoice total did not match the accepted quote." };
    }

    await stripe.invoices.sendInvoice(finalized.id!);

    // Guarded on stripe_invoice_id still being null: if two calls raced
    // (e.g. the customer's accept and an admin's manual retry landed at the
    // same moment), only the first write here wins; the loser voids the
    // Stripe invoice it just created instead of leaving a duplicate live.
    const { data: updated } = await supabase
      .from("manufacturing_requests")
      .update({
        stripe_customer_id: customerId,
        stripe_invoice_id: finalized.id,
        payment_status: "invoice_sent",
      })
      .eq("id", requestId)
      .is("stripe_invoice_id", null)
      .select("id")
      .maybeSingle();

    if (!updated) {
      await stripe.invoices.voidInvoice(finalized.id!).catch(() => {});
      return { created: false, reason: "already_exists" };
    }

    return { created: true, invoiceId: finalized.id! };
  } catch (err) {
    console.error(`Stripe invoice creation failed for request ${requestId}:`, err);
    return {
      created: false,
      reason: "error",
      message: err instanceof Error ? err.message : "Unknown Stripe error.",
    };
  }
}

export interface InvoiceDisplay {
  status: string;
  number: string | null;
  hostedInvoiceUrl: string | null;
  invoicePdfUrl: string | null;
  amountDue: number;
  amountPaid: number;
  currency: string;
}

/**
 * Live read from Stripe for display purposes only — never the source of
 * truth for payment_status (the webhook is). Returns null on any failure
 * (not configured, invoice deleted, network error) so a page embedding this
 * degrades to showing just the locally stored payment_status instead of
 * crashing.
 */
export async function getInvoiceDisplay(stripeInvoiceId: string): Promise<InvoiceDisplay | null> {
  const stripe = await getStripeClient();
  if (!stripe) return null;

  try {
    const invoice = await stripe.invoices.retrieve(stripeInvoiceId);
    return {
      status: invoice.status ?? "unknown",
      number: invoice.number,
      hostedInvoiceUrl: invoice.hosted_invoice_url ?? null,
      invoicePdfUrl: invoice.invoice_pdf ?? null,
      amountDue: invoice.amount_due / 100,
      amountPaid: invoice.amount_paid / 100,
      currency: invoice.currency,
    };
  } catch (err) {
    console.error(`Failed to fetch Stripe invoice ${stripeInvoiceId}:`, err);
    return null;
  }
}

export type ResendInvoiceResult =
  | { sent: true }
  | { sent: false; reason: "not_configured" | "not_eligible" | "error"; message?: string };

/** Re-sends the invoice email. Only valid while the invoice is still open (finalized, unpaid). */
export async function resendInvoiceEmail(stripeInvoiceId: string): Promise<ResendInvoiceResult> {
  const stripe = await getStripeClient();
  if (!stripe) return { sent: false, reason: "not_configured" };

  try {
    const invoice = await stripe.invoices.retrieve(stripeInvoiceId);
    if (invoice.status !== "open") {
      return { sent: false, reason: "not_eligible", message: `Invoice is ${invoice.status}, not open.` };
    }
    await stripe.invoices.sendInvoice(stripeInvoiceId);
    return { sent: true };
  } catch (err) {
    console.error(`Failed to resend Stripe invoice ${stripeInvoiceId}:`, err);
    return {
      sent: false,
      reason: "error",
      message: err instanceof Error ? err.message : "Unknown Stripe error.",
    };
  }
}
