import "server-only";
import {
  SupplierProviderError,
  type ProviderLeadTime,
  type ProviderOrderStatus,
  type ProviderQuoteEstimate,
  type ProviderQuoteInput,
  type ProviderUploadInput,
  type ProviderUploadResult,
  type SupplierProvider,
} from "./types";

/**
 * Sculpteo API v2 adapter — SCAFFOLDING ONLY.
 *
 * We do not currently have production API credentials or a copy of the
 * current official API reference in this repo. The expected flow per
 * Sculpteo's public documentation is OAuth2 (client credentials) with
 * scope v2_api, then design upload, then quotation/lead-time, then a
 * separate cart/order step. That flow shape is reflected in this file's
 * structure below, but the actual endpoint paths/request payloads are NOT
 * filled in — they are marked TODO and must be verified against Sculpteo's
 * current API docs before use. Nothing here fabricates a price or places
 * an order; every real network call throws SupplierProviderError until
 * that verification happens.
 *
 * createOrder is intentionally not implemented anywhere in this adapter.
 */

const CLIENT_ID = process.env.SCULPTEO_CLIENT_ID;
const CLIENT_SECRET = process.env.SCULPTEO_CLIENT_SECRET;

function isConfigured(): boolean {
  return Boolean(CLIENT_ID && CLIENT_SECRET);
}

function requireConfigured(): void {
  if (!isConfigured()) {
    throw new SupplierProviderError("not_configured", "Sculpteo API credentials are not configured.");
  }
}

// TODO: verify against current Sculpteo API v2 docs before implementing
// the actual token request (grant_type, exact token URL, scope value).
async function getAccessToken(): Promise<string> {
  requireConfigured();
  throw new SupplierProviderError(
    "not_implemented",
    "Sculpteo OAuth2 token exchange is not implemented yet — pending verified API documentation."
  );
}

export const sculpteoProvider: SupplierProvider = {
  key: "sculpteo",

  isConfigured,

  async uploadModel(input: ProviderUploadInput): Promise<ProviderUploadResult> {
    void input;
    await getAccessToken();
    // TODO: verify upload endpoint/payload against current Sculpteo API docs.
    throw new SupplierProviderError("not_implemented", "Sculpteo model upload is not implemented yet.");
  },

  async getQuote(input: ProviderQuoteInput): Promise<ProviderQuoteEstimate> {
    void input;
    await getAccessToken();
    // TODO: verify quotation endpoint/payload against current Sculpteo API docs.
    // Never fabricate a price here — this must call the real API or throw.
    throw new SupplierProviderError("not_implemented", "Sculpteo quoting is not implemented yet.");
  },

  async getLeadTime(input: ProviderQuoteInput): Promise<ProviderLeadTime> {
    void input;
    await getAccessToken();
    throw new SupplierProviderError("not_implemented", "Sculpteo lead-time lookup is not implemented yet.");
  },

  async getOrderStatus(externalOrderId: string): Promise<ProviderOrderStatus> {
    void externalOrderId;
    await getAccessToken();
    throw new SupplierProviderError("not_implemented", "Sculpteo order status lookup is not implemented yet.");
  },
};
