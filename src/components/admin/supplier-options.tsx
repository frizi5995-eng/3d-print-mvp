"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatEUR } from "@/lib/admin/money";
import { formatDate } from "@/lib/utils";
import { cn } from "@/lib/utils";
import {
  addSupplierQuoteAction,
  rejectSupplierQuoteAction,
  selectSupplierQuoteAction,
} from "@/app/admin/(protected)/requests/[id]/supplier-actions";
import type { SupplierQuoteWithSupplier } from "@/lib/admin/supplier-quotes";
import type { Supplier, SupplierQuoteSource } from "@/types";

const SOURCE_LABELS: Record<SupplierQuoteSource, string> = {
  manual: "Manual",
  api_estimate: "API estimate (unconfirmed)",
  api_confirmed: "Confirmed",
};

const SOURCE_STYLES: Record<SupplierQuoteSource, string> = {
  manual: "bg-muted text-muted-foreground",
  api_estimate: "bg-warning/15 text-warning",
  api_confirmed: "bg-success/15 text-success",
};

function leadTimeLabel(min: number | null, max: number | null): string {
  if (min === null && max === null) return "—";
  if (min !== null && max !== null) return min === max ? `${min}d` : `${min}-${max}d`;
  return `${min ?? max}d`;
}

export function SupplierOptions({
  requestId,
  quotes,
  suppliers,
  selectedQuoteId,
}: {
  requestId: string;
  quotes: SupplierQuoteWithSupplier[];
  suppliers: Supplier[];
  selectedQuoteId: string | null;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);

  const runSelect = (quoteId: string | null) => {
    setPendingId(quoteId ?? "clear");
    startTransition(async () => {
      const result = await selectSupplierQuoteAction(requestId, quoteId);
      if (!result.ok) toast.error(result.error);
      else {
        toast.success(result.message);
        router.refresh();
      }
      setPendingId(null);
    });
  };

  const runReject = (quoteId: string) => {
    setPendingId(quoteId);
    startTransition(async () => {
      const result = await rejectSupplierQuoteAction(requestId, quoteId);
      if (!result.ok) toast.error(result.error);
      else {
        toast.success(result.message);
        router.refresh();
      }
      setPendingId(null);
    });
  };

  const activeQuotes = quotes.filter((q) => q.status !== "rejected");
  const rejectedQuotes = quotes.filter((q) => q.status === "rejected");

  return (
    <div className="flex flex-col gap-3">
      {activeQuotes.length === 0 && <p className="text-sm text-muted-foreground">No supplier quotes yet.</p>}

      {activeQuotes.map((q) => {
        const isSelected = q.id === selectedQuoteId;
        const total = q.manufacturing_cost + q.supplier_shipping_cost + q.other_cost;
        return (
          <div
            key={q.id}
            className={cn(
              "flex flex-col gap-2 rounded-lg border p-3",
              isSelected ? "border-primary bg-primary/5" : "border-border"
            )}
          >
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-medium">
                {q.supplier_preferred && <span className="mr-1 text-primary">★</span>}
                {q.supplier_name}
                <span className="ml-1.5 text-xs font-normal text-muted-foreground">{q.supplier_country}</span>
              </p>
              <span className={cn("rounded-md px-2 py-0.5 text-xs font-medium", SOURCE_STYLES[q.source])}>
                {SOURCE_LABELS[q.source]}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-4">
              <Field label="Manufacturing" value={formatEUR(q.manufacturing_cost)} />
              <Field label="Shipping" value={formatEUR(q.supplier_shipping_cost)} />
              <Field label="Total cost" value={formatEUR(total)} />
              <Field label="Lead time" value={leadTimeLabel(q.lead_time_days_min, q.lead_time_days_max)} />
            </div>
            {q.valid_until && <p className="text-xs text-muted-foreground">Valid until {formatDate(q.valid_until)}</p>}
            {q.notes && <p className="text-xs text-muted-foreground">{q.notes}</p>}
            <div className="flex gap-2">
              {isSelected ? (
                <Button size="sm" variant="outline" disabled={isPending} onClick={() => runSelect(null)}>
                  {pendingId === "clear" ? "Clearing…" : "Clear selection"}
                </Button>
              ) : (
                <Button size="sm" disabled={isPending} onClick={() => runSelect(q.id)}>
                  {pendingId === q.id ? "Selecting…" : "Select"}
                </Button>
              )}
              <Button size="sm" variant="ghost" disabled={isPending} onClick={() => runReject(q.id)}>
                Reject
              </Button>
            </div>
          </div>
        );
      })}

      {rejectedQuotes.length > 0 && (
        <details className="text-xs text-muted-foreground">
          <summary className="cursor-pointer">{rejectedQuotes.length} rejected quote(s)</summary>
          <div className="mt-2 flex flex-col gap-1">
            {rejectedQuotes.map((q) => (
              <p key={q.id}>
                {q.supplier_name} — {formatEUR(q.manufacturing_cost + q.supplier_shipping_cost + q.other_cost)}
              </p>
            ))}
          </div>
        </details>
      )}

      {!showAddForm ? (
        <Button size="sm" variant="outline" className="w-fit" onClick={() => setShowAddForm(true)}>
          Add supplier quote
        </Button>
      ) : (
        <AddSupplierQuoteForm requestId={requestId} suppliers={suppliers} onDone={() => setShowAddForm(false)} />
      )}
    </div>
  );
}

function AddSupplierQuoteForm({
  requestId,
  suppliers,
  onDone,
}: {
  requestId: string;
  suppliers: Supplier[];
  onDone: () => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const submit = (formData: FormData) => {
    setError(null);
    startTransition(async () => {
      const result = await addSupplierQuoteAction(formData);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      toast.success(result.message);
      router.refresh();
      onDone();
    });
  };

  return (
    <form action={submit} className="flex flex-col gap-3 rounded-lg border border-border bg-surface-elevated p-3">
      <input type="hidden" name="requestId" value={requestId} />

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="supplierId">Supplier</Label>
        <select
          id="supplierId"
          name="supplierId"
          required
          className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          {suppliers.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name} ({s.country})
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <NumField name="manufacturingCost" label="Manufacturing €" required />
        <NumField name="supplierShippingCost" label="Shipping €" />
        <NumField name="otherCost" label="Other €" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <NumField name="leadTimeMin" label="Lead time min (days)" />
        <NumField name="leadTimeMax" label="Lead time max (days)" />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="source">Source</Label>
        <select
          id="source"
          name="source"
          defaultValue="manual"
          className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <option value="manual">Manual</option>
          <option value="api_estimate">API estimate (unconfirmed)</option>
          <option value="api_confirmed">Confirmed</option>
        </select>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="notes">Notes</Label>
        <Textarea id="notes" name="notes" rows={2} />
      </div>

      {error && <p className="text-xs text-destructive">{error}</p>}

      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={isPending}>
          {isPending ? "Saving…" : "Add quote"}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

function NumField({ name, label, required }: { name: string; label: string; required?: boolean }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} name={name} type="number" min={0} step="0.01" required={required} />
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
