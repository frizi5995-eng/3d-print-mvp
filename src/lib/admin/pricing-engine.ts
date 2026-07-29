import "server-only";
import { createServiceClient } from "@/lib/supabase/server";
import { getSettings } from "@/lib/admin/settings";
import { computePricingRecommendation } from "@/lib/pricing/engine";
import type { SupplierCostInputs, PricingRecommendation } from "@/lib/pricing/engine";

export type { SupplierCostInputs, PricingCostBreakdown, PricingRecommendation } from "@/lib/pricing/engine";
export { priceForMargin, computePricingRecommendation } from "@/lib/pricing/engine";

/**
 * Cost basis prefers the selected supplier quote; falls back to the
 * request's own production_cost/production_shipping_cost/other_cost
 * (in-house manufacturing, no supplier involved) if none is selected.
 * Returns null if there's no cost basis to price from at all.
 */
export async function getPricingRecommendationForRequest(
  requestId: string
): Promise<PricingRecommendation | null> {
  const supabase = createServiceClient();
  const { data: request } = await supabase
    .from("manufacturing_requests")
    .select("selected_supplier_quote_id, production_cost, production_shipping_cost, other_cost")
    .eq("id", requestId)
    .maybeSingle();
  if (!request) return null;

  let costs: SupplierCostInputs | null = null;

  if (request.selected_supplier_quote_id) {
    const { data: quote } = await supabase
      .from("supplier_quotes")
      .select("manufacturing_cost, supplier_shipping_cost, other_cost")
      .eq("id", request.selected_supplier_quote_id)
      .maybeSingle();
    if (quote) {
      costs = {
        supplierManufacturingCost: quote.manufacturing_cost,
        supplierShippingCost: quote.supplier_shipping_cost,
        supplierOtherCost: quote.other_cost,
      };
    }
  }

  if (!costs && request.production_cost !== null) {
    costs = {
      supplierManufacturingCost: request.production_cost,
      supplierShippingCost: request.production_shipping_cost ?? 0,
      supplierOtherCost: request.other_cost ?? 0,
    };
  }

  if (!costs) return null;

  const settings = await getSettings();
  return computePricingRecommendation(costs, settings);
}
