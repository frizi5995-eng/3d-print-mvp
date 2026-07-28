import "server-only";

/**
 * Resend is only imported when a key is actually configured. This avoids
 * loading the package at all in the common case (no RESEND_API_KEY yet),
 * which also sidesteps `resend`'s Node >=22.12 engine requirement until
 * someone actually enables email — Vercel's configured runtime may not
 * satisfy that today, and this code path isn't exercised until it does.
 */
export async function getResendClient() {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return null;

  const { Resend } = await import("resend");
  return new Resend(apiKey);
}
