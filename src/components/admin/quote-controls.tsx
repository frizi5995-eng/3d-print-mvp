"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { resendQuoteEmail, extendQuoteExpiry } from "@/app/admin/(protected)/requests/[id]/actions";
import type { RequestStatus } from "@/types";

export function QuoteControls({ requestId, status }: { requestId: string; status: RequestStatus }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [pendingAction, setPendingAction] = useState<string | null>(null);

  if (status !== "quote_ready" && status !== "quote_sent") return null;

  const run = (name: string, action: () => Promise<{ ok: boolean; error?: string; message?: string }>) => {
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

  return (
    <div className="flex flex-wrap gap-2">
      <Button
        size="sm"
        variant="outline"
        disabled={isPending}
        onClick={() => run("resend", () => resendQuoteEmail(requestId))}
      >
        {pendingAction === "resend" ? "Sending…" : "Resend quote email"}
      </Button>
      <Button
        size="sm"
        variant="outline"
        disabled={isPending}
        onClick={() => run("extend", () => extendQuoteExpiry(requestId))}
      >
        {pendingAction === "extend" ? "Extending…" : "Extend quote expiry"}
      </Button>
    </div>
  );
}
