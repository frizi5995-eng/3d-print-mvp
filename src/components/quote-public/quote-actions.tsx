"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { DECLINE_REASON_LABELS } from "@/lib/constants";
import { acceptQuote, declineQuote } from "@/app/q/[token]/actions";
import type { DeclineReason } from "@/types";

const DECLINE_REASONS = Object.keys(DECLINE_REASON_LABELS) as DeclineReason[];

export function QuoteActions({ token }: { token: string }) {
  const [showDecline, setShowDecline] = useState(false);
  const [reason, setReason] = useState<DeclineReason | "">("");

  if (showDecline) {
    return (
      <form action={declineQuote.bind(null, token)} className="flex flex-col gap-4">
        <fieldset>
          <legend className="text-sm font-medium">Why are you declining? (optional)</legend>
          <div className="mt-2 flex flex-col gap-2">
            {DECLINE_REASONS.map((value) => (
              <label key={value} className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="reason"
                  value={value}
                  checked={reason === value}
                  onChange={() => setReason(value)}
                  className="size-4 accent-primary"
                />
                {DECLINE_REASON_LABELS[value]}
              </label>
            ))}
          </div>
          {reason === "other" && (
            <Textarea
              name="reasonOther"
              placeholder="Tell us more (optional)"
              rows={2}
              aria-label="Additional details"
              className="mt-2"
            />
          )}
        </fieldset>

        <div className="flex gap-3">
          <DeclineSubmitButton />
          <Button type="button" variant="outline" onClick={() => setShowDecline(false)}>
            Cancel
          </Button>
        </div>
      </form>
    );
  }

  return (
    <div className="flex gap-3">
      <form action={acceptQuote.bind(null, token)} className="flex-1">
        <AcceptSubmitButton />
      </form>
      <Button type="button" variant="outline" onClick={() => setShowDecline(true)}>
        Decline quote
      </Button>
    </div>
  );
}

function AcceptSubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" disabled={pending} className="w-full">
      {pending ? "Accepting…" : "Accept quote"}
    </Button>
  );
}

function DeclineSubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="outline" disabled={pending}>
      {pending ? "Submitting…" : "Confirm decline"}
    </Button>
  );
}
