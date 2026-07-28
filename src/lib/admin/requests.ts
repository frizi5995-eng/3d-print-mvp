import "server-only";
import { createServiceClient } from "@/lib/supabase/server";
import type { RequestStatus } from "@/types";

const PAGE_SIZE = 20;

/**
 * Strips characters that are significant in either a PostgREST `.or()`
 * filter string or an `ilike` pattern, since the search term is spliced
 * into a raw filter string below.
 */
function sanitizeSearchTerm(term: string): string {
  return term.trim().slice(0, 100).replace(/[,()%_]/g, " ").trim();
}

function unwrapOne<T>(value: T | T[] | null): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

export async function listRequests({
  status,
  search,
  page = 1,
}: {
  status?: RequestStatus | "all";
  search?: string;
  page?: number;
}) {
  const supabase = createServiceClient();
  const cleanSearch = search ? sanitizeSearchTerm(search) : "";

  let modelIds: string[] = [];
  if (cleanSearch) {
    const { data: matches } = await supabase
      .from("models")
      .select("id")
      .ilike("filename", `%${cleanSearch}%`)
      .limit(50);
    modelIds = (matches ?? []).map((m) => m.id as string);
  }

  let query = supabase
    .from("manufacturing_requests")
    .select(
      "id, reference_number, status, customer_name, customer_email, created_at, model_id, models(filename)",
      { count: "exact" }
    )
    .order("created_at", { ascending: false });

  if (status && status !== "all") {
    query = query.eq("status", status);
  }

  if (cleanSearch) {
    const orParts = [
      `customer_name.ilike.%${cleanSearch}%`,
      `customer_email.ilike.%${cleanSearch}%`,
    ];
    const asNumber = Number(cleanSearch);
    if (Number.isInteger(asNumber)) {
      orParts.push(`reference_number.eq.${asNumber}`);
    }
    if (modelIds.length) {
      orParts.push(`model_id.in.(${modelIds.join(",")})`);
    }
    query = query.or(orParts.join(","));
  }

  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;
  const { data, count } = await query.range(from, to);

  return {
    rows: (data ?? []).map((row) => ({
      id: row.id as string,
      reference_number: row.reference_number as number,
      status: row.status as RequestStatus,
      customer_name: row.customer_name as string,
      customer_email: row.customer_email as string,
      created_at: row.created_at as string,
      model: unwrapOne(row.models as { filename: string } | { filename: string }[] | null),
    })),
    total: count ?? 0,
    page,
    pageSize: PAGE_SIZE,
  };
}

export async function getRequestById(id: string) {
  const supabase = createServiceClient();

  const { data: request } = await supabase
    .from("manufacturing_requests")
    .select("*, models(*)")
    .eq("id", id)
    .maybeSingle();

  if (!request) return null;

  const { data: history } = await supabase
    .from("status_history")
    .select("*")
    .eq("request_id", id)
    .order("created_at", { ascending: true });

  const { models, ...requestFields } = request as Record<string, unknown> & { models: unknown };

  return {
    request: requestFields,
    model: unwrapOne(models as Record<string, unknown> | Record<string, unknown>[] | null),
    history: history ?? [],
  };
}
