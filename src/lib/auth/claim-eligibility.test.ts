import { describe, it, expect } from "vitest";
import { canClaimGuestRequests } from "./claim-eligibility";

describe("canClaimGuestRequests", () => {
  it("unverified signup (no email_confirmed_at) cannot claim requests", () => {
    expect(canClaimGuestRequests({ email: "a@example.com", email_confirmed_at: null })).toBe(false);
    expect(canClaimGuestRequests({ email: "a@example.com", email_confirmed_at: undefined })).toBe(false);
  });

  it("verified user (email_confirmed_at set) can claim", () => {
    expect(canClaimGuestRequests({ email: "a@example.com", email_confirmed_at: "2026-01-01T00:00:00Z" })).toBe(
      true
    );
  });

  it("session/user with no email at all cannot claim, even if confirmed_at is set", () => {
    expect(canClaimGuestRequests({ email: null, email_confirmed_at: "2026-01-01T00:00:00Z" })).toBe(false);
    expect(canClaimGuestRequests({ email: undefined, email_confirmed_at: "2026-01-01T00:00:00Z" })).toBe(false);
  });

  it("registration session alone is NOT proof of email ownership — confirmed_at must be checked independently", () => {
    // Simulates: signUp() returned a session (e.g. confirmation disabled
    // misconfigured, or a future Supabase behavior change) but the user
    // object itself was never actually confirmed.
    const sessionExists = true;
    const user = { email: "attacker@example.com", email_confirmed_at: null };
    expect(sessionExists && canClaimGuestRequests(user)).toBe(false);
  });
});
