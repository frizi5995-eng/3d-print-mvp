import { describe, it, expect, vi, beforeEach } from "vitest";
import type { User } from "@supabase/supabase-js";

const calls: { method: string; args: unknown[] }[] = [];

function makeQueryBuilder() {
  const builder: Record<string, unknown> = {};
  for (const method of ["update", "is", "ilike"]) {
    builder[method] = (...args: unknown[]) => {
      calls.push({ method, args });
      return builder;
    };
  }
  return builder;
}

vi.mock("@/lib/supabase/server", () => ({
  createServiceClient: () => ({
    from: (table: string) => {
      calls.push({ method: "from", args: [table] });
      return makeQueryBuilder();
    },
  }),
}));

const { claimRequestsForAuthenticatedUser } = await import("./claim-requests");

function user(overrides: Record<string, unknown>): User {
  return {
    id: "user-1",
    email: "test@example.com",
    email_confirmed_at: "2026-01-01T00:00:00Z",
    app_metadata: {},
    user_metadata: {},
    aud: "authenticated",
    created_at: "2026-01-01T00:00:00Z",
    ...overrides,
  } as User;
}

beforeEach(() => {
  calls.length = 0;
});

describe("claimRequestsForAuthenticatedUser", () => {
  it("verified user triggers a claim query scoped to their id and email", async () => {
    await claimRequestsForAuthenticatedUser(user({ id: "user-1", email: "match@example.com" }));

    expect(calls.some((c) => c.method === "from" && c.args[0] === "manufacturing_requests")).toBe(true);
    expect(calls.some((c) => c.method === "update" && (c.args[0] as { customer_user_id: string }).customer_user_id === "user-1")).toBe(
      true
    );
    expect(calls.some((c) => c.method === "ilike" && c.args[1] === "match@example.com")).toBe(true);
  });

  it("only ever filters by customer_user_id IS NULL — an already-owned request is never reassigned", async () => {
    await claimRequestsForAuthenticatedUser(user({}));
    expect(calls.some((c) => c.method === "is" && c.args[0] === "customer_user_id" && c.args[1] === null)).toBe(
      true
    );
  });

  it("unverified user (no email_confirmed_at) never issues any DB call — cannot claim another email's requests either", async () => {
    await claimRequestsForAuthenticatedUser(user({ email_confirmed_at: null, email: "victim@example.com" }));
    expect(calls.length).toBe(0);
  });

  it("is idempotent: calling twice for the same verified user issues the same guarded query both times", async () => {
    const u = user({ id: "user-2", email: "repeat@example.com" });
    await claimRequestsForAuthenticatedUser(u);
    const firstCallCount = calls.length;
    await claimRequestsForAuthenticatedUser(u);
    expect(calls.length).toBe(firstCallCount * 2);
    expect(calls.filter((c) => c.method === "is" && c.args[1] === null).length).toBe(2);
  });

  it("user with no email never issues a DB call", async () => {
    await claimRequestsForAuthenticatedUser(user({ email: undefined }));
    expect(calls.length).toBe(0);
  });
});
