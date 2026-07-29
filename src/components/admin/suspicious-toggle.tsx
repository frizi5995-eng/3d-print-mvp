"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { setSuspicious } from "@/app/admin/(protected)/requests/[id]/actions";

export function SuspiciousToggle({
  requestId,
  isSuspicious,
  spamReason,
}: {
  requestId: string;
  isSuspicious: boolean;
  spamReason: string | null;
}) {
  const router = useRouter();
  const [showReasonInput, setShowReasonInput] = useState(false);
  const [reason, setReason] = useState("");
  const [isPending, startTransition] = useTransition();

  const flag = () => {
    startTransition(async () => {
      const result = await setSuspicious(requestId, true, reason);
      if (!result.ok) toast.error(result.error);
      else {
        toast.success(result.message);
        setShowReasonInput(false);
        router.refresh();
      }
    });
  };

  const unflag = () => {
    startTransition(async () => {
      const result = await setSuspicious(requestId, false);
      if (!result.ok) toast.error(result.error);
      else {
        toast.success(result.message);
        router.refresh();
      }
    });
  };

  if (isSuspicious) {
    return (
      <div className="flex flex-col gap-1.5">
        {spamReason && <p className="text-xs text-muted-foreground">Reason: {spamReason}</p>}
        <Button size="sm" variant="outline" disabled={isPending} onClick={unflag} className="w-fit">
          Remove suspicious flag
        </Button>
      </div>
    );
  }

  if (showReasonInput) {
    return (
      <div className="flex flex-col gap-2">
        <Textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Reason (optional)"
          rows={2}
        />
        <div className="flex gap-2">
          <Button size="sm" variant="outline" disabled={isPending} onClick={flag}>
            Confirm flag
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setShowReasonInput(false)}>
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  return (
    <Button size="sm" variant="outline" className="w-fit" onClick={() => setShowReasonInput(true)}>
      Flag as suspicious
    </Button>
  );
}
