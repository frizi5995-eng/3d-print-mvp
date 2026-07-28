import { Suspense } from "react";
import { requireAdminUser } from "@/lib/auth/admin";
import { AdminSidebar } from "@/components/admin/sidebar";
import { signOutAdmin } from "./actions";

export default async function AdminProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAdminUser();

  return (
    <div className="flex h-full min-h-screen">
      <Suspense fallback={<div className="w-56 shrink-0 border-r border-border bg-card" />}>
        <AdminSidebar signOutAction={signOutAdmin} />
      </Suspense>
      <main className="min-w-0 flex-1 overflow-x-hidden">{children}</main>
    </div>
  );
}
