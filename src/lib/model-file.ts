import type { ModelFileType } from "@/types";
import { ALLOWED_MODEL_EXTENSIONS } from "@/lib/constants";

/** Content type we force on upload/download — never trust the browser's guess. */
export const MODEL_CONTENT_TYPES: Record<ModelFileType, string> = {
  stl: "model/stl",
  obj: "text/plain",
  "3mf": "model/3mf",
};

export function getModelExtension(filename: string): ModelFileType | null {
  const match = /\.([a-z0-9]+)$/i.exec(filename.trim());
  const ext = match?.[1]?.toLowerCase();
  if (!ext) return null;
  return (ALLOWED_MODEL_EXTENSIONS as string[]).includes(ext) ? (ext as ModelFileType) : null;
}

/** Strips path components and anything that isn't safe in a storage key or download header. */
export function sanitizeFilename(filename: string): string {
  const base = filename.trim().split(/[/\\]/).pop() || "model";
  const cleaned = base.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/-{2,}/g, "-");
  const trimmed = cleaned.replace(/^[.-]+/, "") || "model";
  return trimmed.slice(0, 120);
}
