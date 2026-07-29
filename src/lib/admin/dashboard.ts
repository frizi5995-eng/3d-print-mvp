import "server-only";
import { createServiceClient } from "@/lib/supabase/server";
import { computeTotals } from "@/lib/admin/money";
import { startOfDayRiga, formatDate } from "@/lib/utils";
import { STATUS_ORDER } from "@/lib/constants";
import type { RequestStatus } from "@/types";

export type DashboardRange = "today" | "7d" | "30d" | "90d" | "all";

export const DASHBOARD_RANGE_LABELS: Record<DashboardRange, string> = {
  today: "Today",
  "7d": "7 days",
  "30d": "30 days",
  "90d": "90 days",
  all: "All time",
};

const RANGE_DAYS: Record<DashboardRange, number | null> = {
  today: 0,
  "7d": 6,
  "30d": 29,
  "90d": 89,
  all: null,
};

function rangeStartIso(range: DashboardRange, now: number): string | null {
  const daysBack = RANGE_DAYS[range];
  if (daysBack === null) return null;
  return startOfDayRiga(now - daysBack * 86_400_000).toISOString();
}

/** Sortable Riga-local day key (YYYY-MM-DD) — chart display labels are
 * derived from this, not the other way around, so "over time" charts sort
 * correctly regardless of formatDate()'s display format. */
function rigaDayKey(iso: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Riga",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));
}

export interface RequestSummary {
  id: string;
  reference_number: number;
  customer_name: string;
  status: RequestStatus;
  created_at: string;
  updated_at: string;
  quote_expires_at: string | null;
  model_filename: string | null;
}

function unwrapModel(value: unknown): { filename: string } | null {
  if (Array.isArray(value)) return (value[0] as { filename: string } | undefined) ?? null;
  return (value as { filename: string } | null) ?? null;
}

const SUMMARY_COLUMNS =
  "id, reference_number, customer_name, status, created_at, updated_at, quote_expires_at, models(filename)";

function toSummary(row: Record<string, unknown>): RequestSummary {
  return {
    id: row.id as string,
    reference_number: row.reference_number as number,
    customer_name: row.customer_name as string,
    status: row.status as RequestStatus,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
    quote_expires_at: row.quote_expires_at as string | null,
    model_filename: unwrapModel(row.models)?.filename ?? null,
  };
}

const PRE_QUOTE_STATUSES: RequestStatus[] = ["new", "checking", "waiting_for_partner"];
const HAS_QUOTE_STATUSES: RequestStatus[] = [
  "quote_ready",
  "quote_sent",
  "accepted",
  "manufacturing",
  "shipped",
  "completed",
];
const ACCEPTED_ONWARD_STATUSES: RequestStatus[] = [
  "accepted",
  "manufacturing",
  "shipped",
  "completed",
];

