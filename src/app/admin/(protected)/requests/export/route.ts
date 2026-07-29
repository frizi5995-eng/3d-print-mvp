import "server-only";
import type { NextRequest } from "next/server";
import { requireAdminUser } from "@/lib/auth/admin";
import { listRequestsForExport, type ListRequestsParams } from "@/lib/admin/requests";
import { logAdminActivity } from "@/lib/admin/activity-log";
import { toCsv } from "@/lib/admin/csv";
import { STATUS_LABELS } from "@/lib/constants";
import { formatDateTime } from "@/lib/utils";
import type { RequestStatus } from "@/types";

const CSV_HEADERS = [
  "Reference",
  "Status",
  "Customer name",
  "Customer email",
  "Country",
  "Material",
  "Quantity",
  "Customer total (EUR)",
  "Internal cost (EUR)",
  "Gross profit (EUR)",
  "Margin (%)",
  "Created",
  "Updated",
];

/**
 * Exports the current /admin/requests filter as CSV. Only the fields safe
 * to hand an admin as a spreadsheet — never quote tokens, signed URLs,
 * internal notes/tags, or customer phone/postal code.
 */
export async function GET(request: NextRequest) {
  const admin = await requireAdminUser();

  const sp = request.nextUrl.searchParams;
  const params: Omit<ListRequestsParams, "page"> = {
    status: (sp.get("status") as RequestStatus | "all" | null) ?? "all",
    search: sp.get("q") ?? "",
    accountType: (sp.get("account") as ListRequestsParams["accountType"]) ?? "all",
    suspicious: (sp.get("suspicious") as ListRequestsParams["suspicious"]) ?? "all",
    material: sp.get("material") ?? "all",
    country: sp.get("country") ?? "all",
    hasPrice: (sp.get("hasPrice") as ListRequestsParams["hasPrice"]) ?? "all",
    quoteExpiry: (sp.get("quoteExpiry") as ListRequestsParams["quoteExpiry"]) ?? "all",
    sort: (sp.get("sort") as ListRequestsParams["sort"]) ?? "newest",
    dateFrom: sp.get("from") || undefined,
    dateTo: sp.get("to") || undefined,
  };

  const { rows, truncated } = await listRequestsForExport(params);

  const csvRows = rows.map((r) => [
    String(r.reference_number),
    STATUS_LABELS[r.status],
    r.customer_name,
    r.customer_email,
    r.country,
    r.material,
    String(r.quantity),
    r.customer_total !== null ? r.customer_total.toFixed(2) : "",
    r.internal_cost !== null ? r.internal_cost.toFixed(2) : "",
    r.gross_profit !== null ? r.gross_profit.toFixed(2) : "",
    r.margin_percent !== null ? r.margin_percent.toFixed(1) : "",
    formatDateTime(r.created_at),
    formatDateTime(r.updated_at),
  ]);

  const csv = toCsv(CSV_HEADERS, csvRows);

  await logAdminActivity(admin.email!, "requests_exported", null, {
    count: rows.length,
    truncated,
  });

  const filename = `requests-export-${new Date().toISOString().slice(0, 10)}.csv`;

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
