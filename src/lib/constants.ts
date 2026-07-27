import type { DeclineReason, ModelFileType, RequestStatus } from "@/types";

export const MATERIALS = ["PLA", "Not sure"] as const;

export const COLORS = ["White", "Black", "Other"] as const;

export const ALLOWED_MODEL_EXTENSIONS: ModelFileType[] = ["stl", "obj", "3mf"];

export const MAX_MODEL_FILE_SIZE_BYTES = 50 * 1024 * 1024; // 50 MB

export const STATUS_LABELS: Record<RequestStatus, string> = {
  new: "New",
  checking: "Checking",
  waiting_for_partner: "Waiting for partner",
  quote_ready: "Quote ready",
  quote_sent: "Quote sent",
  accepted: "Accepted",
  declined: "Declined",
  manufacturing: "Manufacturing",
  shipped: "Shipped",
  completed: "Completed",
};

export const STATUS_ORDER: RequestStatus[] = [
  "new",
  "checking",
  "waiting_for_partner",
  "quote_ready",
  "quote_sent",
  "accepted",
  "declined",
  "manufacturing",
  "shipped",
  "completed",
];

export const DECLINE_REASON_LABELS: Record<DeclineReason, string> = {
  price_too_high: "Price too high",
  delivery_too_expensive: "Delivery too expensive",
  changed_mind: "Changed my mind",
  needs_model_changes: "Need changes to the model",
  other: "Other",
};
