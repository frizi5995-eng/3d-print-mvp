import "server-only";
import { createServiceClient } from "@/lib/supabase/server";
import { validateSupplierQuoteInput, canSelectSupplierQuote, type SupplierQuoteInput } from "@/lib/suppliers/validation";
import type { SupplierQuote } from "@/types";

export { validateSupplierQuoteInput };
export type { SupplierQuoteInput };

export interface SupplierQuoteWithSupplier extends SupplierQuote {
  supplier_name: string;
  supplier_country: string;
  supplier_preferred: boolean;
}

export async function listQuotesForRequest(requestId: string): Promise<SupplierQuoteWithSupplier[]> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("supplier_quotes")
    .select("*, suppliers(name, country, preferred)")
    .eq("request_id", requestId)
    .order("manufacturing_cost", { ascending: true });

  return (data ?? []).map((row) => {
    const supplier = Array.isArray(row.suppliers) ? row.suppliers[0] : row.suppliers;
    const { suppliers, ...rest } = row as Record<string, unknown> & { suppliers: unknown };
    void suppliers;
    return {
      ...(rest as unknown as SupplierQuote),
      supplier_name: supplier?.name ?? "Unknown supplier",
      supplier_country: supplier?.country ?? "",
      supplier_preferred: supplier?.preferred ?? false,
    };
  });
}

export async function addSupplierQuote(requestId: string, input: SupplierQuoteInput): Promise<{ id: string }> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("supplier_quotes")
    .insert({
      request_id: requestId,
      supplier_id: input.supplier_id,
      manufacturing_cost: input.manufacturing_cost,
      supplier_shipping_cost: input.supplier_shipping_cost,
      other_cost: input.other_cost,
      currency: "EUR",
      lead_time_days_min: input.lead_time_days_min,
      lead_time_days_max: input.lead_time_days_max,
      valid_until: input.valid_until,
      source: input.source,
      external_quote_id: input.external_quote_id,
      notes: input.notes,
    })
    .select("id")
    .single();
  if (error) throw error;
  return data;
}

export async function setSupplierQuoteStatus(
  quoteId: string,
  status: "active" | "rejected" | "expired"
): Promise<void> {
  const supabase = createServiceClient();
  const { error } = await supabase.from("supplier_quotes").update({ status }).eq("id", quoteId);
  if (error) throw error;
}

/**
 * Selecting a quote is bookkeeping only — it records which supplier offer
 * the admin picked. It must never trigger ordering, payment, or any other
 * side effect. The guard ensures the quote actually belongs to this
 * request, so a stale/foreign quote id can't be attached cross-request.
 */
export async function selectSupplierQuote(requestId: string, quoteId: string | null): Promise<boolean> {
  const supabase = createServiceClient();

  if (quoteId) {
    const { data: quote } = await supabase
      .from("supplier_quotes")
      .select("request_id, status")
      .eq("id", quoteId)
      .maybeSingle();
    if (!quote || !canSelectSupplierQuote(quote, requestId)) return false;
  }

  const { error } = await supabase
    .from("manufacturing_requests")
    .update({ selected_supplier_quote_id: quoteId })
    .eq("id", requestId);
  return !error;
}
