"use server";

import { revalidatePath } from "next/cache";
import { requireAdminUser } from "@/lib/auth/admin";
import { createServiceClient } from "@/lib/supabase/server";
import { logAdminActivity } from "@/lib/admin/activity-log";
import { getPricingRecommendationForRequest } from "@/lib/admin/pricing-engine";
import { splitRecommendedPrice } from "@/lib/pricing/engine";
import type { ActionResult } from "./actions";

const PRICE_TIERS = ["minimum", "recommended", "high"] as const;
type PriceTier = (typeof PRICE_TIERS)[number];

/**
 * "Apply" only fills Fabrik's own customer_manufacturing_price/
 * customer_shipping_price columns — it never sends a quote, never touches
 * Stripe, never contacts a supplier. The admin still has to click
 * "Prepare quote" separately for anything customer-facing to happen.
 *
 * Price is recomputed here from the request's current cost basis — never
 * accepted as a number from the caller — so there's no path for a client
 * to dictate what price gets applied.
 */
export async function applyPricingRecommendation(requestId: string, tier: PriceTier): Promise<ActionResult> {
  const admin = await requireAdminUser();

  if (!PRICE_TIERS.includes(tier)) return { ok: false, error: "Invalid pricing tier." };

  const recommendation = await getPricingRecommendationForRequest(requestId);
  if (!recommendation) {
    return { ok: false, error: "No supplier or production cost is recorded for this request yet." };
  }

  const totalPrice =
    tier === "minimum"
      ? recommendation.minimumSafePrice
      : tier === "high"
        ? recommendation.highMarginPrice
        : recommendation.recommendedPrice;

  if (!Number.isFinite(totalPrice) || totalPrice < 0) {
    return { ok: false, error: "Could not compute a valid price." };
  }

  const { manufacturingPrice, shippingPrice } = splitRecommendedPrice(
    totalPrice,
    recommendation.breakdown.supplierShippingCost
  );

  const supabase = createServiceClient();
  const { error } = await supabase
    .from("manufacturing_requests")
    .update({
      customer_manufacturing_price: manufacturingPrice,
      customer_shipping_price: shippingPrice,
    })
    .eq("id", requestId);

  if (error) return { ok: false, error: "Could not apply pricing." };

  await logAdminActivity(admin.email!, "pricing_recommendation_applied", requestId, {
    tier,
    manufacturingPrice,
    shippingPrice,
  });

  revalidatePath(`/admin/requests/${requestId}`);
  return { ok: true, message: "Recommended pricing applied. Nothing was sent to the customer yet." };
}
