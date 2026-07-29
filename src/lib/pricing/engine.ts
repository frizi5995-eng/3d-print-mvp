// Pure pricing math — no "server-only", no DB/network imports, so this is
// directly unit-testable. src/lib/admin/pricing-engine.ts wraps this with
// the DB lookup (selected supplier quote / production cost fallback).

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

export interface PricingSettingsInputs {
  minMarginWarningPercent: number;
  targetMarginPercent: number;
  highMarginPercent: number;
  contingencyPercent: number;
  packagingCostPerOrder: number;
  otherOperationalCostPerOrder: number;
  paymentProcessingFeePercent: number;
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
  settings: PricingSettingsInputs
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

export interface PriceSplit {
  manufacturingPrice: number;
  shippingPrice: number;
}

/**
 * Shipping passes through at supplier cost (no markup); all margin is
 * carried on the manufacturing line. The two always sum to exactly
 * totalPrice, so the target margin is exact regardless of this split.
 * Both values are rounded to cents independently, then manufacturing
 * absorbs any rounding remainder so the sum is always exact.
 */
export function splitRecommendedPrice(totalPrice: number, supplierShippingCost: number): PriceSplit {
  const shippingPrice = Math.round(Math.max(0, supplierShippingCost) * 100) / 100;
  const manufacturingPrice = Math.round((totalPrice - shippingPrice) * 100) / 100;
  return { manufacturingPrice, shippingPrice };
}
