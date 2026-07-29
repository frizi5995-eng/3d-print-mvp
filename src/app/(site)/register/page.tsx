import { redirect } from "next/navigation";
import { Container } from "@/components/layout/container";
import { Card, CardContent } from "@/components/ui/card";
import { RegisterForm } from "@/components/account/register-form";
import { getCurrentUser } from "@/lib/auth/customer";

export default async function RegisterPage() {
  const user = await getCurrentUser();
  if (user) redirect("/account");

  return (
    <Container className="flex flex-1 items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center gap-2 text-center">
          <h1 className="text-lg font-semibold tracking-tight">Create an account</h1>
          <p className="text-sm text-muted-foreground">
            Optional — track your requests and quotes in one place. You can also
            upload and request a quote without an account.
          </p>
        </div>

        <Card>
          <CardContent>
            <RegisterForm />
          </CardContent>
        </Card>
      </div>
    </Container>
  );
}
