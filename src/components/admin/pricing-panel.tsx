"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { computeTotals, formatEUR } from "@/lib/admin/money";
import { updatePricing, type PricingFormState } from "@/app/admin/(protected)/requests/[id]/actions";

const initialState: PricingFormState = { status: "idle" };

function numToInput(value: number | null) {
  return value === null ? "" : String(value);
}

function parseOrNull(value: string): number | null {
  if (value.trim() === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function PricingPanel({
  requestId,
  initial,
}: {
  requestId: string;
  initial: {
    manufacturerName: string | null;
    productionCost: number | null;
    productionShippingCost: number | null;
    otherCost: number | null;
    customerManufacturingPrice: number | null;
    customerShippingPrice: number | null;
  };
}) {
  const [state, formAction, isPending] = useActionState(updatePricing, initialState);

  const [manufacturerName, setManufacturerName] = useState(initial.manufacturerName ?? "");
  const [productionCost, setProductionCost] = useState(numToInput(initial.productionCost));
  const [productionShippingCost, setProductionShippingCost] = useState(
    numToInput(initial.productionShippingCost)
  );
  const [otherCost, setOtherCost] = useState(numToInput(initial.otherCost));
  const [customerManufacturingPrice, setCustomerManufacturingPrice] = useState(
    numToInput(initial.customerManufacturingPrice)
  );
  const [customerShippingPrice, setCustomerShippingPrice] = useState(
    numToInput(initial.customerShippingPrice)
  );

  const totals = useMemo(
    () =>
      computeTotals({
        productionCost: parseOrNull(productionCost),
        productionShippingCost: parseOrNull(productionShippingCost),
        otherCost: parseOrNull(otherCost),
        customerManufacturingPrice: parseOrNull(customerManufacturingPrice),
        customerShippingPrice: parseOrNull(customerShippingPrice),
      }),
    [productionCost, productionShippingCost, otherCost, customerManufacturingPrice, customerShippingPrice]
  );

  const [dismissedState, setDismissedState] = useState<PricingFormState | null>(null);
  const showSaved = state.status === "success" && state !== dismissedState;

  useEffect(() => {
    if (state.status === "success") {
      const t = setTimeout(() => setDismissedState(state), 2000);
      return () => clearTimeout(t);
    }
  }, [state]);

  return (
    <form action={formAction} className="flex flex-col gap-6">
      <input type="hidden" name="requestId" value={requestId} />

      <div className="flex flex-col gap-4">
        <h3 className="text-sm font-medium">Production</h3>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="manufacturerName">Manufacturer</Label>
          <Input
            id="manufacturerName"
            name="manufacturerName"
            value={manufacturerName}
            onChange={(e) => setManufacturerName(e.target.value)}
          />
        </div>
        <MoneyField
          label="Production cost"
          name="productionCost"
          value={productionCost}
          onChange={setProductionCost}
        />
        <MoneyField
          label="Production shipping"
          name="productionShippingCost"
          value={productionShippingCost}
          onChange={setProductionShippingCost}
        />
        <MoneyField label="Other cost" name="otherCost" value={otherCost} onChange={setOtherCost} />
      </div>

      <div className="flex flex-col gap-4">
        <h3 className="text-sm font-medium">Customer quote</h3>
        <MoneyField
          label="Manufacturing price"
          name="customerManufacturingPrice"
          value={customerManufacturingPrice}
          onChange={setCustomerManufacturingPrice}
        />
        <MoneyField
          label="Shipping price"
          name="customerShippingPrice"
          value={customerShippingPrice}
          onChange={setCustomerShippingPrice}
        />
      </div>

      <div className="flex flex-col gap-2 rounded-lg border border-border bg-surface-elevated p-4 text-sm">
        <SummaryRow label="Customer total" value={formatEUR(totals.customerTotal)} strong />
        <SummaryRow label="Internal cost" value={formatEUR(totals.internalCost)} />
        <SummaryRow
          label="Gross margin"
          value={formatEUR(totals.grossMargin)}
          tone={totals.grossMargin > 0 ? "positive" : totals.grossMargin < 0 ? "negative" : undefined}
        />
        <SummaryRow
          label="Margin"
          value={totals.marginPercent === null ? "—" : `${totals.marginPercent.toFixed(1)}%`}
          tone={
            totals.marginPercent !== null
              ? totals.marginPercent > 0
                ? "positive"
                : totals.marginPercent < 0
                  ? "negative"
                  : undefined
              : undefined
          }
        />
      </div>

      {state.status === "error" && (
        <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {state.error}
        </p>
      )}

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={isPending}>
          {isPending ? "Saving…" : "Save changes"}
        </Button>
        {showSaved && <span className="text-sm text-success">Saved</span>}
      </div>
    </form>
  );
}

function MoneyField({
  label,
  name,
  value,
  onChange,
}: {
  label: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={name}>{label}</Label>
      <div className="relative">
        <span className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-sm text-muted-foreground">
          €
        </span>
        <Input
          id={name}
          name={name}
          type="number"
          min={0}
          step="0.01"
          inputMode="decimal"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="pl-6"
        />
      </div>
    </div>
  );
}

function SummaryRow({
  label,
  value,
  strong,
  tone,
}: {
  label: string;
  value: string;
  strong?: boolean;
  tone?: "positive" | "negative";
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span
        className={cn(
          strong && "font-semibold",
          tone === "positive" && "text-success",
          tone === "negative" && "text-destructive"
        )}
      >
        {value}
      </span>
    </div>
  );
}
