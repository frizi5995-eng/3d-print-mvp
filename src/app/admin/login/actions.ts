"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getAdminUser } from "@/lib/auth/admin";

const schema = z.object({
  email: z.email(),
  password: z.string().min(1),
});

export interface AdminLoginState {
  error?: string;
}

export async function signInAdmin(
  _prevState: AdminLoginState,
  formData: FormData
): Promise<AdminLoginState> {
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: "Enter a valid email and password." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error) {
    return { error: "Invalid email or password." };
  }

  const admin = await getAdminUser();
  if (!admin) {
    await supabase.auth.signOut();
    return { error: "This account does not have admin access." };
  }

  redirect("/admin/requests");
}
