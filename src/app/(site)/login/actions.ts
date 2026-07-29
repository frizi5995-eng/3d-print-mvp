"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { claimRequestsForAuthenticatedUser } from "@/lib/auth/claim-requests";

const schema = z.object({
  email: z.email(),
  password: z.string().min(1),
});

export interface LoginState {
  error?: string;
}

export async function loginCustomer(
  _prevState: LoginState,
  formData: FormData
): Promise<LoginState> {
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: "Enter a valid email and password." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error) {
    return { error: "Invalid email or password." };
  }

  // claimRequestsForAuthenticatedUser re-verifies email_confirmed_at itself;
  // an unconfirmed identity that somehow reaches login can never claim.
  if (data.user) {
    await claimRequestsForAuthenticatedUser(data.user);
  }

  redirect("/account");
}
