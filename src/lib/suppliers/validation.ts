// Pure validation/selection rules — no DB, no "server-only".

import type { SupplierQuoteSource, SupplierQuoteStatus } from "@/types";

export interface SupplierInput {
  name: string;
  country: string;
  website: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  notes: string | null;
  technologies: string[];
  materials: string[];
  api_provider: string | null;
  api_enabled: boolean;
  preferred: boolean;
  reliability_score: number | null;
}

export function validateSupplierInput(input: SupplierInput): string[] {
  const errors: string[] = [];
  if (!input.name.trim()) errors.push("Name is required.");
  if (!input.country.trim()) errors.push("Country is required.");
  if (input.contact_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.contact_email)) {
    errors.push("Contact email must be a valid email address.");
  }
  if (
    input.reliability_score !== null &&
    (!Number.isFinite(input.reliability_score) || input.reliability_score < 0 || input.reliability_score > 10)
  ) {
    errors.push("Reliability score must be between 0 and 10.");
  }
  if (input.api_enabled && !input.api_provider) {
    errors.push("An API provider is required when API integration is enabled.");
  }
  return errors;
}

export interface SupplierQuoteInput {
  supplier_id: string;
  manufacturing_cost: number;
  supplier_shipping_cost: number;
  other_cost: number;
  lead_time_days_min: number | null;
  lead_time_days_max: number | null;
  valid_until: string | null;
  source: SupplierQuoteSource;
  external_quote_id: string | null;
  notes: string | null;
}

export function validateSupplierQuoteInput(input: SupplierQuoteInput): string[] {
  const errors: string[] = [];
  if (!input.supplier_id) errors.push("Supplier is required.");
  if (!Number.isFinite(input.manufacturing_cost) || input.manufacturing_cost < 0) {
    errors.push("Manufacturing cost must be a non-negative number.");
  }
  if (!Number.isFinite(input.supplier_shipping_cost) || input.supplier_shipping_cost < 0) {
    errors.push("Supplier shipping cost must be a non-negative number.");
  }
  if (!Number.isFinite(input.other_cost) || input.other_cost < 0) {
    errors.push("Other cost must be a non-negative number.");
  }
  if (
    input.lead_time_days_min !== null &&
    input.lead_time_days_max !== null &&
    input.lead_time_days_min > input.lead_time_days_max
  ) {
    errors.push("Minimum lead time can't be greater than maximum lead time.");
  }
  return errors;
}

/** True only when a provider API explicitly confirms pricing — never inferred. */
export function isConfirmedSupplierQuote(source: SupplierQuoteSource): boolean {
  return source === "api_confirmed";
}

/**
 * A quote is selectable only if it belongs to the request being edited and
 * hasn't been rejected. Ownership (request_id match) still must be
 * re-checked against the DB by the caller — this only encodes the rule
 * itself so it's identical wherever it's applied and independently testable.
 */
export function canSelectSupplierQuote(
  quote: { request_id: string; status: SupplierQuoteStatus },
  requestId: string
): boolean {
  return quote.request_id === requestId && quote.status !== "rejected";
}
