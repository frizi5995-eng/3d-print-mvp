import "server-only";
import { createServiceClient } from "@/lib/supabase/server";
import { computeTotals } from "@/lib/admin/money";
import { STATUS_ORDER } from "@/lib/constants";
import type { DeclineReason, RequestStatus } from "@/types";

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

export interface RequestStats {
  total: number;
  byStatus: Record<RequestStatus, number>;
  quotesPrepared: number;
  accepted: number;
  declined: number;
  /** null when no quote has been accepted or declined yet — not 0%. */
  acceptanceRate: number | null;
  declineReasons: Partial<Record<DeclineReason, number>>;
  /** null when no request has both cost and price entered yet. */
  averageMargin: number | null;
  /** Age in days of the oldest request that isn't declined/completed. null if none. */
  oldestOpenAgeDays: number | null;
}

const TERMINAL_STATUSES: RequestStatus[] = ["declined", "completed"];

export async function getRequestStats(): Promise<RequestStats> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("manufacturing_requests")
    .select(
      "status, quote_token, decline_reason, created_at, production_cost, production_shipping_cost, other_cost, customer_manufacturing_price, customer_shipping_price"
    );

  const rows = data ?? [];

  const byStatus = Object.fromEntries(STATUS_ORDER.map((s) => [s, 0])) as Record<
    RequestStatus,
    number
  >;
  const declineReasons: Partial<Record<DeclineReason, number>> = {};
  let quotesPrepared = 0;
  const margins: number[] = [];
  let oldestOpenCreatedAt: string | null = null;

  for (const row of rows) {
    const status = row.status as RequestStatus;
    byStatus[status] = (byStatus[status] ?? 0) + 1;

    if (row.quote_token) quotesPrepared += 1;

    if (status === "declined" && row.decline_reason) {
      const reason = row.decline_reason as DeclineReason;
      declineReasons[reason] = (declineReasons[reason] ?? 0) + 1;
    }

    const hasFullCosting =
      row.production_cost !== null &&
      row.production_shipping_cost !== null &&
      row.other_cost !== null &&
      row.customer_manufacturing_price !== null &&
      row.customer_shipping_price !== null;
    if (hasFullCosting) {
      margins.push(
        computeTotals({
          productionCost: row.production_cost,
          productionShippingCost: row.production_shipping_cost,
          otherCost: row.other_cost,
          customerManufacturingPrice: row.customer_manufacturing_price,
          customerShippingPrice: row.customer_shipping_price,
        }).grossMargin
      );
    }

    if (!TERMINAL_STATUSES.includes(status)) {
      if (!oldestOpenCreatedAt || row.created_at < oldestOpenCreatedAt) {
        oldestOpenCreatedAt = row.created_at as string;
      }
    }
  }

  const accepted = byStatus.accepted ?? 0;
  const declined = byStatus.declined ?? 0;
  const decided = accepted + declined;

  return {
    total: rows.length,
    byStatus,
    quotesPrepared,
    accepted,
    declined,
    acceptanceRate: decided > 0 ? accepted / decided : null,
    declineReasons,
    averageMargin: margins.length > 0 ? margins.reduce((a, b) => a + b, 0) / margins.length : null,
    oldestOpenAgeDays: oldestOpenCreatedAt
      ? Math.floor((Date.now() - new Date(oldestOpenCreatedAt).getTime()) / (1000 * 60 * 60 * 24))
      : null,
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
