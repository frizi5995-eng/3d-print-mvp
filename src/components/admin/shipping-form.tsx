"use client";

import { useActionState } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { updateShippingInfo, type ShippingFormState } from "@/app/admin/(protected)/requests/[id]/shipping-actions";
import type { ManufacturingRequest } from "@/types";

const initialState: ShippingFormState = { status: "idle" };

export function ShippingForm({
  requestId,
  initial,
}: {
  requestId: string;
  initial: Pick<
    ManufacturingRequest,
    "carrier" | "tracking_number" | "tracking_url" | "estimated_delivery_at" | "delivered_at"
  >;
}) {
  const [state, formAction, isPending] = useActionState(updateShippingInfo, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="requestId" value={requestId} />

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="carrier">Carrier</Label>
          <Input id="carrier" name="carrier" defaultValue={initial.carrier ?? ""} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="trackingNumber">Tracking number</Label>
          <Input id="trackingNumber" name="trackingNumber" defaultValue={initial.tracking_number ?? ""} />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="trackingUrl">Tracking URL</Label>
        <Input id="trackingUrl" name="trackingUrl" type="url" defaultValue={initial.tracking_url ?? ""} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="estimatedDeliveryAt">Estimated delivery</Label>
          <Input
            id="estimatedDeliveryAt"
            name="estimatedDeliveryAt"
            type="date"
            defaultValue={initial.estimated_delivery_at?.slice(0, 10) ?? ""}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="deliveredAt">Delivered on</Label>
          <Input
            id="deliveredAt"
            name="deliveredAt"
            type="date"
            defaultValue={initial.delivered_at?.slice(0, 10) ?? ""}
          />
        </div>
      </div>

      {state.status === "error" && <p className="text-xs text-destructive">{state.error}</p>}

      <div className="flex items-center gap-3">
        <Button type="submit" size="sm" variant="outline" disabled={isPending}>
          {isPending ? "Saving…" : "Save shipping info"}
        </Button>
        {state.status === "success" && <span className="text-xs text-success">Saved</span>}
      </div>
    </form>
  );
}
