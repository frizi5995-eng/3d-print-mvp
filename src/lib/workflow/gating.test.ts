import { describe, it, expect } from "vitest";
import { isTransitionAllowed, isPaymentGatedTransition, isManufacturingBlockedByPayment } from "./gating";

describe("isTransitionAllowed", () => {
  it("allows the documented forward/backward workflow moves", () => {
    expect(isTransitionAllowed("accepted", "manufacturing")).toBe(true);
    expect(isTransitionAllowed("manufacturing", "shipped")).toBe(true);
    expect(isTransitionAllowed("manufacturing", "accepted")).toBe(true);
    expect(isTransitionAllowed("shipped", "completed")).toBe(true);
    expect(isTransitionAllowed("shipped", "manufacturing")).toBe(true);
    expect(isTransitionAllowed("completed", "shipped")).toBe(true);
  });

  it("refuses arbitrary jumps", () => {
    expect(isTransitionAllowed("accepted", "completed")).toBe(false);
    expect(isTransitionAllowed("new", "manufacturing")).toBe(false);
    expect(isTransitionAllowed("completed", "accepted")).toBe(false);
  });

  it("statuses with no outgoing workflow transitions refuse everything", () => {
    expect(isTransitionAllowed("new", "checking")).toBe(false);
    expect(isTransitionAllowed("declined", "manufacturing")).toBe(false);
  });
});

describe("isPaymentGatedTransition", () => {
  it("only accepted -> manufacturing is gated", () => {
    expect(isPaymentGatedTransition("accepted", "manufacturing")).toBe(true);
    expect(isPaymentGatedTransition("manufacturing", "shipped")).toBe(false);
    expect(isPaymentGatedTransition("manufacturing", "accepted")).toBe(false);
    expect(isPaymentGatedTransition("shipped", "completed")).toBe(false);
  });
});

describe("isManufacturingBlockedByPayment", () => {
  it("blocks accepted -> manufacturing unless payment_status is paid", () => {
    expect(isManufacturingBlockedByPayment("accepted", "manufacturing", "unpaid")).toBe(true);
    expect(isManufacturingBlockedByPayment("accepted", "manufacturing", "invoice_sent")).toBe(true);
    expect(isManufacturingBlockedByPayment("accepted", "manufacturing", "payment_failed")).toBe(true);
    expect(isManufacturingBlockedByPayment("accepted", "manufacturing", "refunded")).toBe(true);
    expect(isManufacturingBlockedByPayment("accepted", "manufacturing", "paid")).toBe(false);
  });

  it("never blocks transitions other than accepted -> manufacturing, regardless of payment", () => {
    expect(isManufacturingBlockedByPayment("manufacturing", "shipped", "unpaid")).toBe(false);
    expect(isManufacturingBlockedByPayment("shipped", "completed", "unpaid")).toBe(false);
    expect(isManufacturingBlockedByPayment("manufacturing", "accepted", "unpaid")).toBe(false);
  });
});
