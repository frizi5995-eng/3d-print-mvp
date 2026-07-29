"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Copy, ClipboardCheck, Clock, FileText } from "lucide-react";
import {
  markChecking,
  markWaitingForPartner,
  prepareQuote,
  type ActionResult,
} from "@/app/admin/(protected)/requests/[id]/actions";
import { getAppUrl } from "@/lib/env";
import type { RequestStatus } from "@/types";

/**
 * Condensed version of the same actions on the request detail page — same
 * server actions, same server-side guards. Nothing destructive lives here
 * by design (no decline/status-rollback shortcuts from the list view).
 */
export function QuickActions({
  requestId,
  status,
  hasCustomerPrice,
  quoteToken,
}: {
  requestId: string;
  status: RequestStatus;
  hasCustomerPrice: boolean;
  quoteToken: string | null;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [pendingAction, setPendingAction] = useState<string | null>(null);

  const run = (name: string, action: () => Promise<ActionResult>) => {
    setPendingAction(name);
    startTransition(async () => {
      const result = await action();
      if (!result.ok) toast.error(result.error);
      else {
        toast.success(result.message ?? "Updated.");
        router.refresh();
      }
      setPendingAction(null);
    });
  };

  const copyLink = async () => {
    if (!quoteToken) return;
    await navigator.clipboard.writeText(`${getAppUrl()}/q/${quoteToken}`);
    toast.success("Quote link copied.");
  };

  const canMarkChecking = status === "new";
  const canMarkWaiting = status === "new" || status === "checking";
  const canPrepareQuote = status === "new" || status === "checking" || status === "waiting_for_partner";

  return (
    <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
      {canMarkChecking && (
        <IconButton
          title="Mark checking"
          disabled={isPending}
          onClick={() => run("checking", () => markChecking(requestId))}
        >
          <ClipboardCheck className="size-3.5" />
        </IconButton>
      )}
      {canMarkWaiting && (
        <IconButton
          title="Mark waiting for partner"
          disabled={isPending}
          onClick={() => run("waiting", () => markWaitingForPartner(requestId))}
        >
          <Clock className="size-3.5" />
        </IconButton>
      )}
      {canPrepareQuote && (
        <IconButton
          title={hasCustomerPrice ? "Prepare quote" : "Set a customer price first"}
          disabled={isPending || !hasCustomerPrice}
          onClick={() => run("quote", () => prepareQuote(requestId))}
        >
          <FileText className="size-3.5" />
        </IconButton>
      )}
      {quoteToken && (
        <IconButton title="Copy quote link" disabled={isPending} onClick={copyLink}>
          <Copy className="size-3.5" />
        </IconButton>
      )}
      {pendingAction && <span className="text-xs text-muted-foreground">…</span>}
    </div>
  );
}

function IconButton({
  children,
  title,
  disabled,
  onClick,
}: {
  children: React.ReactNode;
  title: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      disabled={disabled}
      onClick={onClick}
      className="inline-flex size-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-surface-elevated hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
    >
      {children}
    </button>
  );
}
