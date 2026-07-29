"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/customer";
import { COLORS, MATERIALS } from "@/lib/constants";

const requestSchema = z.object({
  modelId: z.uuid(),
  quantity: z.coerce.number().int().min(1).max(9999),
  material: z.string().min(1).max(60),
  colorChoice: z.enum(COLORS),
  colorOther: z.string().max(60).optional(),
  sizeMode: z.enum(["original", "custom"]),
  desiredSizeCustom: z.string().max(200).optional(),
  notes: z.string().max(2000).optional(),
  customerName: z.string().min(1).max(120),
  customerEmail: z.email().max(200),
  customerPhone: z.string().max(40).optional(),
  country: z.string().min(1).max(80),
  postalCode: z.string().min(1).max(20),
});

export interface CreateRequestState {
  error?: string;
  fieldErrors?: Partial<Record<string, string>>;
}

export async function createManufacturingRequest(
  _prevState: CreateRequestState,
  formData: FormData
): Promise<CreateRequestState> {
  const raw = Object.fromEntries(formData);
  const parsed = requestSchema.safeParse(raw);

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0]);
      if (!fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return { error: "Please check the highlighted fields.", fieldErrors };
  }

  const data = parsed.data;

  if (data.colorChoice === "Other" && !data.colorOther?.trim()) {
    return { error: "Please specify a color.", fieldErrors: { colorOther: "Required" } };
  }
  if (data.sizeMode === "custom" && !data.desiredSizeCustom?.trim()) {
    return { error: "Please describe the desired size.", fieldErrors: { desiredSizeCustom: "Required" } };
  }

  const color = data.colorChoice === "Other" ? data.colorOther!.trim() : data.colorChoice;
  const desiredSize = data.sizeMode === "custom" ? data.desiredSizeCustom!.trim() : null;
  const material = MATERIALS.includes(data.material as (typeof MATERIALS)[number])
    ? data.material
    : "PLA";

  const supabase = createServiceClient();

  const { data: model } = await supabase
    .from("models")
    .select("id")
    .eq("id", data.modelId)
    .maybeSingle();

  if (!model) {
    return { error: "We couldn't find your uploaded model. Please upload it again." };
  }

  // Server-verified session only — never a client-supplied user id. Anonymous
  // submissions (no session) stay customer_user_id = null, unchanged.
  const currentUser = await getCurrentUser();

  const { data: created, error } = await supabase
    .from("manufacturing_requests")
    .insert({
      model_id: data.modelId,
      quantity: data.quantity,
      material,
      color,
      desired_size: desiredSize,
      notes: data.notes?.trim() || null,
      customer_name: data.customerName.trim(),
      customer_email: data.customerEmail.trim(),
      customer_phone: data.customerPhone?.trim() || null,
      country: data.country.trim(),
      postal_code: data.postalCode.trim(),
      customer_user_id: currentUser?.id ?? null,
    })
    .select("reference_number")
    .single();

  if (error || !created) {
    return { error: "Could not submit your request. Please try again." };
  }

  redirect(`/quote/success?ref=${created.reference_number}`);
}
