export type RequestStatus =
  | "new"
  | "checking"
  | "waiting_for_partner"
  | "quote_ready"
  | "quote_sent"
  | "accepted"
  | "declined"
  | "manufacturing"
  | "shipped"
  | "completed";

export type ModelFileType = "stl" | "obj" | "3mf";

export type DeclineReason =
  | "price_too_high"
  | "delivery_too_expensive"
  | "changed_mind"
  | "needs_model_changes"
  | "other";

/**
 * Independent of RequestStatus — a request being "accepted" and a payment
 * being "paid" are different facts. Never derive one from the other.
 */
export type PaymentStatus = "unpaid" | "invoice_sent" | "paid" | "payment_failed" | "refunded";

export interface Model {
  id: string;
  filename: string;
  storage_path: string;
  file_type: ModelFileType;
  file_size: number;
  width: number | null;
  height: number | null;
  depth: number | null;
  created_at: string;
}

export interface ManufacturingRequest {
  id: string;
  reference_number: number;
  status: RequestStatus;

  customer_name: string;
  customer_email: string;
  customer_phone: string | null;

  country: string;
  postal_code: string;

  quantity: number;
  material: string;
  color: string;
  desired_size: string | null;
  notes: string | null;

  model_id: string;

  manufacturer_name: string | null;
  production_cost: number | null;
  production_shipping_cost: number | null;
  other_cost: number | null;

  customer_manufacturing_price: number | null;
  customer_shipping_price: number | null;

  decline_reason: DeclineReason | null;
  decline_reason_other: string | null;

  quote_token: string | null;
  quote_expires_at: string | null;

  customer_user_id: string | null;
  submission_ip_hash: string | null;
  is_suspicious: boolean;
  spam_reason: string | null;
  internal_notes: string | null;
  tags: string[];

  payment_status: PaymentStatus;
  stripe_customer_id: string | null;
  stripe_invoice_id: string | null;
  stripe_payment_intent_id: string | null;
  paid_at: string | null;
  selected_supplier_quote_id: string | null;

  production_started_at: string | null;
  estimated_completion_at: string | null;
  actual_completion_at: string | null;
  production_notes: string | null;
  external_supplier_reference: string | null;

  created_at: string;
  updated_at: string;
}

export interface StatusHistoryEntry {
  id: string;
  request_id: string;
  status: RequestStatus;
  created_at: string;
}

export interface ManufacturingRequestWithModel extends ManufacturingRequest {
  model: Model;
}

export const SUPPLIER_TECHNOLOGIES = ["FDM", "SLA", "SLS", "MJF", "DMLS_METAL", "OTHER"] as const;
export type SupplierTechnology = (typeof SUPPLIER_TECHNOLOGIES)[number];

export interface Supplier {
  id: string;
  name: string;
  country: string;
  website: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  active: boolean;
  notes: string | null;
  technologies: string[];
  materials: string[];
  api_provider: string | null;
  api_enabled: boolean;
  preferred: boolean;
  reliability_score: number | null;
  created_at: string;
  updated_at: string;
}

export type SupplierQuoteSource = "manual" | "api_estimate" | "api_confirmed";
export type SupplierQuoteStatus = "active" | "rejected" | "expired";

export interface SupplierQuote {
  id: string;
  request_id: string;
  supplier_id: string;
  manufacturing_cost: number;
  supplier_shipping_cost: number;
  other_cost: number;
  currency: string;
  lead_time_days_min: number | null;
  lead_time_days_max: number | null;
  valid_until: string | null;
  source: SupplierQuoteSource;
  status: SupplierQuoteStatus;
  external_quote_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface AdminActivityLogEntry {
  id: string;
  admin_email: string;
  action: string;
  request_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export const OPERATIONAL_TAGS = [
  "urgent",
  "repeat_customer",
  "complex_model",
  "manual_review",
  "high_value",
] as const;
export type OperationalTag = (typeof OPERATIONAL_TAGS)[number];
