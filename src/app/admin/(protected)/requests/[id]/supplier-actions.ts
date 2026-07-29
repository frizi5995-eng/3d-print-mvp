"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdminUser } from "@/lib/auth/admin";
import { logAdminActivity } from "@/lib/admin/activity-log";
import {
  addSupplierQuote,
  setSupplierQuoteStatus,
  selectSupplierQuote,
  validateSupplierQuoteInput,
  type SupplierQuoteInput,
} from "@/lib/admin/supplier-quotes";
import type { ActionResult } from "./actions";

const addQuoteSchema = z.object({
  requestId: z.uuid(),
  supplierId: z.uuid(),
  manufacturingCost: z.string(),
  supplierShippingCost: z.string().optional(),
  otherCost: z.string().optional(),
  leadTimeMin: z.string().optional(),
  leadTimeMax: z.string().optional(),
  validUntil: z.string().optional(),
  source: z.enum(["manual", "api_estimate", "api_confirmed"]),
  externalQuoteId: z.string().max(200).optional(),
  notes: z.string().max(2000).optional(),
});

function toNumber(raw: string | undefined, fallback = 0): number {
  if (!raw || raw.trim() === "") return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : NaN;
}

function toIntOrNull(raw: string | undefined): number | null {
  if (!raw || raw.trim() === "") return null;
  const n = Number(raw);
  return Number.isInteger(n) ? n : NaN;
}

export async function addSupplierQuoteAction(formData: FormData): Promise<ActionResult> {
  const admin = await requireAdminUser();

  const parsed = addQuoteSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: "Invalid input." };

  const manufacturingCost = toNumber(parsed.data.manufacturingCost, NaN);
  const supplierShippingCost = toNumber(parsed.data.supplierShippingCost, 0);
  const otherCost = toNumber(parsed.data.otherCost, 0);
  const leadTimeMin = toIntOrNull(parsed.data.leadTimeMin);
  const leadTimeMax = toIntOrNull(parsed.data.leadTimeMax);

  if ([manufacturingCost, supplierShippingCost, otherCost, leadTimeMin, leadTimeMax].some((n) => n !== null && Number.isNaN(n))) {
    return { ok: false, error: "Enter valid numbers." };
  }

  const input: SupplierQuoteInput = {
    supplier_id: parsed.data.supplierId,
    manufacturing_cost: manufacturingCost,
    supplier_shipping_cost: supplierShippingCost,
    other_cost: otherCost,
    lead_time_days_min: leadTimeMin,
    lead_time_days_max: leadTimeMax,
    valid_until: parsed.data.validUntil ? new Date(parsed.data.validUntil).toISOString() : null,
    source: parsed.data.source,
    external_quote_id: parsed.data.externalQuoteId?.trim() || null,
    notes: parsed.data.notes?.trim() || null,
  };

  const errors = validateSupplierQuoteInput(input);
  if (errors.length > 0) return { ok: false, error: errors.join(" ") };

  let quoteId: string;
  try {
    const created = await addSupplierQuote(parsed.data.requestId, input);
    quoteId = created.id;
  } catch {
    return { ok: false, error: "Could not save supplier quote." };
  }

  await logAdminActivity(admin.email!, "supplier_quote_added", parsed.data.requestId, {
    supplier_quote_id: quoteId,
    supplier_id: parsed.data.supplierId,
    source: parsed.data.source,
  });

  revalidatePath(`/admin/requests/${parsed.data.requestId}`);
  return { ok: true, message: "Supplier quote added." };
}

export async function rejectSupplierQuoteAction(requestId: string, quoteId: string): Promise<ActionResult> {
  const admin = await requireAdminUser();

  try {
    await setSupplierQuoteStatus(quoteId, "rejected");
  } catch {
    return { ok: false, error: "Could not update supplier quote." };
  }

  await logAdminActivity(admin.email!, "supplier_quote_updated", requestId, {
    supplier_quote_id: quoteId,
    status: "rejected",
  });
  revalidatePath(`/admin/requests/${requestId}`);
  return { ok: true, message: "Supplier quote rejected." };
}

/**
 * Bookkeeping only — see selectSupplierQuote()'s docstring. This never
 * sends a quote to the customer, never creates a payment, and never
 * contacts the supplier.
 */
export async function selectSupplierQuoteAction(requestId: string, quoteId: string | null): Promise<ActionResult> {
  const admin = await requireAdminUser();

  const ok = await selectSupplierQuote(requestId, quoteId);
  if (!ok) return { ok: false, error: "Could not select that supplier quote." };

  await logAdminActivity(admin.email!, "supplier_quote_selected", requestId, { supplier_quote_id: quoteId });
  revalidatePath(`/admin/requests/${requestId}`);
  return { ok: true, message: quoteId ? "Supplier selected." : "Supplier selection cleared." };
}
