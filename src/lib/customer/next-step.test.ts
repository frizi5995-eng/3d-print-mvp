import { describe, it, expect } from "vitest";
import { getNextStepMessage } from "./next-step";

describe("getNextStepMessage", () => {
  it("tells the customer to pay when accepted and unpaid", () => {
    expect(getNextStepMessage("accepted", "unpaid")).toMatch(/pay/i);
    expect(getNextStepMessage("accepted", "invoice_sent")).toMatch(/pay/i);
  });

  it("confirms payment received when accepted and paid", () => {
    expect(getNextStepMessage("accepted", "paid")).toMatch(/payment received/i);
  });

  it("flags a failed payment distinctly from unpaid", () => {
    expect(getNextStepMessage("accepted", "payment_failed")).toMatch(/failed/i);
  });

  it("never mentions payment for pre-quote statuses", () => {
    expect(getNextStepMessage("new", "unpaid")).not.toMatch(/pay/i);
    expect(getNextStepMessage("checking", "unpaid")).not.toMatch(/pay/i);
  });

  it("returns a non-empty message for every real status", () => {
    const statuses: Array<Parameters<typeof getNextStepMessage>[0]> = [
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
    for (const s of statuses) {
      expect(getNextStepMessage(s, "unpaid").length).toBeGreaterThan(0);
    }
  });
});
