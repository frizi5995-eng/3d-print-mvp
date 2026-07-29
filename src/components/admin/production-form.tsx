"use client";

import { useActionState } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  updateProductionInfo,
  type ProductionFormState,
} from "@/app/admin/(protected)/requests/[id]/production-actions";

const initialState: ProductionFormState = { status: "idle" };

export function ProductionForm({
  requestId,
  estimatedCompletionAt,
  productionNotes,
  externalSupplierReference,
}: {
  requestId: string;
  estimatedCompletionAt: string | null;
  productionNotes: string | null;
  externalSupplierReference: string | null;
}) {
  const [state, formAction, isPending] = useActionState(updateProductionInfo, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="requestId" value={requestId} />

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="estimatedCompletionAt">Estimated completion</Label>
        <Input
          id="estimatedCompletionAt"
          name="estimatedCompletionAt"
          type="date"
          defaultValue={estimatedCompletionAt?.slice(0, 10) ?? ""}
          className="max-w-48"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="externalSupplierReference">Supplier order/reference #</Label>
        <Input
          id="externalSupplierReference"
          name="externalSupplierReference"
          defaultValue={externalSupplierReference ?? ""}
          className="max-w-64"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="productionNotes">Production notes</Label>
        <Textarea id="productionNotes" name="productionNotes" rows={3} defaultValue={productionNotes ?? ""} />
      </div>

      {state.status === "error" && <p className="text-xs text-destructive">{state.error}</p>}

      <div className="flex items-center gap-3">
        <Button type="submit" size="sm" variant="outline" disabled={isPending}>
          {isPending ? "Saving…" : "Save production info"}
        </Button>
        {state.status === "success" && <span className="text-xs text-success">Saved</span>}
      </div>
    </form>
  );
}
