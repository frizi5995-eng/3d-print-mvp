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

export type RequestSort =
  | "newest"
  | "oldest"
  | "updated"
  | "value_desc"
  | "margin_desc"
  | "margin_asc";

export interface ListRequestsParams {
  status?: RequestStatus | "all";
  search?: string;
  accountType?: "all" | "guest" | "registered";
  suspicious?: "all" | "suspicious" | "normal";
  material?: string;
  country?: string;
  dateFrom?: string;
  dateTo?: string;
  quoteExpiry?: "all" | "expiring_soon" | "expired" | "none";
  hasPrice?: "all" | "yes" | "no";
  sort?: RequestSort;
  page?: number;
}

const LIST_COLUMNS =
  "id, reference_number, status, customer_name, customer_email, customer_user_id, is_suspicious, material, country, created_at, updated_at, quote_token, quote_expires_at, production_cost, production_shipping_cost, other_cost, customer_manufacturing_price, customer_shipping_price, model_id, models(filename)";

export interface RequestListRow {
  id: string;
  reference_number: number;
  status: RequestStatus;
  customer_name: string;
  customer_email: string;
  is_registered: boolean;
  is_suspicious: boolean;
  material: string;
  country: string;
  created_at: string;
  updated_at: string;
  quote_token: string | null;
  quote_expires_at: string | null;
  customer_total: number | null;
  margin: number | null;
  model: { filename: string } | null;
}

function toListRow(row: Record<string, unknown>): RequestListRow {
  const hasPrice =
    row.customer_manufacturing_price !== null && row.customer_shipping_price !== null;
  const customerTotal = hasPrice
    ? (row.customer_manufacturing_price as number) + (row.customer_shipping_price as number)
    : null;

  const hasFullCosting =
    hasPrice &&
    row.production_cost !== null &&
    row.production_shipping_cost !== null &&
    row.other_cost !== null;

  const margin = hasFullCosting
    ? computeTotals({
        productionCost: row.production_cost as number,
        productionShippingCost: row.production_shipping_cost as number,
        otherCost: row.other_cost as number,
        customerManufacturingPrice: row.customer_manufacturing_price as number,
        customerShippingPrice: row.customer_shipping_price as number,
      }).grossMargin
    : null;

  return {
    id: row.id as string,
    reference_number: row.reference_number as number,
    status: row.status as RequestStatus,
    customer_name: row.customer_name as string,
    customer_email: row.customer_email as string,
    is_registered: row.customer_user_id !== null,
    is_suspicious: row.is_suspicious as boolean,
    material: row.material as string,
    country: row.country as string,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
    quote_token: row.quote_token as string | null,
    quote_expires_at: row.quote_expires_at as string | null,
    customer_total: customerTotal,
    margin,
    model: unwrapOne(row.models as { filename: string } | { filename: string }[] | null),
  };
}

export async function listRequests(params: ListRequestsParams) {
  const { status, search, accountType, suspicious, material, country, dateFrom, dateTo, quoteExpiry, hasPrice, sort = "newest", page = 1 } =
    params;
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

  let query = supabase.from("manufacturing_requests").select(LIST_COLUMNS, { count: "exact" });

  if (status && status !== "all") query = query.eq("status", status);
  if (accountType === "guest") query = query.is("customer_user_id", null);
  if (accountType === "registered") query = query.not("customer_user_id", "is", null);
  if (suspicious === "suspicious") query = query.eq("is_suspicious", true);
  if (suspicious === "normal") query = query.eq("is_suspicious", false);
  if (material && material !== "all") query = query.eq("material", material);
  if (country && country !== "all") query = query.ilike("country", country);
  if (dateFrom) query = query.gte("created_at", dateFrom);
  if (dateTo) query = query.lte("created_at", dateTo);
  if (hasPrice === "yes") query = query.not("customer_manufacturing_price", "is", null);
  if (hasPrice === "no") query = query.is("customer_manufacturing_price", null);

  if (quoteExpiry === "none") {
    query = query.is("quote_expires_at", null);
  } else if (quoteExpiry === "expired") {
    query = query.not("quote_expires_at", "is", null).lt("quote_expires_at", new Date().toISOString());
  } else if (quoteExpiry === "expiring_soon") {
    query = query
      .not("quote_expires_at", "is", null)
      .gte("quote_expires_at", new Date().toISOString())
      .lte("quote_expires_at", new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString());
  }

  if (cleanSearch) {
    const orParts = [
      `customer_name.ilike.%${cleanSearch}%`,
      `customer_email.ilike.%${cleanSearch}%`,
      `customer_phone.ilike.%${cleanSearch}%`,
    ];
    const asNumber = Number(cleanSearch);
    if (Number.isInteger(asNumber)) orParts.push(`reference_number.eq.${asNumber}`);
    if (modelIds.length) orParts.push(`model_id.in.(${modelIds.join(",")})`);
    query = query.or(orParts.join(","));
  }

  // value/margin sorting needs the computed field, which PostgREST can't
  // sort by directly — fetch every filtered row (fine at MVP volumes),
  // compute + sort in JS, then slice the page. Plain column sorts stay
  // fully server-side paginated.
  if (sort === "value_desc" || sort === "margin_desc" || sort === "margin_asc") {
    const { data } = await query;
    let rows = (data ?? []).map(toListRow);
    rows =
      sort === "value_desc"
        ? rows.sort((a, b) => (b.customer_total ?? -Infinity) - (a.customer_total ?? -Infinity))
        : sort === "margin_desc"
          ? rows.sort((a, b) => (b.margin ?? -Infinity) - (a.margin ?? -Infinity))
          : rows.sort((a, b) => (a.margin ?? Infinity) - (b.margin ?? Infinity));
    const total = rows.length;
    const from = (page - 1) * PAGE_SIZE;
    return { rows: rows.slice(from, from + PAGE_SIZE), total, page, pageSize: PAGE_SIZE };
  }

  query = query.order(
    sort === "oldest" ? "created_at" : sort === "updated" ? "updated_at" : "created_at",
    { ascending: sort === "oldest" }
  );

  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;
  const { data, count } = await query.range(from, to);

  return {
    rows: (data ?? []).map(toListRow),
    total: count ?? 0,
    page,
    pageSize: PAGE_SIZE,
  };
}

export async function getFilterOptions() {
  const supabase = createServiceClient();
  const { data } = await supabase.from("manufacturing_requests").select("country");
  const countries = Array.from(new Set((data ?? []).map((r) => r.country as string))).sort();
  return { countries };
}

/**
 * Grouped by customer_user_id when registered, else by normalized email for
 * guests — display purposes only, matching email is never treated as
 * verified identity (see Milestone 17's /admin/customers for the same rule).
 */
export async function getCustomerRequestCounts(customerUserId: string | null, email: string) {
  const supabase = createServiceClient();
  let query = supabase.from("manufacturing_requests").select("status");
  query = customerUserId ? query.eq("customer_user_id", customerUserId) : query.ilike("customer_email", email);

  const { data } = await query;
  const rows = data ?? [];
  return {
    total: rows.length,
    accepted: rows.filter((r) => r.status === "accepted" || r.status === "manufacturing" || r.status === "shipped" || r.status === "completed").length,
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
