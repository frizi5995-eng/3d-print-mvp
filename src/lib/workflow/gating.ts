// Pure workflow/gating rules — no DB, no "server-only", unit-testable.
// src/app/admin/(protected)/requests/[id]/actions.ts is the DB-touching
// caller; this module is the single source of truth for the rules
// themselves so they can't drift between the pre-check and the guarded
// UPDATE's WHERE clause.

import type { PaymentStatus, RequestStatus } from "@/types";

/**
 * The post-acceptance operational workflow, plus one-step-back corrections
 * only (never an arbitrary jump) so status management stays predictable.
 * quote_ready/quote_sent are deliberately excluded — those go through
 * prepareQuote(), which does more than flip a status column.
 */
export const WORKFLOW_TRANSITIONS: Partial<Record<RequestStatus, RequestStatus[]>> = {
  accepted: ["manufacturing"],
  manufacturing: ["shipped", "accepted"],
  shipped: ["completed", "manufacturing"],
  completed: ["shipped"],
};

export function isTransitionAllowed(current: RequestStatus, next: RequestStatus): boolean {
  return (WORKFLOW_TRANSITIONS[current] ?? []).includes(next);
}

/** True only for the one transition that must never happen on an unpaid order. */
export function isPaymentGatedTransition(current: RequestStatus, next: RequestStatus): boolean {
  return current === "accepted" && next === "manufacturing";
}

export function isManufacturingBlockedByPayment(
  current: RequestStatus,
  next: RequestStatus,
  paymentStatus: PaymentStatus
): boolean {
  return isPaymentGatedTransition(current, next) && paymentStatus !== "paid";
}
