import "server-only";
import { getResendClient } from "@/lib/email/resend";
import { formatEUR } from "@/lib/admin/money";
import { formatDate } from "@/lib/utils";

// Resend's shared sandbox sender — works without a verified domain, so the
// pipeline is testable the moment an API key is added. Override with
// EMAIL_FROM_ADDRESS once a real sending domain is verified in Resend.
const DEFAULT_FROM = "Fabrik Quotes <onboarding@resend.dev>";

export interface QuoteReadyEmailParams {
  customerName: string;
  customerEmail: string;
  referenceNumber: number;
  /** Manufacturing + delivery price. Never pass production cost or margin here. */
  total: number;
  expiresAt: string;
  quoteUrl: string;
  /** From app_settings — falls back to defaults if not provided. */
  supportEmail?: string;
  companyDisplayName?: string;
}

function buildQuoteReadyEmail(params: QuoteReadyEmailParams) {
  const companyName = params.companyDisplayName || "Fabrik";
  const subject = `Your manufacturing quote is ready — request #${params.referenceNumber}`;
  const text = [
    `Hi ${params.customerName},`,
    "",
    `Your manufacturing quote for request #${params.referenceNumber} is ready.`,
    "",
    `Total: ${formatEUR(params.total)}`,
    `Valid until: ${formatDate(params.expiresAt)}`,
    "",
    `View and respond to your quote:`,
    params.quoteUrl,
    "",
    `Questions? Contact ${params.supportEmail || "us"}.`,
    "",
    companyName,
  ].join("\n");
  return { subject, text };
}

export type SendQuoteEmailResult =
  | { sent: true }
  | { sent: false; reason: "not_configured" }
  | { sent: false; reason: "error"; message: string };

/**
 * Best-effort only. Never let an email failure block the admin action that
 * triggered it — the "Copy quote link" fallback always works regardless of
 * email delivery.
 */
export async function sendQuoteReadyEmail(
  params: QuoteReadyEmailParams
): Promise<SendQuoteEmailResult> {
  const client = await getResendClient();
  if (!client) return { sent: false, reason: "not_configured" };

  const { subject, text } = buildQuoteReadyEmail(params);

  try {
    const { error } = await client.emails.send({
      from: process.env.EMAIL_FROM_ADDRESS || DEFAULT_FROM,
      to: params.customerEmail,
      subject,
      text,
    });
    if (error) return { sent: false, reason: "error", message: error.message };
    return { sent: true };
  } catch (err) {
    return {
      sent: false,
      reason: "error",
      message: err instanceof Error ? err.message : "Unknown error",
    };
  }
}
