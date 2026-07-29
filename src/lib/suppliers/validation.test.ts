import { describe, it, expect } from "vitest";
import {
  validateSupplierInput,
  validateSupplierQuoteInput,
  isConfirmedSupplierQuote,
  canSelectSupplierQuote,
  type SupplierInput,
  type SupplierQuoteInput,
} from "./validation";

const baseSupplier: SupplierInput = {
  name: "Acme Prints",
  country: "LV",
  website: null,
  contact_email: null,
  contact_phone: null,
  notes: null,
  technologies: ["FDM"],
  materials: ["PLA"],
  api_provider: null,
  api_enabled: false,
  preferred: false,
  reliability_score: null,
};

describe("validateSupplierInput", () => {
  it("accepts a minimal valid supplier", () => {
    expect(validateSupplierInput(baseSupplier)).toEqual([]);
  });

  it("rejects empty name/country", () => {
    const errors = validateSupplierInput({ ...baseSupplier, name: "  ", country: "" });
    expect(errors.length).toBe(2);
  });

  it("rejects malformed contact email", () => {
    expect(validateSupplierInput({ ...baseSupplier, contact_email: "not-an-email" }).length).toBe(1);
  });

  it("rejects reliability score out of 0-10 range", () => {
    expect(validateSupplierInput({ ...baseSupplier, reliability_score: 11 }).length).toBe(1);
    expect(validateSupplierInput({ ...baseSupplier, reliability_score: -1 }).length).toBe(1);
  });

  it("requires api_provider when api_enabled is true", () => {
    expect(validateSupplierInput({ ...baseSupplier, api_enabled: true, api_provider: null }).length).toBe(1);
    expect(validateSupplierInput({ ...baseSupplier, api_enabled: true, api_provider: "sculpteo" })).toEqual([]);
  });
});

const baseQuote: SupplierQuoteInput = {
  supplier_id: "11111111-1111-1111-1111-111111111111",
  manufacturing_cost: 20,
  supplier_shipping_cost: 5,
  other_cost: 0,
  lead_time_days_min: 2,
  lead_time_days_max: 5,
  valid_until: null,
  source: "manual",
  external_quote_id: null,
  notes: null,
};

describe("validateSupplierQuoteInput", () => {
  it("accepts a minimal valid quote", () => {
    expect(validateSupplierQuoteInput(baseQuote)).toEqual([]);
  });

  it("rejects negative costs", () => {
    expect(validateSupplierQuoteInput({ ...baseQuote, manufacturing_cost: -1 }).length).toBe(1);
    expect(validateSupplierQuoteInput({ ...baseQuote, supplier_shipping_cost: -1 }).length).toBe(1);
    expect(validateSupplierQuoteInput({ ...baseQuote, other_cost: -1 }).length).toBe(1);
  });

  it("rejects NaN/non-finite costs", () => {
    expect(validateSupplierQuoteInput({ ...baseQuote, manufacturing_cost: NaN }).length).toBe(1);
  });

  it("rejects lead time min greater than max", () => {
    expect(validateSupplierQuoteInput({ ...baseQuote, lead_time_days_min: 10, lead_time_days_max: 2 }).length).toBe(1);
  });

  it("allows null lead time range", () => {
    expect(
      validateSupplierQuoteInput({ ...baseQuote, lead_time_days_min: null, lead_time_days_max: null })
    ).toEqual([]);
  });
});

describe("supplier quote source distinctions", () => {
  it("only api_confirmed counts as a confirmed quote", () => {
    expect(isConfirmedSupplierQuote("api_confirmed")).toBe(true);
    expect(isConfirmedSupplierQuote("api_estimate")).toBe(false);
    expect(isConfirmedSupplierQuote("manual")).toBe(false);
  });
});

describe("canSelectSupplierQuote", () => {
  const requestId = "req-1";

  it("allows selecting an active quote belonging to the request", () => {
    expect(canSelectSupplierQuote({ request_id: requestId, status: "active" }, requestId)).toBe(true);
  });

  it("refuses a quote belonging to a different request", () => {
    expect(canSelectSupplierQuote({ request_id: "req-2", status: "active" }, requestId)).toBe(false);
  });

  it("refuses a rejected quote even if it belongs to the request", () => {
    expect(canSelectSupplierQuote({ request_id: requestId, status: "rejected" }, requestId)).toBe(false);
  });

  it("allows an expired quote (admin can still knowingly pick it)", () => {
    expect(canSelectSupplierQuote({ request_id: requestId, status: "expired" }, requestId)).toBe(true);
  });
});
