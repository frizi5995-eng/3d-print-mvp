"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { useDropzone, type FileRejection } from "react-dropzone";
import { toast } from "sonner";
import { UploadCloud, Loader2, FileBox } from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { ALLOWED_MODEL_EXTENSIONS, MAX_MODEL_FILE_SIZE_BYTES } from "@/lib/constants";
import { getModelExtension } from "@/lib/model-file";
import { createModelUploadTicket, confirmModelUpload } from "@/app/(site)/upload/actions";

const MAX_MB = Math.round(MAX_MODEL_FILE_SIZE_BYTES / (1024 * 1024));

export function ModelDropzone() {
  const router = useRouter();
  const [status, setStatus] = useState<"idle" | "uploading">("idle");
  const [activeFilename, setActiveFilename] = useState<string | null>(null);

  const uploadFile = useCallback(
    async (file: File) => {
      if (!getModelExtension(file.name)) {
        toast.error(`Unsupported file type. Please upload ${ALLOWED_MODEL_EXTENSIONS.join(", ").toUpperCase()}.`);
        return;
      }
      if (file.size > MAX_MODEL_FILE_SIZE_BYTES) {
        toast.error(`File is too large. Maximum size is ${MAX_MB} MB.`);
        return;
      }

      setStatus("uploading");
      setActiveFilename(file.name);

      try {
        const ticketResult = await createModelUploadTicket(file.name, file.size);
        if (!ticketResult.ok) {
          toast.error(ticketResult.error);
          return;
        }
        const ticket = ticketResult.data;

        const supabase = createClient();
        const { error: uploadError } = await supabase.storage
          .from("models")
          .uploadToSignedUrl(ticket.path, ticket.token, file, {
            contentType: ticket.contentType,
          });

        if (uploadError) {
          toast.error("Upload failed. Please try again.");
          return;
        }

        const confirmResult = await confirmModelUpload(
          { modelId: ticket.modelId, path: ticket.path },
          file.name,
          file.size
        );
        if (!confirmResult.ok) {
          toast.error(confirmResult.error);
          return;
        }

        router.push(`/quote?model=${confirmResult.data.modelId}`);
      } catch {
        toast.error("Something went wrong. Please try again.");
      } finally {
        setStatus("idle");
        setActiveFilename(null);
      }
    },
    [router]
  );

  const onDrop = useCallback(
    (accepted: File[], rejected: FileRejection[]) => {
      if (rejected.length > 0) {
        toast.error(`Unsupported file type. Please upload ${ALLOWED_MODEL_EXTENSIONS.join(", ").toUpperCase()}.`);
        return;
      }
      const file = accepted[0];
      if (file) void uploadFile(file);
    },
    [uploadFile]
  );

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    onDrop,
    multiple: false,
    disabled: status === "uploading",
    maxSize: MAX_MODEL_FILE_SIZE_BYTES,
  });

  const uploading = status === "uploading";

  return (
    <div
      {...getRootProps({
        id: "upload",
        className: cn(
          "group flex w-full flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-border-strong bg-surface-elevated px-6 py-16 text-center transition-colors",
          isDragActive && "border-primary bg-primary/[0.07]",
          uploading && "pointer-events-none opacity-80"
        ),
      })}
    >
      <input {...getInputProps()} />

      {uploading ? (
        <>
          <Loader2 className="size-8 animate-spin text-primary" />
          <p className="text-base font-medium">Uploading {activeFilename}…</p>
          <p className="text-sm text-muted-foreground">This can take a moment for larger files.</p>
        </>
      ) : (
        <>
          <div className="flex size-14 items-center justify-center rounded-full bg-accent text-primary">
            {isDragActive ? <UploadCloud className="size-6" /> : <FileBox className="size-6" />}
          </div>
          <p className="text-base font-medium">
            {isDragActive ? "Drop your model here" : "Drag your model here"}
          </p>
          <p className="text-sm text-muted-foreground">
            {ALLOWED_MODEL_EXTENSIONS.map((ext) => ext.toUpperCase()).join(" · ")} · up to {MAX_MB} MB
          </p>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              open();
            }}
            className="mt-2 inline-flex h-8 items-center justify-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary-hover"
          >
            Choose file
          </button>
        </>
      )}
    </div>
  );
}
