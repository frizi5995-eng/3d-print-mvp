import "server-only";

const VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export function isTurnstileConfigured(): boolean {
  return Boolean(process.env.TURNSTILE_SECRET_KEY);
}

/**
 * Returns true (allow) whenever Turnstile isn't configured — this must
 * never block production while TURNSTILE_SECRET_KEY is unset. Once
 * configured, a missing/invalid token fails closed; a network error
 * talking to Cloudflare itself fails open, so a Cloudflare outage never
 * blocks legitimate customers.
 */
export async function verifyTurnstileToken(token: string | null): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return true;
  if (!token) return false;

  try {
    const response = await fetch(VERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ secret, response: token }),
    });
    const data: { success?: boolean } = await response.json();
    return data.success === true;
  } catch {
    return true;
  }
}
