"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdminUser } from "@/lib/auth/admin";
import { createServiceClient } from "@/lib/supabase/server";
import { logAdminActivity } from "@/lib/admin/activity-log";

export interface ShippingFormState {
  status: "idle" | "success" | "error";
  error?: string;
}

const schema = z.object({
  requestId: z.uuid(),
  carrier: z.string().max(100).optional(),
  trackingNumber: z.string().max(100).optional(),
  trackingUrl: z.string().max(500).optional(),
  estimatedDeliveryAt: z.string().optional(),
  deliveredAt: z.string().optional(),
});

export async function updateShippingInfo(
  _prevState: ShippingFormState,
  formData: FormData
): Promise<ShippingFormState> {
  const admin = await requireAdminUser();
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { status: "error", error: "Invalid input." };

  const supabase = createServiceClient();
  const { error } = await supabase
    .from("manufacturing_requests")
    .update({
      carrier: parsed.data.carrier?.trim() || null,
      tracking_number: parsed.data.trackingNumber?.trim() || null,
      tracking_url: parsed.data.trackingUrl?.trim() || null,
      estimated_delivery_at: parsed.data.estimatedDeliveryAt
        ? new Date(parsed.data.estimatedDeliveryAt).toISOString()
        : null,
      delivered_at: parsed.data.deliveredAt ? new Date(parsed.data.deliveredAt).toISOString() : null,
    })
    .eq("id", parsed.data.requestId);

  if (error) return { status: "error", error: "Could not save shipping info." };

  await logAdminActivity(admin.email!, "shipping_info_updated", parsed.data.requestId);
  revalidatePath(`/admin/requests/${parsed.data.requestId}`);
  return { status: "success" };
}
