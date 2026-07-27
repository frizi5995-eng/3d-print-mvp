"use server";

import { randomUUID } from "crypto";
import { createServiceClient } from "@/lib/supabase/server";
import {
  MODEL_CONTENT_TYPES,
  MODEL_STORAGE_BUCKET,
  sanitizeFilename,
  validateModelFileMeta,
} from "@/lib/models";

type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string };

export interface ModelUploadTicket {
  modelId: string;
  path: string;
  token: string;
  contentType: string;
}

/**
 * Validates the file the client wants to upload and mints a signed upload
 * URL for it. No database row exists yet — that's created in
 * `confirmModelUpload` once the file has actually landed in storage, so a
 * failed/abandoned upload never leaves an orphaned model row behind.
 */
export async function createModelUploadTicket(
  filename: string,
  fileSize: number
): Promise<ActionResult<ModelUploadTicket>> {
  const validation = validateModelFileMeta(filename, fileSize);
  if (!validation.ok) {
    return { ok: false, error: validation.error };
  }

  const modelId = randomUUID();
  const safeName = sanitizeFilename(filename);
  const path = `${modelId}/${safeName}`;

  const supabase = createServiceClient();
  const { data, error } = await supabase.storage
    .from(MODEL_STORAGE_BUCKET)
    .createSignedUploadUrl(path);

  if (error || !data) {
    return { ok: false, error: "Could not prepare upload. Please try again." };
  }

  return {
    ok: true,
    data: {
      modelId,
      path,
      token: data.token,
      contentType: MODEL_CONTENT_TYPES[validation.fileType],
    },
  };
}

/**
 * Called after the client has successfully PUT the file to the signed URL.
 * Re-validates the same metadata and, on the trust of the just-consumed
 * upload token, records the model row.
 */
export async function confirmModelUpload(
  ticket: Pick<ModelUploadTicket, "modelId" | "path">,
  filename: string,
  fileSize: number
): Promise<ActionResult<{ modelId: string }>> {
  const validation = validateModelFileMeta(filename, fileSize);
  if (!validation.ok) {
    return { ok: false, error: validation.error };
  }

  const safeName = sanitizeFilename(filename);
  const expectedPath = `${ticket.modelId}/${safeName}`;
  if (ticket.path !== expectedPath) {
    return { ok: false, error: "Upload did not match the requested file." };
  }

  const supabase = createServiceClient();
  const { error } = await supabase.from("models").insert({
    id: ticket.modelId,
    filename: safeName,
    storage_path: ticket.path,
    file_type: validation.fileType,
    file_size: fileSize,
  });

  if (error) {
    return { ok: false, error: "Could not save the uploaded model. Please try again." };
  }

  return { ok: true, data: { modelId: ticket.modelId } };
}
