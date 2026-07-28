import { redirect } from "next/navigation";
import { Box } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { AdminLoginForm } from "@/components/admin/login-form";
import { getAdminUser } from "@/lib/auth/admin";

export default async function AdminLoginPage() {
  const admin = await getAdminUser();
  if (admin) redirect("/admin/requests");

  return (
    <div className="flex min-h-full flex-1 items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center gap-2 text-center">
          <Box className="size-6 text-primary" strokeWidth={2} />
          <h1 className="text-lg font-semibold tracking-tight">Fabrik admin</h1>
          <p className="text-sm text-muted-foreground">Sign in to manage requests.</p>
        </div>

        <Card>
          <CardContent>
            <AdminLoginForm />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
