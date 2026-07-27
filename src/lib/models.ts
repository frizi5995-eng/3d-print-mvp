import "server-only";
import { MAX_MODEL_FILE_SIZE_BYTES } from "@/lib/constants";
import { getModelExtension } from "@/lib/model-file";

export const MODEL_STORAGE_BUCKET = "models";

export function validateModelFileMeta(filename: string, fileSize: number) {
  const fileType = getModelExtension(filename);
  if (!fileType) {
    return {
      ok: false as const,
      error: "Unsupported file type. Please upload STL, OBJ, or 3MF.",
    };
  }
  if (!Number.isFinite(fileSize) || fileSize <= 0) {
    return { ok: false as const, error: "Invalid file size." };
  }
  if (fileSize > MAX_MODEL_FILE_SIZE_BYTES) {
    const maxMb = Math.round(MAX_MODEL_FILE_SIZE_BYTES / (1024 * 1024));
    return { ok: false as const, error: `File is too large. Maximum size is ${maxMb} MB.` };
  }
  return { ok: true as const, fileType };
}

export { sanitizeFilename, MODEL_CONTENT_TYPES } from "@/lib/model-file";
