"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  markChecking,
  markWaitingForPartner,
  prepareQuote,
  type ActionResult,
} from "@/app/admin/(protected)/requests/[id]/actions";
import type { RequestStatus } from "@/types";

export function StatusActions({
  requestId,
  status,
  hasCustomerPrice,
}: {
  requestId: string;
  status: RequestStatus;
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
        toast.success("Request updated.");
        router.refresh();
      }
      setPendingAction(null);
    });
  };

  const canMarkChecking = status === "new";
  const canMarkWaiting = status === "new" || status === "checking";
  const canPrepareQuote = status === "new" || status === "checking" || status === "waiting_for_partner";

  if (!canMarkChecking && !canMarkWaiting && !canPrepareQuote) return null;

  return (
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
    </div>
  );
}
