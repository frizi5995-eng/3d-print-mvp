import "server-only";
import { createServiceClient } from "@/lib/supabase/server";

/**
 * Operational audit trail for admin actions — not user surveillance. Never
 * pass secrets or large payloads as metadata; keep it to small, safe facts
 * (old/new status, changed field names, etc). Failures here are logged and
 * swallowed — a broken audit write must never block the admin action itself.
 */
export async function logAdminActivity(
  adminEmail: string,
  action: string,
  requestId: string | null,
  metadata?: Record<string, unknown>
): Promise<void> {
  try {
    const supabase = createServiceClient();
    await supabase.from("admin_activity_log").insert({
      admin_email: adminEmail,
      action,
      request_id: requestId,
      metadata: metadata ?? null,
    });
  } catch (err) {
    console.error("Failed to write admin activity log:", err);
  }
}
