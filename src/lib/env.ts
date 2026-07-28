/**
 * This app's own public origin, for building absolute URLs (e.g. quote links
 * in future emails) that work the same locally and once deployed. Set
 * NEXT_PUBLIC_APP_URL in Vercel to the production domain once it's known —
 * never hardcode a deployment URL here.
 */
export function getAppUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
}
