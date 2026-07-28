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
