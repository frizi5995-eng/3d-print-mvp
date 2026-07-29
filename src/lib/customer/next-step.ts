// Pure "what happens next" copy for a customer's request — no DB, testable.
// Every branch maps to a real, existing status/payment_status combination.
// Never invents an event that hasn't happened.

import type { PaymentStatus, RequestStatus } from "@/types";

export function getNextStepMessage(status: RequestStatus, paymentStatus: PaymentStatus): string {
  switch (status) {
    case "new":
    case "checking":
      return "We're reviewing your model and preparing a manufacturing quote.";
    case "waiting_for_partner":
      return "We're checking pricing with a manufacturing partner. We'll have your quote soon.";
    case "quote_ready":
    case "quote_sent":
      return "Your quote is ready — review it and accept or decline.";
    case "declined":
      return "You declined this quote. Contact us if you'd like to revisit it.";
    case "accepted":
      if (paymentStatus === "paid") {
        return "Payment received — manufacturing will start shortly.";
      }
      if (paymentStatus === "payment_failed") {
        return "Your last payment attempt failed. Please try again on the invoice.";
      }
      return "Pay the invoice to start manufacturing.";
    case "manufacturing":
      return "Your order is in production.";
    case "shipped":
      return "Your order has shipped.";
    case "completed":
      return "Your order is complete.";
    default:
      return "";
  }
}
