"use client";

import { useActionState } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { saveSupplier, type SupplierFormState } from "@/app/admin/(protected)/suppliers/actions";
import { SUPPLIER_TECHNOLOGIES } from "@/types";
import type { Supplier } from "@/types";

const initialState: SupplierFormState = { status: "idle" };

export function SupplierForm({ supplier }: { supplier?: Supplier }) {
  const [state, formAction, isPending] = useActionState(saveSupplier, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-5">
      {supplier && <input type="hidden" name="id" value={supplier.id} />}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="name">Name</Label>
          <Input id="name" name="name" required defaultValue={supplier?.name} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="country">Country</Label>
          <Input id="country" name="country" required defaultValue={supplier?.country} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="website">Website</Label>
          <Input id="website" name="website" type="url" defaultValue={supplier?.website ?? ""} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="contactEmail">Contact email</Label>
          <Input id="contactEmail" name="contactEmail" type="email" defaultValue={supplier?.contact_email ?? ""} />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="contactPhone">Contact phone</Label>
        <Input id="contactPhone" name="contactPhone" className="max-w-56" defaultValue={supplier?.contact_phone ?? ""} />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label>Technologies</Label>
        <div className="flex flex-wrap gap-3">
          {SUPPLIER_TECHNOLOGIES.map((tech) => (
            <label key={tech} className="flex items-center gap-1.5 text-sm">
              <input
                type="checkbox"
                name="technologies"
                value={tech}
                defaultChecked={supplier?.technologies.includes(tech)}
                className="size-4 accent-primary"
              />
              {tech}
            </label>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="materials">Materials (comma-separated)</Label>
        <Input id="materials" name="materials" placeholder="PLA, ABS, Resin" defaultValue={supplier?.materials.join(", ") ?? ""} />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="apiProvider">API provider key</Label>
          <Input id="apiProvider" name="apiProvider" placeholder="e.g. sculpteo" defaultValue={supplier?.api_provider ?? ""} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="reliabilityScore">Reliability score (0-10)</Label>
          <Input
            id="reliabilityScore"
            name="reliabilityScore"
            type="number"
            min={0}
            max={10}
            step="0.1"
            defaultValue={supplier?.reliability_score ?? ""}
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-4">
        <label className="flex items-center gap-1.5 text-sm">
          <input type="checkbox" name="apiEnabled" defaultChecked={supplier?.api_enabled} className="size-4 accent-primary" />
          API integration enabled
        </label>
        <label className="flex items-center gap-1.5 text-sm">
          <input type="checkbox" name="preferred" defaultChecked={supplier?.preferred} className="size-4 accent-primary" />
          Preferred supplier
        </label>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="notes">Internal notes</Label>
        <Textarea id="notes" name="notes" rows={3} defaultValue={supplier?.notes ?? ""} />
      </div>

      {state.status === "error" && (
        <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{state.error}</p>
      )}

      <Button type="submit" disabled={isPending} className="w-fit">
        {isPending ? "Saving…" : supplier ? "Save changes" : "Create supplier"}
      </Button>
    </form>
  );
}
