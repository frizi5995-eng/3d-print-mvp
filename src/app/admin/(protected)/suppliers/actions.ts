"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAdminUser } from "@/lib/auth/admin";
import { logAdminActivity } from "@/lib/admin/activity-log";
import {
  createSupplier,
  updateSupplier,
  setSupplierActive,
  validateSupplierInput,
  type SupplierInput,
} from "@/lib/admin/suppliers";

export type ActionResult = { ok: true; message?: string } | { ok: false; error: string };

export interface SupplierFormState {
  status: "idle" | "success" | "error";
  error?: string;
}

const supplierSchema = z.object({
  id: z.uuid().optional(),
  name: z.string().trim().min(1).max(200),
  country: z.string().trim().min(1).max(100),
  website: z.string().trim().max(500).optional(),
  contactEmail: z.string().trim().max(200).optional(),
  contactPhone: z.string().trim().max(50).optional(),
  notes: z.string().trim().max(5000).optional(),
  technologies: z.array(z.string()).optional(),
  materials: z.string().trim().max(1000).optional(),
  apiProvider: z.string().trim().max(100).optional(),
  apiEnabled: z.string().optional(),
  preferred: z.string().optional(),
  reliabilityScore: z.string().trim().optional(),
});

function toInput(parsed: z.infer<typeof supplierSchema>): SupplierInput | { error: string } {
  let reliabilityScore: number | null = null;
  if (parsed.reliabilityScore) {
    const n = Number(parsed.reliabilityScore);
    if (!Number.isFinite(n)) return { error: "Reliability score must be a number." };
    reliabilityScore = n;
  }

  return {
    name: parsed.name,
    country: parsed.country,
    website: parsed.website || null,
    contact_email: parsed.contactEmail || null,
    contact_phone: parsed.contactPhone || null,
    notes: parsed.notes || null,
    technologies: parsed.technologies ?? [],
    materials: (parsed.materials ?? "")
      .split(",")
      .map((m) => m.trim())
      .filter(Boolean),
    api_provider: parsed.apiProvider || null,
    api_enabled: parsed.apiEnabled === "on",
    preferred: parsed.preferred === "on",
    reliability_score: reliabilityScore,
  };
}

export async function saveSupplier(
  _prevState: SupplierFormState,
  formData: FormData
): Promise<SupplierFormState> {
  const admin = await requireAdminUser();

  const raw = Object.fromEntries(formData);
  const parsed = supplierSchema.safeParse({
    ...raw,
    technologies: formData.getAll("technologies"),
  });
  if (!parsed.success) {
    return { status: "error", error: "Invalid input." };
  }

  const input = toInput(parsed.data);
  if ("error" in input) return { status: "error", error: input.error };

  const validationErrors = validateSupplierInput(input);
  if (validationErrors.length > 0) {
    return { status: "error", error: validationErrors.join(" ") };
  }

  let supplierId: string;
  try {
    if (parsed.data.id) {
      await updateSupplier(parsed.data.id, input);
      supplierId = parsed.data.id;
      await logAdminActivity(admin.email!, "supplier_updated", null, { supplier_id: supplierId });
    } else {
      const created = await createSupplier(input);
      supplierId = created.id;
      await logAdminActivity(admin.email!, "supplier_created", null, { supplier_id: supplierId });
    }
  } catch {
    return { status: "error", error: "Could not save supplier. Please try again." };
  }

  revalidatePath("/admin/suppliers");
  revalidatePath(`/admin/suppliers/${supplierId}`);
  redirect(`/admin/suppliers/${supplierId}`);
}

export async function toggleSupplierActive(id: string, active: boolean): Promise<ActionResult> {
  const admin = await requireAdminUser();

  try {
    await setSupplierActive(id, active);
  } catch {
    return { ok: false, error: "Could not update supplier." };
  }

  await logAdminActivity(admin.email!, "supplier_updated", null, { supplier_id: id, active });
  revalidatePath("/admin/suppliers");
  revalidatePath(`/admin/suppliers/${id}`);
  return { ok: true, message: active ? "Supplier re-enabled." : "Supplier disabled." };
}
