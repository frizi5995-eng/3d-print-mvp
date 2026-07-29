import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/**
 * Same Supabase Auth system as admin (src/lib/auth/admin.ts) — no second
 * auth system. The only difference is there's no allowlist: any verified
 * email may hold a customer account.
 */
export async function getCurrentUser() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) return null;
  return user;
}

export async function requireCustomerUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}
