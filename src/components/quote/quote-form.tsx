"use client";

import { useActionState, useState } from "react";
import { Minus, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { TurnstileWidget } from "@/components/quote/turnstile-widget";
import { COLORS, MATERIALS } from "@/lib/constants";
import { createManufacturingRequest, type CreateRequestState } from "@/app/(site)/quote/actions";

const initialState: CreateRequestState = {};

export function QuoteForm({ modelId }: { modelId: string }) {
  const [state, formAction, isPending] = useActionState(createManufacturingRequest, initialState);
  const [quantity, setQuantity] = useState(1);
  const [color, setColor] = useState<string>("White");
  const [sizeMode, setSizeMode] = useState<"original" | "custom">("original");
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);

  const fieldError = (name: string) => state.fieldErrors?.[name];

  return (
    <form action={formAction} className="mt-6 flex flex-col gap-8">
      <input type="hidden" name="modelId" value={modelId} />

      <fieldset className="flex flex-col gap-4">
        <legend className="text-sm font-medium text-foreground">Request details</legend>

        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="quantity">Quantity</Label>
            <div className="flex h-8 items-stretch overflow-hidden rounded-lg border border-input">
              <button
                type="button"
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                className="flex w-8 shrink-0 items-center justify-center text-muted-foreground transition-colors hover:bg-surface-elevated hover:text-foreground"
                aria-label="Decrease quantity"
              >
                <Minus className="size-3.5" />
              </button>
              <Input
                id="quantity"
                name="quantity"
                type="number"
                min={1}
                value={quantity}
                onChange={(e) => setQuantity(Math.max(1, Number(e.target.value) || 1))}
                required
                aria-invalid={Boolean(fieldError("quantity"))}
                className="h-full w-full rounded-none border-0 text-center [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
              />
              <button
                type="button"
                onClick={() => setQuantity((q) => q + 1)}
                className="flex w-8 shrink-0 items-center justify-center text-muted-foreground transition-colors hover:bg-surface-elevated hover:text-foreground"
                aria-label="Increase quantity"
              >
                <Plus className="size-3.5" />
              </button>
            </div>
            {fieldError("quantity") && <FieldError message={fieldError("quantity")!} />}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="material">Material</Label>
            <Select name="material" defaultValue="PLA">
              <SelectTrigger id="material" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MATERIALS.map((material) => (
                  <SelectItem key={material} value={material}>
                    {material}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label>Color</Label>
          <input type="hidden" name="colorChoice" value={color} />
          <div className="flex flex-wrap gap-2">
            {COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                className={cn(
                  "flex h-8 items-center gap-2 rounded-lg border px-3 text-sm transition-colors",
                  color === c
                    ? "border-primary bg-primary/10 text-foreground"
                    : "border-input text-muted-foreground hover:bg-surface-elevated hover:text-foreground"
                )}
              >
                {c === "White" && <span className="size-3 rounded-full border border-border-strong bg-white" />}
                {c === "Black" && <span className="size-3 rounded-full border border-border-strong bg-black" />}
                {c}
              </button>
            ))}
          </div>

          {color === "Other" && (
            <Input
              id="colorOther"
              name="colorOther"
              placeholder="e.g. Blue"
              required
              aria-invalid={Boolean(fieldError("colorOther"))}
              className="mt-1"
            />
          )}
          {fieldError("colorOther") && <FieldError message={fieldError("colorOther")!} />}
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium">Desired size</span>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="sizeMode"
                value="original"
                checked={sizeMode === "original"}
                onChange={() => setSizeMode("original")}
                className="size-4 accent-primary"
              />
              Use original model size
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="sizeMode"
                value="custom"
                checked={sizeMode === "custom"}
                onChange={() => setSizeMode("custom")}
                className="size-4 accent-primary"
              />
              Enter a desired size
            </label>
          </div>
          {sizeMode === "custom" && (
            <div className="flex flex-col gap-1.5">
              <Input
                name="desiredSizeCustom"
                placeholder="e.g. 10 cm tall"
                required
                aria-invalid={Boolean(fieldError("desiredSizeCustom"))}
              />
              {fieldError("desiredSizeCustom") && (
                <FieldError message={fieldError("desiredSizeCustom")!} />
              )}
            </div>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="notes">Notes</Label>
          <Textarea
            id="notes"
            name="notes"
            placeholder="Tell us anything important about the part."
            rows={3}
          />
          <p className="text-xs text-muted-foreground">
            Example: &ldquo;It needs to support approximately 2 kg.&rdquo;
          </p>
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-4">
        <legend className="text-sm font-medium text-foreground">Your information</legend>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="customerName">Name</Label>
          <Input
            id="customerName"
            name="customerName"
            required
            aria-invalid={Boolean(fieldError("customerName"))}
          />
          {fieldError("customerName") && <FieldError message={fieldError("customerName")!} />}
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="customerEmail">Email</Label>
            <Input
              id="customerEmail"
              name="customerEmail"
              type="email"
              required
              aria-invalid={Boolean(fieldError("customerEmail"))}
            />
            {fieldError("customerEmail") && <FieldError message={fieldError("customerEmail")!} />}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="customerPhone">Phone</Label>
            <Input id="customerPhone" name="customerPhone" type="tel" />
          </div>
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-4">
        <legend className="text-sm font-medium text-foreground">Location</legend>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="country">Country</Label>
            <Input
              id="country"
              name="country"
              required
              aria-invalid={Boolean(fieldError("country"))}
            />
            {fieldError("country") && <FieldError message={fieldError("country")!} />}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="postalCode">Postal code</Label>
            <Input
              id="postalCode"
              name="postalCode"
              required
              aria-invalid={Boolean(fieldError("postalCode"))}
            />
            {fieldError("postalCode") && <FieldError message={fieldError("postalCode")!} />}
          </div>
        </div>
      </fieldset>

      <input type="hidden" name="turnstileToken" value={turnstileToken ?? ""} />
      <TurnstileWidget onToken={setTurnstileToken} />

      {state.error && (
        <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {state.error}
        </p>
      )}

      <Button type="submit" size="lg" disabled={isPending} className="w-full">
        {isPending ? "Submitting…" : "Request quote"}
      </Button>
    </form>
  );
}

function FieldError({ message }: { message: string }) {
  return <p className="text-xs text-destructive">{message}</p>;
}
