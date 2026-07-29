import "server-only";
import { createServiceClient } from "@/lib/supabase/server";
import type { RequestStatus } from "@/types";

const ACCEPTED_ONWARD: RequestStatus[] = ["accepted", "manufacturing", "shipped", "completed"];
const OPEN_STATUSES_EXCLUDE: RequestStatus[] = ["declined", "completed"];

export interface CustomerSummary {
  /** "u:<userId>" for registered customers, "e:<normalized email>" for guests. */
  key: string;
  isRegistered: boolean;
  userId: string | null;
  email: string;
  name: string;
  totalRequests: number;
  acceptedRequests: number;
  completedRequests: number;
  openRequests: number;
  totalAcceptedValue: number;
  lastRequestAt: string;
}

/**
 * Guest requests are grouped by normalized email for operational display
 * only — this is NOT proof of identity, just a convenience for "these guest
 * submissions probably came from the same person." Registered customers are
 * grouped by the verified customer_user_id instead.
 */
export async function listCustomers(): Promise<CustomerSummary[]> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("manufacturing_requests")
    .select(
      "customer_user_id, customer_name, customer_email, status, customer_manufacturing_price, customer_shipping_price, created_at"
    );

  const groups = new Map<string, CustomerSummary>();

  for (const row of data ?? []) {
    const userId = row.customer_user_id as string | null;
    const email = row.customer_email as string;
    const key = userId ? `u:${userId}` : `e:${email.toLowerCase()}`;
    const status = row.status as RequestStatus;
    const createdAt = row.created_at as string;

    let group = groups.get(key);
    if (!group) {
      group = {
        key,
        isRegistered: Boolean(userId),
        userId,
        email,
        name: row.customer_name as string,
        totalRequests: 0,
        acceptedRequests: 0,
        completedRequests: 0,
        openRequests: 0,
        totalAcceptedValue: 0,
        lastRequestAt: createdAt,
      };
      groups.set(key, group);
    }

    group.totalRequests += 1;
    if (createdAt > group.lastRequestAt) {
      group.lastRequestAt = createdAt;
      group.name = row.customer_name as string;
    }
    if (ACCEPTED_ONWARD.includes(status)) {
      group.acceptedRequests += 1;
      if (row.customer_manufacturing_price !== null && row.customer_shipping_price !== null) {
        group.totalAcceptedValue +=
          (row.customer_manufacturing_price as number) + (row.customer_shipping_price as number);
      }
    }
    if (status === "completed") group.completedRequests += 1;
    if (!OPEN_STATUSES_EXCLUDE.includes(status)) group.openRequests += 1;
  }

  return Array.from(groups.values()).sort(
    (a, b) => new Date(b.lastRequestAt).getTime() - new Date(a.lastRequestAt).getTime()
  );
}

export interface CustomerAccountInfo {
  email: string;
  createdAt: string;
  lastSignInAt: string | null;
  emailConfirmed: boolean;
}

/** Only ever returns these four safe fields — never the raw Supabase Auth user object. */
export async function getCustomerAccountInfo(userId: string): Promise<CustomerAccountInfo | null> {
  const supabase = createServiceClient();
  const { data, error } = await supabase.auth.admin.getUserById(userId);
  if (error || !data.user) return null;
  return {
    email: data.user.email ?? "",
    createdAt: data.user.created_at,
    lastSignInAt: data.user.last_sign_in_at ?? null,
    emailConfirmed: Boolean(data.user.email_confirmed_at),
  };
}

export interface CustomerRequestRow {
  id: string;
  reference_number: number;
  status: RequestStatus;
  created_at: string;
  customer_name: string;
  customer_email: string;
  model_filename: string | null;
  customer_total: number | null;
}

function unwrapModel(value: unknown): { filename: string } | null {
  if (Array.isArray(value)) return (value[0] as { filename: string } | undefined) ?? null;
  return (value as { filename: string } | null) ?? null;
}

export async function getCustomerRequests(
  userId: string | null,
  email: string
): Promise<CustomerRequestRow[]> {
  const supabase = createServiceClient();
  let query = supabase
    .from("manufacturing_requests")
    .select(
      "id, reference_number, status, created_at, customer_name, customer_email, customer_manufacturing_price, customer_shipping_price, models(filename)"
    )
    .order("created_at", { ascending: false });
  query = userId ? query.eq("customer_user_id", userId) : query.ilike("customer_email", email);

  const { data } = await query;
  return (data ?? []).map((row) => ({
    id: row.id as string,
    reference_number: row.reference_number as number,
    status: row.status as RequestStatus,
    created_at: row.created_at as string,
    customer_name: row.customer_name as string,
    customer_email: row.customer_email as string,
    model_filename: unwrapModel(row.models)?.filename ?? null,
    customer_total:
      row.customer_manufacturing_price !== null && row.customer_shipping_price !== null
        ? (row.customer_manufacturing_price as number) + (row.customer_shipping_price as number)
        : null,
  }));
}