export async function getDashboardData(range: DashboardRange) {
  const supabase = createServiceClient();
  const now = Date.now();
  const rangeStart = rangeStartIso(range, now);
  const todayStart = startOfDayRiga(now).toISOString();
  const weekStart = startOfDayRiga(now - 6 * 86_400_000).toISOString();

  // One bounded query drives KPIs/financial/conversion/charts for the
  // selected period — minimal columns, aggregated in JS. At MVP data
  // volumes this is simpler and just as fast as a bespoke SQL aggregate,
  // without needing a Postgres function for every new metric.
  let periodQuery = supabase
    .from("manufacturing_requests")
    .select(
      "status, created_at, customer_manufacturing_price, customer_shipping_price, production_cost, production_shipping_cost, other_cost, quote_token, material"
    );
  if (rangeStart) periodQuery = periodQuery.gte("created_at", rangeStart);
  const { data: periodRows } = await periodQuery;
  const rows = periodRows ?? [];

  // Requests today/this week are always "as of now", independent of the
  // selected range filter (they answer a fixed question, not a filtered one).
  const [{ count: requestsToday }, { count: requestsThisWeek }] = await Promise.all([
    supabase
      .from("manufacturing_requests")
      .select("id", { count: "exact", head: true })
      .gte("created_at", todayStart),
    supabase
      .from("manufacturing_requests")
      .select("id", { count: "exact", head: true })
      .gte("created_at", weekStart),
  ]);

  const byStatus = Object.fromEntries(STATUS_ORDER.map((s) => [s, 0])) as Record<
    RequestStatus,
    number
  >;
  let quotedRevenue = 0;
  let quotedCount = 0;
  let acceptedRevenue = 0;
  let acceptedInternalCost = 0;
  let acceptedCostedCount = 0;
  const marginPercents: number[] = [];
  let quotesPrepared = 0;
  const requestsByDay = new Map<string, number>();
  const acceptedByDay = new Map<string, number>();
  const declinedByDay = new Map<string, number>();
  const revenueByDay = new Map<string, number>();
  const materialCounts = new Map<string, number>();

  for (const row of rows) {
    const status = row.status as RequestStatus;
    byStatus[status] = (byStatus[status] ?? 0) + 1;
    if (row.quote_token) quotesPrepared += 1;
    materialCounts.set(row.material, (materialCounts.get(row.material) ?? 0) + 1);

    const dayKey = rigaDayKey(row.created_at as string);
    requestsByDay.set(dayKey, (requestsByDay.get(dayKey) ?? 0) + 1);
    if (status === "accepted") acceptedByDay.set(dayKey, (acceptedByDay.get(dayKey) ?? 0) + 1);
    if (status === "declined") declinedByDay.set(dayKey, (declinedByDay.get(dayKey) ?? 0) + 1);

    const hasCustomerPrice =
      row.customer_manufacturing_price !== null && row.customer_shipping_price !== null;
    if (HAS_QUOTE_STATUSES.includes(status) && hasCustomerPrice) {
      const total = row.customer_manufacturing_price! + row.customer_shipping_price!;
      quotedRevenue += total;
      quotedCount += 1;
    }

    if (ACCEPTED_ONWARD_STATUSES.includes(status) && hasCustomerPrice) {
      const total = row.customer_manufacturing_price! + row.customer_shipping_price!;
      acceptedRevenue += total;
      revenueByDay.set(dayKey, (revenueByDay.get(dayKey) ?? 0) + total);

      const hasFullCosting =
        row.production_cost !== null &&
        row.production_shipping_cost !== null &&
        row.other_cost !== null;
      if (hasFullCosting) {
        const totals = computeTotals({
          productionCost: row.production_cost,
          productionShippingCost: row.production_shipping_cost,
          otherCost: row.other_cost,
          customerManufacturingPrice: row.customer_manufacturing_price,
          customerShippingPrice: row.customer_shipping_price,
        });
        acceptedInternalCost += totals.internalCost;
        acceptedCostedCount += 1;
        if (totals.marginPercent !== null) marginPercents.push(totals.marginPercent);
      }
    }
  }

  const accepted = byStatus.accepted;
  const declined = byStatus.declined;
  const decided = accepted + declined;
  const grossProfit = acceptedCostedCount > 0 ? acceptedRevenue - acceptedInternalCost : null;

  // All four maps share the same key space (rigaDayKey), which sorts
  // correctly as a plain string (YYYY-MM-DD) — no date parsing needed.
  const allDayKeys = new Set([
    ...requestsByDay.keys(),
    ...acceptedByDay.keys(),
    ...declinedByDay.keys(),
    ...revenueByDay.keys(),
  ]);
  const dayKeysInOrder = Array.from(allDayKeys).sort();
  const dayLabel = (key: string) => formatDate(`${key}T12:00:00Z`);

  const [newest, needingAttention, oldestOpen, quotesExpiringSoon, awaitingManufacturing, awaitingShipment, suspicious] =
    await Promise.all([
      supabase
        .from("manufacturing_requests")
        .select(SUMMARY_COLUMNS)
        .order("created_at", { ascending: false })
        .limit(5),
      supabase
        .from("manufacturing_requests")
        .select(SUMMARY_COLUMNS)
        .eq("status", "new")
        .lt("created_at", new Date(now - 24 * 60 * 60 * 1000).toISOString())
        .order("created_at", { ascending: true })
        .limit(5),
      supabase
        .from("manufacturing_requests")
        .select(SUMMARY_COLUMNS)
        .in("status", PRE_QUOTE_STATUSES)
        .order("created_at", { ascending: true })
        .limit(5),
      supabase
        .from("manufacturing_requests")
        .select(SUMMARY_COLUMNS)
        .in("status", ["quote_ready", "quote_sent"])
        .gte("quote_expires_at", new Date(now).toISOString())
        .lte("quote_expires_at", new Date(now + 48 * 60 * 60 * 1000).toISOString())
        .order("quote_expires_at", { ascending: true })
        .limit(5),
      supabase
        .from("manufacturing_requests")
        .select(SUMMARY_COLUMNS)
        .eq("status", "accepted")
        .order("updated_at", { ascending: true })
        .limit(5),
      supabase
        .from("manufacturing_requests")
        .select(SUMMARY_COLUMNS)
        .eq("status", "manufacturing")
        .order("updated_at", { ascending: true })
        .limit(5),
      supabase
        .from("manufacturing_requests")
        .select(SUMMARY_COLUMNS)
        .eq("is_suspicious", true)
        .order("created_at", { ascending: false })
        .limit(5),
    ]);

  return {
    range,
    kpis: {
      requestsToday: requestsToday ?? 0,
      requestsThisWeek: requestsThisWeek ?? 0,
      open: PRE_QUOTE_STATUSES.reduce((sum, s) => sum + byStatus[s], 0),
      awaitingReview: byStatus.new,
      quotesReady: byStatus.quote_ready + byStatus.quote_sent,
      accepted: byStatus.accepted,
      manufacturing: byStatus.manufacturing,
      shipped: byStatus.shipped,
      completed: byStatus.completed,
    },
    financial: {
      quotedRevenue: quotedCount > 0 ? quotedRevenue : null,
      acceptedRevenue: acceptedRevenue > 0 || accepted > 0 ? acceptedRevenue : null,
      internalCost: acceptedCostedCount > 0 ? acceptedInternalCost : null,
      grossProfit,
      avgQuoteValue: quotedCount > 0 ? quotedRevenue / quotedCount : null,
      avgGrossMargin:
        marginPercents.length > 0
          ? marginPercents.reduce((a, b) => a + b, 0) / marginPercents.length
          : null,
    },
    conversion: {
      requests: rows.length,
      quotesPrepared,
      accepted,
      declined,
      acceptanceRate: decided > 0 ? accepted / decided : null,
    },
    charts: {
      requestsOverTime: dayKeysInOrder.map((day) => ({
        label: dayLabel(day),
        count: requestsByDay.get(day) ?? 0,
      })),
      acceptedVsDeclined: dayKeysInOrder
        .filter((day) => (acceptedByDay.get(day) ?? 0) > 0 || (declinedByDay.get(day) ?? 0) > 0)
        .map((day) => ({
          label: dayLabel(day),
          accepted: acceptedByDay.get(day) ?? 0,
          declined: declinedByDay.get(day) ?? 0,
        })),
      statusDistribution: STATUS_ORDER.map((status) => ({ status, count: byStatus[status] })).filter(
        (s) => s.count > 0
      ),
      revenueOverTime: dayKeysInOrder
        .filter((day) => revenueByDay.has(day))
        .map((day) => ({ label: dayLabel(day), revenue: revenueByDay.get(day)! })),
      materials: Array.from(materialCounts.entries()).map(([material, count]) => ({
        material,
        count,
      })),
    },
    widgets: {
      newest: (newest.data ?? []).map(toSummary),
      needingAttention: (needingAttention.data ?? []).map(toSummary),
      oldestOpen: (oldestOpen.data ?? []).map(toSummary),
      quotesExpiringSoon: (quotesExpiringSoon.data ?? []).map(toSummary),
      awaitingManufacturing: (awaitingManufacturing.data ?? []).map(toSummary),
      awaitingShipment: (awaitingShipment.data ?? []).map(toSummary),
      suspicious: (suspicious.data ?? []).map(toSummary),
    },
  };
}
