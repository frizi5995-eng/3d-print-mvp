import "server-only";
import { createServiceClient } from "@/lib/supabase/server";
import { getSettings, type AppSettings } from "@/lib/admin/settings";

export interface SupplierCostInputs {
  supplierManufacturingCost: number;
  supplierShippingCost: number;
  supplierOtherCost: number;
}

export interface PricingCostBreakdown {
  supplierManufacturingCost: number;
  supplierShippingCost: number;
  supplierOtherCost: number;
  packagingCost: number;
  otherOperationalCost: number;
  contingency: number;
  paymentProcessingAllowance: number;
  /** Sum of every line above — the true estimated cost basis for pricing. */
  trueCost: number;
}

export interface PricingRecommendation {
  breakdown: PricingCostBreakdown;
  minimumSafePrice: number;
  recommendedPrice: number;
  highMarginPrice: number;
  expectedGrossProfit: number;
  expectedMarginPercent: number;
}

/**
 * Gross-margin pricing: price = cost / (1 - margin), NOT cost * (1 + margin)
 * — cost=€70 at 30% target margin must be €100 (profit/price=30%), not €91
 * (which is only a 23.1% margin on the resulting price). All math here is
 * server-side only; nothing about pricing is ever computed client-side or
 * accepted from a request body.
 */
export function priceForMargin(cost: number, marginPercent: number): number {
  if (marginPercent >= 100) return Infinity;
  return cost / (1 - marginPercent / 100);
}

export function computePricingRecommendation(
  costs: SupplierCostInputs,
  settings: Pick<
    AppSettings,
    | "minMarginWarningPercent"
    | "targetMarginPercent"
    | "highMarginPercent"
    | "contingencyPercent"
    | "packagingCostPerOrder"
    | "otherOperationalCostPerOrder"
    | "paymentProcessingFeePercent"
  >
): PricingRecommendation {
  const supplierManufacturingCost = Math.max(0, costs.supplierManufacturingCost || 0);
  const supplierShippingCost = Math.max(0, costs.supplierShippingCost || 0);
  const supplierOtherCost = Math.max(0, costs.supplierOtherCost || 0);
  const packagingCost = Math.max(0, settings.packagingCostPerOrder || 0);
  const otherOperationalCost = Math.max(0, settings.otherOperationalCostPerOrder || 0);

  const baseCost =
    supplierManufacturingCost + supplierShippingCost + supplierOtherCost + packagingCost + otherOperationalCost;
  const contingency = baseCost * (Math.max(0, settings.contingencyPercent || 0) / 100);
  const costWithContingency = baseCost + contingency;
  const paymentProcessingAllowance =
    costWithContingency * (Math.max(0, settings.paymentProcessingFeePercent || 0) / 100);
  const trueCost = costWithContingency + paymentProcessingAllowance;

  const recommendedPrice = priceForMargin(trueCost, settings.targetMarginPercent);
  const expectedGrossProfit = recommendedPrice - trueCost;
  const expectedMarginPercent = recommendedPrice > 0 ? (expectedGrossProfit / recommendedPrice) * 100 : 0;

  return {
    breakdown: {
      supplierManufacturingCost,
      supplierShippingCost,
      supplierOtherCost,
      packagingCost,
      otherOperationalCost,
      contingency,
      paymentProcessingAllowance,
      trueCost,
    },
    minimumSafePrice: priceForMargin(trueCost, settings.minMarginWarningPercent),
    recommendedPrice,
    highMarginPrice: priceForMargin(trueCost, settings.highMarginPercent),
    expectedGrossProfit,
    expectedMarginPercent,
  };
}

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
