import "server-only";

/**
 * Common shape for any supplier API integration (Sculpteo, Xometry, future
 * ones). Providers are opt-in adapters — nothing in Fabrik depends on one
 * existing; every method must fail safely with NOT_CONFIGURED when
 * credentials aren't set, never crash the rest of the product.
 *
 * createOrder is deliberately NOT part of this interface yet. Placing a
 * real order with a real supplier is a business action this codebase does
 * not wire to any automatic trigger — see M29 in the roadmap. When it's
 * added, it must require an explicit, confirmed admin action, never a
 * side effect of quoting/selecting/pricing.
 */

export interface ProviderUploadInput {
  requestId: string;
  /** Signed, time-limited URL to the model file already in Supabase Storage. */
  modelSignedUrl: string;
  filename: string;
}

export interface ProviderUploadResult {
  externalModelId: string;
}

export interface ProviderQuoteInput {
  externalModelId: string;
  material: string;
  quantity: number;
}

/**
 * An estimate from a provider API. This is intentionally a SEPARATE shape
 * from SupplierQuote (the DB row) — callers must set source: "api_estimate"
 * when persisting one of these, never "api_confirmed", unless the provider
 * explicitly confirms pricing (a distinct, stronger guarantee most
 * providers only give after cart/order creation).
 */
export interface ProviderQuoteEstimate {
  manufacturingCost: number;
  shippingCost: number;
  currency: string;
  leadTimeDaysMin: number | null;
  leadTimeDaysMax: number | null;
  externalQuoteId: string | null;
  /** True only if the provider API itself marks this as a firm/confirmed quote. */
  confirmed: boolean;
}

export interface ProviderLeadTime {
  daysMin: number | null;
  daysMax: number | null;
}

export interface ProviderOrderStatus {
  externalOrderId: string;
  status: string;
  trackingUrl: string | null;
}

export type ProviderErrorReason = "not_configured" | "not_implemented" | "api_error";

export class SupplierProviderError extends Error {
  constructor(
    public readonly reason: ProviderErrorReason,
    message: string
  ) {
    super(message);
    this.name = "SupplierProviderError";
  }
}

export interface SupplierProvider {
  readonly key: string;
  isConfigured(): boolean;
  uploadModel(input: ProviderUploadInput): Promise<ProviderUploadResult>;
  getQuote(input: ProviderQuoteInput): Promise<ProviderQuoteEstimate>;
  getLeadTime(input: ProviderQuoteInput): Promise<ProviderLeadTime>;
  getOrderStatus(externalOrderId: string): Promise<ProviderOrderStatus>;
}
