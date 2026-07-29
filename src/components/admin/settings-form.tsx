"use client";

import { useActionState } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { MATERIALS } from "@/lib/constants";
import { saveSettings, type SettingsFormState } from "@/app/admin/(protected)/settings/actions";
import type { AppSettings } from "@/lib/admin/settings";

const initialState: SettingsFormState = { status: "idle" };

export function SettingsForm({ settings }: { settings: AppSettings }) {
  const [state, formAction, isPending] = useActionState(saveSettings, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="quoteValidityDays">Quote validity (days)</Label>
        <Input
          id="quoteValidityDays"
          name="quoteValidityDays"
          type="number"
          min={1}
          max={90}
          defaultValue={settings.quoteValidityDays}
          className="max-w-40"
        />
        <p className="text-xs text-muted-foreground">
          How many days a prepared quote stays valid before it expires. Applies to newly prepared
          quotes and to manual expiry extensions.
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="minMarginWarningPercent">Minimum margin warning (%)</Label>
        <Input
          id="minMarginWarningPercent"
          name="minMarginWarningPercent"
          type="number"
          min={0}
          max={100}
          step="0.1"
          defaultValue={settings.minMarginWarningPercent}
          className="max-w-40"
        />
        <p className="text-xs text-muted-foreground">
          Requests priced below this gross margin are flagged in the pricing panel.
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="defaultMaterial">Default material</Label>
        <select
          id="defaultMaterial"
          name="defaultMaterial"
          defaultValue={settings.defaultMaterial}
          className="h-9 max-w-40 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          {MATERIALS.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
        <p className="text-xs text-muted-foreground">Pre-selected material on the public quote form.</p>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="supportEmail">Support email</Label>
        <Input id="supportEmail" name="supportEmail" type="email" defaultValue={settings.supportEmail} className="max-w-80" />
        <p className="text-xs text-muted-foreground">Shown to customers in quote-ready emails.</p>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="companyDisplayName">Company display name</Label>
        <Input
          id="companyDisplayName"
          name="companyDisplayName"
          defaultValue={settings.companyDisplayName}
          className="max-w-80"
        />
        <p className="text-xs text-muted-foreground">Used in the signature of quote-ready emails.</p>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <PctField name="targetMarginPercent" label="Target margin %" defaultValue={settings.targetMarginPercent} />
        <PctField name="highMarginPercent" label="High margin %" defaultValue={settings.highMarginPercent} />
        <PctField name="contingencyPercent" label="Contingency %" defaultValue={settings.contingencyPercent} />
        <PctField
          name="paymentProcessingFeePercent"
          label="Payment processing %"
          defaultValue={settings.paymentProcessingFeePercent}
        />
        <PctField
          name="packagingCostPerOrder"
          label="Packaging € / order"
          defaultValue={settings.packagingCostPerOrder}
          step="0.01"
        />
        <PctField
          name="otherOperationalCostPerOrder"
          label="Other cost € / order"
          defaultValue={settings.otherOperationalCostPerOrder}
          step="0.01"
        />
      </div>
      <p className="-mt-3 text-xs text-muted-foreground">Used by the pricing recommendation on request detail pages.</p>

      {state.status === "error" && (
        <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{state.error}</p>
      )}

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={isPending}>
          {isPending ? "Saving…" : "Save settings"}
        </Button>
        {state.status === "success" && <span className="text-sm text-success">Saved</span>}
      </div>
    </form>
  );
}

function PctField({
  name,
  label,
  defaultValue,
  step = "0.1",
}: {
  name: string;
  label: string;
  defaultValue: number;
  step?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} name={name} type="number" min={0} step={step} defaultValue={defaultValue} />
    </div>
  );
}
