"use client";

import { useEffect, useState, useTransition, useActionState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  createInvoiceAction,
  resendInvoiceAction,
  markPaymentPaidManually,
  type MarkPaidFormState,
} from "@/app/admin/(protected)/requests/[id]/payment-actions";
import type { ActionResult } from "@/app/admin/(protected)/requests/[id]/actions";
import type { PaymentStatus } from "@/types";

const markPaidInitialState: MarkPaidFormState = { status: "idle" };

export function PaymentActions({
  requestId,
  paymentStatus,
  hasInvoice,
  stripeConfigured,
}: {
  requestId: string;
  paymentStatus: PaymentStatus;
  hasInvoice: boolean;
  stripeConfigured: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [showManualOverride, setShowManualOverride] = useState(false);

  const run = (name: string, action: () => Promise<ActionResult>) => {
    setPendingAction(name);
    startTransition(async () => {
      const result = await action();
      if (!result.ok) toast.error(result.error);
      else {
        toast.success(result.message ?? "Done.");
        router.refresh();
      }
      setPendingAction(null);
    });
  };

  const [markPaidState, markPaidFormAction, markPaidPending] = useActionState(
    markPaymentPaidManually,
    markPaidInitialState
  );

  useEffect(() => {
    if (markPaidState.status === "success") {
      toast.success("Marked as paid.");
      router.refresh();
      // No need to setShowManualOverride(false) here: once the refreshed
      // paymentStatus prop comes back "paid", canMarkPaidManually below
      // becomes false and this whole form unmounts on its own.
    }
  }, [markPaidState, router]);

  if (!stripeConfigured) {
    return (
      <p className="text-sm text-muted-foreground">
        Stripe isn&apos;t configured. Add STRIPE_SECRET_KEY to enable invoicing.
      </p>
    );
  }

  const canCreate = !hasInvoice;
  const canResend = hasInvoice && (paymentStatus === "invoice_sent" || paymentStatus === "payment_failed");
  const canMarkPaidManually = paymentStatus !== "paid" && paymentStatus !== "refunded";

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        {canCreate && (
          <Button disabled={isPending} onClick={() => run("create", () => createInvoiceAction(requestId))}>
            {pendingAction === "create" ? "Creating…" : "Create/send invoice"}
          </Button>
        )}
        {canResend && (
          <Button
            variant="outline"
            disabled={isPending}
            onClick={() => run("resend", () => resendInvoiceAction(requestId))}
          >
            {pendingAction === "resend" ? "Resending…" : "Resend invoice"}
          </Button>
        )}
      </div>

      {canMarkPaidManually && !showManualOverride && (
        <button
          type="button"
          onClick={() => setShowManualOverride(true)}
          className="w-fit text-xs text-muted-foreground underline decoration-dotted hover:text-foreground"
        >
          Mark paid manually (offline payment)
        </button>
      )}

      {showManualOverride && (
        <form action={markPaidFormAction} className="flex flex-col gap-2 rounded-lg border border-border bg-surface-elevated p-3">
          <input type="hidden" name="requestId" value={requestId} />
          <p className="text-xs font-medium text-warning">
            Manual override — use only for a real offline payment (bank transfer, cash). This is
            logged with your account and the reason you give below.
          </p>
          <Textarea
            name="note"
            placeholder="Reason (required) — e.g. &quot;Paid by bank transfer, confirmed 2026-07-29&quot;"
            rows={2}
            required
          />
          {markPaidState.status === "error" && (
            <p className="text-xs text-destructive">{markPaidState.error}</p>
          )}
          <div className="flex gap-2">
            <Button type="submit" size="sm" variant="outline" disabled={markPaidPending}>
              {markPaidPending ? "Confirming…" : "Confirm paid"}
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setShowManualOverride(false)}>
              Cancel
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
