"use client";

import { useActionState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { updateInternalNotes, type NotesFormState } from "@/app/admin/(protected)/requests/[id]/actions";

const initialState: NotesFormState = { status: "idle" };

export function InternalNotes({ requestId, initialNotes }: { requestId: string; initialNotes: string }) {
  const [state, formAction, isPending] = useActionState(updateInternalNotes, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <input type="hidden" name="requestId" value={requestId} />
      <Textarea
        name="notes"
        defaultValue={initialNotes}
        placeholder="Internal notes — never shown to the customer."
        rows={4}
      />
      {state.status === "error" && <p className="text-xs text-destructive">{state.error}</p>}
      <div className="flex items-center gap-3">
        <Button type="submit" size="sm" variant="outline" disabled={isPending}>
          {isPending ? "Saving…" : "Save notes"}
        </Button>
        {state.status === "success" && <span className="text-xs text-success">Saved</span>}
      </div>
    </form>
  );
}
