"use server";

import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdminUser } from "@/lib/auth/admin";
import { createServiceClient } from "@/lib/supabase/server";
import type { RequestStatus } from "@/types";

export type ActionResult = { ok: true } | { ok: false; error: string };

export interface PricingFormState {
  status: "idle" | "success" | "error";
  error?: string;
}

const pricingSchema = z.object({
  requestId: z.uuid(),
  manufacturerName: z.string().max(120).optional(),
  productionCost: z.string().optional(),
  productionShippingCost: z.string().optional(),
  otherCost: z.string().optional(),
  customerManufacturingPrice: z.string().optional(),
  customerShippingPrice: z.string().optional(),
});

function parseMoney(raw: string | undefined): { value: number | null } | { error: true } {
  if (!raw || raw.trim() === "") return { value: null };
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return { error: true };
  return { value: Math.round(n * 100) / 100 };
}

const MONEY_FIELDS = [
  ["productionCost", "production_cost"],
  ["productionShippingCost", "production_shipping_cost"],
  ["otherCost", "other_cost"],
  ["customerManufacturingPrice", "customer_manufacturing_price"],
  ["customerShippingPrice", "customer_shipping_price"],
] as const;

export async function updatePricing(
  _prevState: PricingFormState,
  formData: FormData
): Promise<PricingFormState> {
  await requireAdminUser();

  const parsed = pricingSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { status: "error", error: "Invalid input." };
  }

  const update: Record<string, number | string | null> = {
    manufacturer_name: parsed.data.manufacturerName?.trim() || null,
  };

  for (const [formKey, dbKey] of MONEY_FIELDS) {
    const result = parseMoney(parsed.data[formKey]);
    if ("error" in result) {
      return { status: "error", error: "Enter valid, non-negative amounts." };
    }
    update[dbKey] = result.value;
  }

  const supabase = createServiceClient();
  const { error } = await supabase
    .from("manufacturing_requests")
    .update(update)
    .eq("id", parsed.data.requestId);

  if (error) {
    return { status: "error", error: "Could not save changes. Please try again." };
  }

  revalidatePath(`/admin/requests/${parsed.data.requestId}`);
  revalidatePath("/admin/requests");
  return { status: "success" };
}

async function setStatusIfAllowed(
  requestId: string,
  next: RequestStatus,
  allowedFrom: RequestStatus[]
): Promise<ActionResult> {
  const supabase = createServiceClient();
  const { data: request } = await supabase
    .from("manufacturing_requests")
    .select("status")
    .eq("id", requestId)
    .maybeSingle();

  if (!request) return { ok: false, error: "Request not found." };
  if (!allowedFrom.includes(request.status as RequestStatus)) {
    return { ok: false, error: "This request is no longer in a status that allows that action." };
  }

  const { error } = await supabase
    .from("manufacturing_requests")
    .update({ status: next })
    .eq("id", requestId);

  if (error) return { ok: false, error: "Could not update status. Please try again." };

  revalidatePath(`/admin/requests/${requestId}`);
  revalidatePath("/admin/requests");
  return { ok: true };
}

export async function markChecking(requestId: string): Promise<ActionResult> {
  await requireAdminUser();
  return setStatusIfAllowed(requestId, "checking", ["new"]);
}

export async function markWaitingForPartner(requestId: string): Promise<ActionResult> {
  await requireAdminUser();
  return setStatusIfAllowed(requestId, "waiting_for_partner", ["new", "checking"]);
}

const QUOTE_VALIDITY_DAYS = 7;

export async function prepareQuote(requestId: string): Promise<ActionResult> {
  await requireAdminUser();

  const supabase = createServiceClient();
  const { data: request } = await supabase
    .from("manufacturing_requests")
    .select(
      "status, customer_manufacturing_price, customer_shipping_price, customer_name, customer_email, country, postal_code, quote_token"
    )
    .eq("id", requestId)
    .maybeSingle();

  if (!request) return { ok: false, error: "Request not found." };

  if (!["new", "checking", "waiting_for_partner"].includes(request.status)) {
    return { ok: false, error: "This request can't move to quote-ready from its current status." };
  }
  if (request.customer_manufacturing_price === null || request.customer_shipping_price === null) {
    return { ok: false, error: "Set a customer manufacturing price and shipping price first." };
  }
  if (!request.customer_name || !request.customer_email || !request.country || !request.postal_code) {
    return { ok: false, error: "Customer details are incomplete." };
  }

  const update: Record<string, string> = { status: "quote_ready" };

  if (!request.quote_token) {
    update.quote_token = randomBytes(32).toString("base64url");
    const expires = new Date();
    expires.setDate(expires.getDate() + QUOTE_VALIDITY_DAYS);
    update.quote_expires_at = expires.toISOString();
  }

  const { error } = await supabase
    .from("manufacturing_requests")
    .update(update)
    .eq("id", requestId);

  if (error) return { ok: false, error: "Could not prepare the quote. Please try again." };

  revalidatePath(`/admin/requests/${requestId}`);
  revalidatePath("/admin/requests");
  return { ok: true };
}
