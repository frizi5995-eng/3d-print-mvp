import "server-only";
import { createHash } from "crypto";
import { headers } from "next/headers";
import { createServiceClient } from "@/lib/supabase/server";

// Several genuinely different models from the same person in one sitting
// must stay easy; dozens of submissions in the same window should not.
const WINDOW_MINUTES = 15;
const MAX_PER_IP = 8;
const MAX_PER_EMAIL = 5;

/** SHA-256 — never store or log the raw IP anywhere. */
export function hashIp(ip: string): string {
  return createHash("sha256").update(ip).digest("hex");
}

export async function getClientIpHash(): Promise<string> {
  const headerList = await headers();
  const forwardedFor = headerList.get("x-forwarded-for");
  const ip = forwardedFor?.split(",")[0]?.trim() || headerList.get("x-real-ip") || "unknown";
  return hashIp(ip);
}

export interface RateLimitResult {
  limited: boolean;
  message?: string;
}

/**
 * Checked before inserting a manufacturing_requests row. Both counts look
 * at the same rolling window; either one tripping is enough to throttle.
 * Never deletes anything — a limited submission is simply refused with a
 * friendly message, same as any other validation failure.
 */
export async function checkSubmissionRateLimit(
  ipHash: string,
  email: string
): Promise<RateLimitResult> {
  const supabase = createServiceClient();
  const windowStart = new Date(Date.now() - WINDOW_MINUTES * 60 * 1000).toISOString();

  const [ipResult, emailResult] = await Promise.all([
    supabase
      .from("manufacturing_requests")
      .select("id", { count: "exact", head: true })
      .eq("submission_ip_hash", ipHash)
      .gte("created_at", windowStart),
    supabase
      .from("manufacturing_requests")
      .select("id", { count: "exact", head: true })
      .ilike("customer_email", email)
      .gte("created_at", windowStart),
  ]);

  const limited = (ipResult.count ?? 0) >= MAX_PER_IP || (emailResult.count ?? 0) >= MAX_PER_EMAIL;

  return {
    limited,
    message: limited
      ? "You've submitted several requests recently. Please wait a bit before submitting another."
      : undefined,
  };
}
