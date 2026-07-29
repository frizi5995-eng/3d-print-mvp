// Pure eligibility check — no DB, no "server-only", unit-testable.
//
// A guest request may only be claimed once Supabase has cryptographic
// evidence the user actually owns the email address: user.email_confirmed_at
// is set only after a real confirmation link/OTP was verified (or, in a
// project with email confirmation disabled, Supabase auto-confirms it at
// signup — either way it's Supabase's own signal, never something derived
// from "a session exists" or a client-supplied value).

export interface ClaimableUser {
  email?: string | null;
  email_confirmed_at?: string | null;
}

export function canClaimGuestRequests(user: ClaimableUser): user is { email: string; email_confirmed_at: string } {
  return Boolean(user.email) && Boolean(user.email_confirmed_at);
}
