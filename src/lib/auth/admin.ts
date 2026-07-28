import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

function adminEmailAllowlist(): string[] {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * Returns the signed-in user if they're authenticated AND their email is in
 * the server-only ADMIN_EMAILS allowlist. Uses `getUser()`, not
 * `getSession()` — it revalidates the JWT against Supabase Auth instead of
 * trusting the cookie-decoded session as-is.
 */
export async function getAdminUser() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user?.email) return null;

  const allowlist = adminEmailAllowlist();
  if (!allowlist.includes(user.email.toLowerCase())) return null;

  return user;
}

/**
 * Use in every admin page/layout AND every admin server action. Page-level
 * guards alone aren't enough — a mutation invoked directly must independently
 * refuse to run for anyone who isn't an allowlisted, signed-in admin.
 */
export async function requireAdminUser() {
  const user = await getAdminUser();
  if (!user) redirect("/admin/login");
  return user;
}
