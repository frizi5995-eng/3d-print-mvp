"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { toggleTag } from "@/app/admin/(protected)/requests/[id]/actions";
import { OPERATIONAL_TAGS } from "@/types";

const TAG_LABELS: Record<string, string> = {
  urgent: "Urgent",
  repeat_customer: "Repeat customer",
  complex_model: "Complex model",
  manual_review: "Manual review",
  high_value: "High value",
};

export function TagsEditor({ requestId, initialTags }: { requestId: string; initialTags: string[] }) {
  const [tags, setTags] = useState<string[]>(initialTags);
  const [customTag, setCustomTag] = useState("");
  const [isPending, startTransition] = useTransition();

  const toggle = (tag: string) => {
    const wasActive = tags.includes(tag);
    setTags((prev) => (wasActive ? prev.filter((t) => t !== tag) : [...prev, tag]));
    startTransition(async () => {
      const result = await toggleTag(requestId, tag);
      if (!result.ok) {
        toast.error(result.error);
        setTags((prev) => (wasActive ? [...prev, tag] : prev.filter((t) => t !== tag)));
      }
    });
  };

  const addCustomTag = () => {
    const value = customTag.trim().toLowerCase().replace(/\s+/g, "_").slice(0, 40);
    if (!value) return;
    setCustomTag("");
    toggle(value);
  };

  const customTags = tags.filter((t) => !OPERATIONAL_TAGS.includes(t as (typeof OPERATIONAL_TAGS)[number]));

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-1.5">
        {OPERATIONAL_TAGS.map((tag) => (
          <TagChip key={tag} active={tags.includes(tag)} disabled={isPending} onClick={() => toggle(tag)}>
            {TAG_LABELS[tag]}
          </TagChip>
        ))}
        {customTags.map((tag) => (
          <TagChip key={tag} active disabled={isPending} onClick={() => toggle(tag)}>
            {tag}
          </TagChip>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <input
          value={customTag}
          onChange={(e) => setCustomTag(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addCustomTag();
            }
          }}
          placeholder="Custom tag"
          className="h-7 w-32 rounded-md border border-input bg-transparent px-2 text-xs outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50"
        />
        <button
          type="button"
          onClick={addCustomTag}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          Add
        </button>
      </div>
    </div>
  );
}

function TagChip({
  children,
  active,
  disabled,
  onClick,
}: {
  children: React.ReactNode;
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "rounded-full border px-2.5 py-1 text-xs transition-colors disabled:opacity-50",
        active
          ? "border-primary bg-primary/10 text-foreground"
          : "border-input text-muted-foreground hover:bg-surface-elevated"
      )}
    >
      {children}
    </button>
  );
}
