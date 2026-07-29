// Pure — no DB, no "server-only". Prevents open-redirect via a "next" param:
// only an internal, single-leading-slash path is allowed. Anything else
// (absolute URL, protocol-relative "//evil.com", "javascript:", missing
// leading slash) falls back to /account.

const SAFE_FALLBACK = "/account";

export function sanitizeNextPath(next: string | null | undefined): string {
  if (!next) return SAFE_FALLBACK;
  if (!next.startsWith("/")) return SAFE_FALLBACK;
  if (next.startsWith("//")) return SAFE_FALLBACK;
  if (next.includes("://")) return SAFE_FALLBACK;
  // Backslashes are browser-normalized to forward slashes by some parsers —
  // treat "/\evil.com" the same as "//evil.com".
  if (next.includes("\\")) return SAFE_FALLBACK;
  return next;
}
