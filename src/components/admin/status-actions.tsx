"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  markChecking,
  markWaitingForPartner,
  prepareQuote,
  changeRequestStatus,
  NEXT_ACTION_LABELS,
  type ActionResult,
} from "@/app/admin/(protected)/requests/[id]/actions";
import { STATUS_LABELS } from "@/lib/constants";
import type { PaymentStatus, RequestStatus } from "@/types";

// One step back only, mirrors WORKFLOW_TRANSITIONS server-side (that map is
// the real guard; this is just what the UI offers).
const BACKWARD_CORRECTION: Partial<Record<RequestStatus, RequestStatus>> = {
  manufacturing: "accepted",
  shipped: "manufacturing",
  completed: "shipped",
};

export function StatusActions({
  requestId,
  status,
  paymentStatus,
  hasCustomerPrice,
}: {
  requestId: string;
  status: RequestStatus;
  paymentStatus: PaymentStatus;
  hasCustomerPrice: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [pendingAction, setPendingAction] = useState<string | null>(null);

  const run = (name: string, action: () => Promise<ActionResult>) => {
    setPendingAction(name);
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        toast.error(result.error);
      } else {
        toast.success(result.message ?? "Request updated.");
        router.refresh();
      }
      setPendingAction(null);
    });
  };

  const canMarkChecking = status === "new";
  const canMarkWaiting = status === "new" || status === "checking";
  const canPrepareQuote = status === "new" || status === "checking" || status === "waiting_for_partner";
  const nextAction = NEXT_ACTION_LABELS[status];
  const nextStatus: RequestStatus | undefined =
    status === "accepted" ? "manufacturing" : status === "manufacturing" ? "shipped" : status === "shipped" ? "completed" : undefined;
  const backTo = BACKWARD_CORRECTION[status];
  const blockedByPayment = status === "accepted" && nextStatus === "manufacturing" && paymentStatus !== "paid";

  if (!canMarkChecking && !canMarkWaiting && !canPrepareQuote && !nextAction && !backTo) return null;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        {canMarkChecking && (
          <Button
            variant="outline"
            disabled={isPending}
            onClick={() => run("checking", () => markChecking(requestId))}
          >
            {pendingAction === "checking" ? "Marking…" : "Mark checking"}
          </Button>
        )}
        {canMarkWaiting && (
          <Button
            variant="outline"
            disabled={isPending}
            onClick={() => run("waiting", () => markWaitingForPartner(requestId))}
          >
            {pendingAction === "waiting" ? "Marking…" : "Mark waiting for partner"}
          </Button>
        )}
        {canPrepareQuote && (
          <Button
            disabled={isPending || !hasCustomerPrice}
            title={!hasCustomerPrice ? "Set a customer price first" : undefined}
            onClick={() => run("quote", () => prepareQuote(requestId))}
          >
            {pendingAction === "quote" ? "Preparing…" : "Prepare quote"}
          </Button>
        )}
        {nextAction && nextStatus && (
          <Button
            disabled={isPending || blockedByPayment}
            title={blockedByPayment ? "Payment must be confirmed before manufacturing can start" : undefined}
            onClick={() => run("workflow", () => changeRequestStatus(requestId, nextStatus))}
          >
            {pendingAction === "workflow" ? "Updating…" : nextAction}
          </Button>
        )}
      </div>
      {blockedByPayment && (
        <p className="text-xs text-muted-foreground">
          Waiting on payment before manufacturing can start — see the Payment panel.
        </p>
      )}

      {backTo && (
        <button
          type="button"
          disabled={isPending}
          onClick={() => run("revert", () => changeRequestStatus(requestId, backTo))}
          className="w-fit text-xs text-muted-foreground underline decoration-dotted hover:text-foreground disabled:opacity-50"
        >
          {pendingAction === "revert" ? "Reverting…" : `Revert to ${STATUS_LABELS[backTo]}`}
        </button>
      )}
    </div>
  );
}
