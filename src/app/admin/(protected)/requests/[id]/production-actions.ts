"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdminUser } from "@/lib/auth/admin";
import { createServiceClient } from "@/lib/supabase/server";
import { logAdminActivity } from "@/lib/admin/activity-log";

export interface ProductionFormState {
  status: "idle" | "success" | "error";
  error?: string;
}

const schema = z.object({
  requestId: z.uuid(),
  estimatedCompletionAt: z.string().optional(),
  productionNotes: z.string().max(5000).optional(),
  externalSupplierReference: z.string().max(200).optional(),
});

export async function updateProductionInfo(
  _prevState: ProductionFormState,
  formData: FormData
): Promise<ProductionFormState> {
  const admin = await requireAdminUser();
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { status: "error", error: "Invalid input." };

  const supabase = createServiceClient();
  const { error } = await supabase
    .from("manufacturing_requests")
    .update({
      estimated_completion_at: parsed.data.estimatedCompletionAt
        ? new Date(parsed.data.estimatedCompletionAt).toISOString()
        : null,
      production_notes: parsed.data.productionNotes?.trim() || null,
      external_supplier_reference: parsed.data.externalSupplierReference?.trim() || null,
    })
    .eq("id", parsed.data.requestId);

  if (error) return { status: "error", error: "Could not save production info." };

  await logAdminActivity(admin.email!, "production_info_updated", parsed.data.requestId);
  revalidatePath(`/admin/requests/${parsed.data.requestId}`);
  return { status: "success" };
}
