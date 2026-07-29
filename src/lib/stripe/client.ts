import "server-only";
import type Stripe from "stripe";

export function isStripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

let cached: Stripe | null | undefined;

/**
 * Lazily constructs the Stripe client only when STRIPE_SECRET_KEY is set —
 * same dynamic-import posture as src/lib/email/resend.ts, so the absence of
 * a key never breaks the build or any code path that doesn't need Stripe.
 * Cached per server instance since Stripe clients are stateless and safe to
 * reuse across requests.
 */
export async function getStripeClient(): Promise<Stripe | null> {
  if (cached !== undefined) return cached;

  const apiKey = process.env.STRIPE_SECRET_KEY;
  if (!apiKey) {
    cached = null;
    return null;
  }

  const { default: Stripe } = await import("stripe");
  cached = new Stripe(apiKey);
  return cached;
}
