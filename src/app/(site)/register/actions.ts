"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { claimRequestsForAuthenticatedUser } from "@/lib/auth/claim-requests";

const schema = z
  .object({
    email: z.email(),
    password: z.string().min(8, "Password must be at least 8 characters."),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match.",
    path: ["confirmPassword"],
  });

export interface RegisterState {
  error?: string;
  checkEmail?: boolean;
}

export async function registerCustomer(
  _prevState: RegisterState,
  formData: FormData
): Promise<RegisterState> {
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Please check your details." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error) {
    if (error.code === "user_already_exists") {
      return { error: "An account with this email already exists. Try signing in instead." };
    }
    return { error: "Could not create your account. Please try again." };
  }

  if (!data.user) {
    return { error: "Could not create your account. Please try again." };
  }

  // A session existing here only means email confirmation is disabled on
  // this project (Supabase auto-confirms at signup in that mode) OR the
  // user already had a prior confirmed identity — never proof by itself.
  // claimRequestsForAuthenticatedUser re-checks email_confirmed_at itself
  // regardless, so this can never claim on an unconfirmed identity even if
  // a session is somehow present.
  if (data.session && data.user.email_confirmed_at) {
    await claimRequestsForAuthenticatedUser(data.user);
    redirect("/account");
  }

  // No session, or a session without confirmed email — the account exists
  // but has claimed nothing and grants no ownership yet.
  return { checkEmail: true };
}
