"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { formatEUR } from "@/lib/admin/money";
import { applyPricingRecommendation } from "@/app/admin/(protected)/requests/[id]/pricing-actions";
import type { PricingRecommendation } from "@/lib/admin/pricing-engine";

export function PricingRecommendationPanel({
  requestId,
  recommendation,
}: {
  requestId: string;
  recommendation: PricingRecommendation | null;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [pendingTier, setPendingTier] = useState<string | null>(null);

  if (!recommendation) {
    return (
      <p className="text-sm text-muted-foreground">
        No supplier or production cost recorded yet — add a supplier quote or set production cost to
        see pricing recommendations.
      </p>
    );
  }

  const { breakdown } = recommendation;

  const apply = (tier: "minimum" | "recommended" | "high") => {
    setPendingTier(tier);
    startTransition(async () => {
      const result = await applyPricingRecommendation(requestId, tier);
      if (!result.ok) toast.error(result.error);
      else {
        toast.success(result.message);
        router.refresh();
      }
      setPendingTier(null);
    });
  };

  return (
    <div className="flex flex-col gap-3 text-sm">
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <Row label="Supplier manufacturing" value={formatEUR(breakdown.supplierManufacturingCost)} />
        <Row label="Supplier shipping" value={formatEUR(breakdown.supplierShippingCost)} />
        <Row label="Supplier other" value={formatEUR(breakdown.supplierOtherCost)} />
        <Row label="Packaging" value={formatEUR(breakdown.packagingCost)} />
        <Row label="Other operational" value={formatEUR(breakdown.otherOperationalCost)} />
        <Row label="Contingency" value={formatEUR(breakdown.contingency)} />
        <Row label="Payment processing" value={formatEUR(breakdown.paymentProcessingAllowance)} />
      </div>
      <div className="h-px bg-border" />
      <Row label="True estimated cost" value={formatEUR(breakdown.trueCost)} strong />

      <div className="mt-1 flex flex-col gap-2">
        <PriceRow
          label="Minimum safe price"
          price={recommendation.minimumSafePrice}
          pending={isPending && pendingTier === "minimum"}
          onApply={() => apply("minimum")}
          disabled={isPending}
        />
        <PriceRow
          label="Recommended price"
          price={recommendation.recommendedPrice}
          pending={isPending && pendingTier === "recommended"}
          onApply={() => apply("recommended")}
          disabled={isPending}
          highlight
        />
        <PriceRow
          label="High-margin price"
          price={recommendation.highMarginPrice}
          pending={isPending && pendingTier === "high"}
          onApply={() => apply("high")}
          disabled={isPending}
        />
      </div>

      <div className="h-px bg-border" />
      <Row label="Expected gross profit" value={formatEUR(recommendation.expectedGrossProfit)} />
      <Row label="Expected margin" value={`${recommendation.expectedMarginPercent.toFixed(1)}%`} />
      <p className="text-xs text-muted-foreground">
        Applying only updates Fabrik&apos;s customer price fields below — it never sends a quote,
        creates a payment, or orders from a supplier.
      </p>
    </div>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className={strong ? "font-medium text-foreground" : "text-muted-foreground"}>{label}</span>
      <span className={strong ? "font-semibold" : "font-medium"}>{value}</span>
    </div>
  );
}

function PriceRow({
  label,
  price,
  pending,
  disabled,
  onApply,
  highlight,
}: {
  label: string;
  price: number;
  pending: boolean;
  disabled: boolean;
  onApply: () => void;
  highlight?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface-elevated p-2.5">
      <div>
        <p className={highlight ? "text-sm font-medium text-primary" : "text-sm font-medium"}>{label}</p>
        <p className="text-base font-semibold">{formatEUR(price)}</p>
      </div>
      <Button size="sm" variant={highlight ? "default" : "outline"} disabled={disabled} onClick={onApply}>
        {pending ? "Applying…" : "Apply"}
      </Button>
    </div>
  );
}
