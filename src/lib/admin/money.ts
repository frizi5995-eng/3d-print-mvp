export interface PricingInputs {
  productionCost: number | null;
  productionShippingCost: number | null;
  otherCost: number | null;
  customerManufacturingPrice: number | null;
  customerShippingPrice: number | null;
}

export interface PricingTotals {
  internalCost: number;
  customerTotal: number;
  grossMargin: number;
  /** null when customerTotal is 0 — division would be meaningless, not just unsafe. */
  marginPercent: number | null;
}

export function computeTotals(inputs: PricingInputs): PricingTotals {
  const internalCost =
    (inputs.productionCost ?? 0) +
    (inputs.productionShippingCost ?? 0) +
    (inputs.otherCost ?? 0);

  const customerTotal =
    (inputs.customerManufacturingPrice ?? 0) + (inputs.customerShippingPrice ?? 0);

  const grossMargin = customerTotal - internalCost;
  const marginPercent = customerTotal > 0 ? (grossMargin / customerTotal) * 100 : null;

  return { internalCost, customerTotal, grossMargin, marginPercent };
}

export function formatEUR(value: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "EUR" }).format(value);
}
