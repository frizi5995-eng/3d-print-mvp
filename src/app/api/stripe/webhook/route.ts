import "server-only";
import type { NextRequest } from "next/server";
import type Stripe from "stripe";
import { getStripeClient } from "@/lib/stripe/client";
import { createServiceClient } from "@/lib/supabase/server";
import { logAdminActivity } from "@/lib/admin/activity-log";
import { STRIPE_WEBHOOK_ACTOR } from "@/lib/admin/activity";

/**
 * Stripe webhooks are the ONLY thing authoritative for payment_status —
 * nothing in this app ever accepts a "paid" claim from the browser. Every
 * handler below re-checks the current payment_status in its guarded UPDATE
 * (not just the status read moments earlier), so out-of-order or duplicate
 * delivery can't move a request backward (e.g. a stray payment_failed
 * arriving after invoice.paid can never un-pay it).
 */
export async function POST(request: NextRequest) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const stripe = await getStripeClient();

  if (!stripe || !webhookSecret) {
    // Not configured — never crash. Stripe will just see 404s until this is set up.
    return new Response("Stripe not configured", { status: 404 });
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return new Response("Missing signature", { status: 400 });
  }

  const rawBody = await request.text();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err) {
    console.error("Stripe webhook signature verification failed:", err instanceof Error ? err.message : err);
    return new Response("Invalid signature", { status: 400 });
  }

  const supabase = createServiceClient();

  // Idempotency: insert-or-ignore on the event id. If this event was already
  // recorded (duplicate delivery, a Stripe retry), `inserted` comes back
  // empty and we skip reprocessing — but still return 200 so Stripe stops
  // retrying a webhook we've already handled.
  const { data: inserted, error: insertErr } = await supabase
    .from("stripe_webhook_events")
    .upsert({ id: event.id, type: event.type }, { onConflict: "id", ignoreDuplicates: true })
    .select("id");

  if (insertErr) {
    console.error("Failed to record Stripe webhook event:", insertErr.message);
    return new Response("Storage error", { status: 500 });
  }
  if (!inserted || inserted.length === 0) {
    return new Response("Already processed", { status: 200 });
  }

  try {
    switch (event.type) {
      case "invoice.paid":
        await handleInvoicePaid(stripe, supabase, event.data.object as Stripe.Invoice);
        break;
      case "invoice.payment_failed":
        await handleInvoicePaymentFailed(supabase, event.data.object as Stripe.Invoice);
        break;
      case "invoice.voided":
        await handleInvoiceVoided(supabase, event.data.object as Stripe.Invoice);
        break;
      case "charge.refunded":
        await handleChargeRefunded(supabase, event.data.object as Stripe.Charge);
        break;
      default:
        // Not an event type we act on — acknowledged, not an error.
        break;
    }
  } catch (err) {
    // Log but still 200: we've already recorded the event id, so a Stripe
    // retry would just be treated as a duplicate and skipped, not retried
    // usefully. Surfacing the failure here (rather than 500) avoids Stripe
    // hammering retries for a bug that a retry can't fix.
    console.error(`Error processing Stripe webhook event ${event.id} (${event.type}):`, err);
  }

  return new Response("ok", { status: 200 });
}

type SupabaseServiceClient = ReturnType<typeof createServiceClient>;

/**
 * Modern Stripe API versions moved the PaymentIntent off Invoice directly —
 * it now lives on the invoice's InvoicePayment records instead. Best-effort
 * only: if this lookup fails or comes back empty, payment_status still gets
 * marked "paid" below; we just won't have stripe_payment_intent_id set.
 */
async function resolvePaymentIntentId(stripe: Stripe, invoiceId: string): Promise<string | null> {
  try {
    const payments = await stripe.invoicePayments.list({ invoice: invoiceId, limit: 1 });
    const payment = payments.data[0]?.payment;
    if (!payment || payment.type !== "payment_intent") return null;
    return typeof payment.payment_intent === "string" ? payment.payment_intent : (payment.payment_intent?.id ?? null);
  } catch (err) {
    console.error(`Failed to resolve payment intent for invoice ${invoiceId}:`, err);
    return null;
  }
}

async function handleInvoicePaid(stripe: Stripe, supabase: SupabaseServiceClient, invoice: Stripe.Invoice) {
  const paymentIntentId = invoice.id ? await resolvePaymentIntentId(stripe, invoice.id) : null;

  const { data: updated } = await supabase
    .from("manufacturing_requests")
    .update({
      payment_status: "paid",
      paid_at: new Date().toISOString(),
      stripe_payment_intent_id: paymentIntentId,
    })
    .eq("stripe_invoice_id", invoice.id)
    .in("payment_status", ["invoice_sent", "payment_failed"])
    .select("id")
    .maybeSingle();

  if (updated) {
    await logAdminActivity(STRIPE_WEBHOOK_ACTOR, "payment_paid", updated.id, {
      stripe_invoice_id: invoice.id,
    });
  }
}

async function handleInvoicePaymentFailed(supabase: SupabaseServiceClient, invoice: Stripe.Invoice) {
  const { data: updated } = await supabase
    .from("manufacturing_requests")
    .update({ payment_status: "payment_failed" })
    .eq("stripe_invoice_id", invoice.id)
    .eq("payment_status", "invoice_sent")
    .select("id")
    .maybeSingle();

  if (updated) {
    await logAdminActivity(STRIPE_WEBHOOK_ACTOR, "payment_failed", updated.id, {
      stripe_invoice_id: invoice.id,
    });
  }
}

async function handleInvoiceVoided(supabase: SupabaseServiceClient, invoice: Stripe.Invoice) {
  // Clearing stripe_invoice_id (rather than just resetting payment_status)
  // lets createInvoiceForRequest()'s `is("stripe_invoice_id", null)` guard
  // allow a fresh invoice to be created for this request afterward.
  const { data: updated } = await supabase
    .from("manufacturing_requests")
    .update({ payment_status: "unpaid", stripe_invoice_id: null })
    .eq("stripe_invoice_id", invoice.id)
    .in("payment_status", ["invoice_sent", "payment_failed"])
    .select("id")
    .maybeSingle();

  if (updated) {
    await logAdminActivity(STRIPE_WEBHOOK_ACTOR, "payment_voided", updated.id, {
      stripe_invoice_id: invoice.id,
    });
  }
}

async function handleChargeRefunded(supabase: SupabaseServiceClient, charge: Stripe.Charge) {
  const paymentIntentId = typeof charge.payment_intent === "string" ? charge.payment_intent : (charge.payment_intent?.id ?? null);
  if (!paymentIntentId) return;

  const { data: updated } = await supabase
    .from("manufacturing_requests")
    .update({ payment_status: "refunded" })
    .eq("stripe_payment_intent_id", paymentIntentId)
    .eq("payment_status", "paid")
    .select("id")
    .maybeSingle();

  if (updated) {
    await logAdminActivity(STRIPE_WEBHOOK_ACTOR, "payment_refunded", updated.id, {
      stripe_payment_intent_id: paymentIntentId,
    });
  }
}
