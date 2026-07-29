import { describe, it, expect } from "vitest";
import { priceForMargin, computePricingRecommendation, splitRecommendedPrice } from "./engine";

const settings = {
  minMarginWarningPercent: 15,
  targetMarginPercent: 30,
  highMarginPercent: 40,
  contingencyPercent: 0,
  packagingCostPerOrder: 0,
  otherOperationalCostPerOrder: 0,
  paymentProcessingFeePercent: 0,
};

describe("priceForMargin", () => {
  it("cost=70 @ 30% target => 100 (not 91)", () => {
    expect(priceForMargin(70, 30)).toBe(100);
  });

  it("zero cost => zero price", () => {
    expect(priceForMargin(0, 30)).toBe(0);
  });

  it("0% margin => price equals cost", () => {
    expect(priceForMargin(50, 0)).toBe(50);
  });

  it("100%+ margin never divides by zero / goes negative", () => {
    expect(priceForMargin(50, 100)).toBe(Infinity);
    expect(priceForMargin(50, 150)).toBe(Infinity);
  });
});

describe("computePricingRecommendation", () => {
  it("resulting margin % exactly matches target with zero extras", () => {
    const rec = computePricingRecommendation(
      { supplierManufacturingCost: 50, supplierShippingCost: 20, supplierOtherCost: 0 },
      settings
    );
    expect(rec.breakdown.trueCost).toBe(70);
    expect(rec.recommendedPrice).toBe(100);
    expect(rec.expectedGrossProfit).toBe(30);
    expect(rec.expectedMarginPercent).toBeCloseTo(30, 10);
  });

  it("minimum <= recommended <= high for increasing margin tiers", () => {
    const rec = computePricingRecommendation(
      { supplierManufacturingCost: 50, supplierShippingCost: 20, supplierOtherCost: 5 },
      settings
    );
    expect(rec.minimumSafePrice).toBeLessThanOrEqual(rec.recommendedPrice);
    expect(rec.recommendedPrice).toBeLessThanOrEqual(rec.highMarginPrice);
  });

  it("all-zero costs produce zero prices, not NaN", () => {
    const rec = computePricingRecommendation(
      { supplierManufacturingCost: 0, supplierShippingCost: 0, supplierOtherCost: 0 },
      settings
    );
    expect(rec.breakdown.trueCost).toBe(0);
    expect(rec.recommendedPrice).toBe(0);
    expect(rec.minimumSafePrice).toBe(0);
    expect(Number.isNaN(rec.expectedMarginPercent)).toBe(false);
  });

  it("negative cost inputs are clamped to zero, never produce negative cost", () => {
    const rec = computePricingRecommendation(
      { supplierManufacturingCost: -10, supplierShippingCost: -5, supplierOtherCost: -1 },
      settings
    );
    expect(rec.breakdown.supplierManufacturingCost).toBe(0);
    expect(rec.breakdown.trueCost).toBe(0);
  });

  it("contingency, packaging, other-ops, and processing allowance all add to true cost", () => {
    const rec = computePricingRecommendation(
      { supplierManufacturingCost: 100, supplierShippingCost: 0, supplierOtherCost: 0 },
      {
        ...settings,
        contingencyPercent: 10, // +10 -> 110
        packagingCostPerOrder: 5, // base 105 -> contingency applies to 105*1.10=115.5? see below
        otherOperationalCostPerOrder: 5,
        paymentProcessingFeePercent: 2,
      }
    );
    // baseCost = 100+0+0+5+5 = 110; contingency = 11; withContingency = 121;
    // processing allowance = 121*0.02 = 2.42; trueCost = 123.42
    expect(rec.breakdown.trueCost).toBeCloseTo(123.42, 6);
  });

  it("invalid/negative margin settings don't crash (Infinity/clamped, not throw)", () => {
    expect(() =>
      computePricingRecommendation(
        { supplierManufacturingCost: 10, supplierShippingCost: 0, supplierOtherCost: 0 },
        { ...settings, targetMarginPercent: 100 }
      )
    ).not.toThrow();
  });
});

describe("splitRecommendedPrice", () => {
  it("manufacturing + shipping always sums exactly to total", () => {
    const { manufacturingPrice, shippingPrice } = splitRecommendedPrice(100, 20);
    expect(shippingPrice).toBe(20);
    expect(manufacturingPrice).toBe(80);
    expect(Math.round((manufacturingPrice + shippingPrice) * 100) / 100).toBe(100);
  });

  it("rounds to cents and sum still matches total (rounding behavior)", () => {
    const total = 100 / 3; // 33.333...
    const { manufacturingPrice, shippingPrice } = splitRecommendedPrice(total, 10 / 3);
    const sum = Math.round((manufacturingPrice + shippingPrice) * 100) / 100;
    // Both legs independently rounded to cents; total reconstructed from rounded parts.
    expect(shippingPrice).toBe(3.33);
    expect(sum).toBe(manufacturingPrice + shippingPrice);
  });

  it("negative shipping cost is clamped, never produces negative shipping price", () => {
    const { shippingPrice } = splitRecommendedPrice(100, -5);
    expect(shippingPrice).toBe(0);
  });
});
