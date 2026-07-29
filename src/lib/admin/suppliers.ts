import "server-only";
import { createServiceClient } from "@/lib/supabase/server";
import type { Supplier } from "@/types";

export interface ListSuppliersParams {
  active?: "all" | "active" | "inactive";
  country?: string;
  technology?: string;
}

export async function listSuppliers(params: ListSuppliersParams = {}): Promise<Supplier[]> {
  const supabase = createServiceClient();
  let query = supabase.from("suppliers").select("*");

  if (params.active === "active") query = query.eq("active", true);
  if (params.active === "inactive") query = query.eq("active", false);
  if (params.country && params.country !== "all") query = query.eq("country", params.country);
  if (params.technology && params.technology !== "all") query = query.contains("technologies", [params.technology]);

  query = query.order("preferred", { ascending: false }).order("name", { ascending: true });

  const { data } = await query;
  return (data ?? []) as Supplier[];
}

export async function getSupplierById(id: string): Promise<Supplier | null> {
  const supabase = createServiceClient();
  const { data } = await supabase.from("suppliers").select("*").eq("id", id).maybeSingle();
  return (data as Supplier | null) ?? null;
}

export async function getSupplierCountries(): Promise<string[]> {
  const supabase = createServiceClient();
  const { data } = await supabase.from("suppliers").select("country");
  return Array.from(new Set((data ?? []).map((r) => r.country as string))).sort();
}

export interface SupplierInput {
  name: string;
  country: string;
  website: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  notes: string | null;
  technologies: string[];
  materials: string[];
  api_provider: string | null;
  api_enabled: boolean;
  preferred: boolean;
  reliability_score: number | null;
}

export function validateSupplierInput(input: SupplierInput): string[] {
  const errors: string[] = [];
  if (!input.name.trim()) errors.push("Name is required.");
  if (!input.country.trim()) errors.push("Country is required.");
  if (input.contact_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.contact_email)) {
    errors.push("Contact email must be a valid email address.");
  }
  if (
    input.reliability_score !== null &&
    (!Number.isFinite(input.reliability_score) || input.reliability_score < 0 || input.reliability_score > 10)
  ) {
    errors.push("Reliability score must be between 0 and 10.");
  }
  if (input.api_enabled && !input.api_provider) {
    errors.push("An API provider is required when API integration is enabled.");
  }
  return errors;
}

export async function createSupplier(input: SupplierInput): Promise<{ id: string }> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("suppliers")
    .insert({
      name: input.name.trim(),
      country: input.country.trim(),
      website: input.website?.trim() || null,
      contact_email: input.contact_email?.trim() || null,
      contact_phone: input.contact_phone?.trim() || null,
      notes: input.notes?.trim() || null,
      technologies: input.technologies,
      materials: input.materials,
      api_provider: input.api_provider,
      api_enabled: input.api_enabled,
      preferred: input.preferred,
      reliability_score: input.reliability_score,
    })
    .select("id")
    .single();
  if (error) throw error;
  return data;
}

export async function updateSupplier(id: string, input: SupplierInput): Promise<void> {
  const supabase = createServiceClient();
  const { error } = await supabase
    .from("suppliers")
    .update({
      name: input.name.trim(),
      country: input.country.trim(),
      website: input.website?.trim() || null,
      contact_email: input.contact_email?.trim() || null,
      contact_phone: input.contact_phone?.trim() || null,
      notes: input.notes?.trim() || null,
      technologies: input.technologies,
      materials: input.materials,
      api_provider: input.api_provider,
      api_enabled: input.api_enabled,
      preferred: input.preferred,
      reliability_score: input.reliability_score,
    })
    .eq("id", id);
  if (error) throw error;
}

/** Disable/enable only — suppliers are never hard-deleted so quote history stays intact. */
export async function setSupplierActive(id: string, active: boolean): Promise<void> {
  const supabase = createServiceClient();
  const { error } = await supabase.from("suppliers").update({ active }).eq("id", id);
  if (error) throw error;
}
