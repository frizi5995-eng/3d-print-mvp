import { redirect } from "next/navigation";
import { Container } from "@/components/layout/container";
import { Card, CardContent } from "@/components/ui/card";
import { LoginForm } from "@/components/account/login-form";
import { getCurrentUser } from "@/lib/auth/customer";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const user = await getCurrentUser();
  if (user) redirect("/account");
  const { error } = await searchParams;

  return (
    <Container className="flex flex-1 items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center gap-2 text-center">
          <h1 className="text-lg font-semibold tracking-tight">Sign in</h1>
          <p className="text-sm text-muted-foreground">
            Sign in to view your requests and quotes.
          </p>
        </div>

        {error && (
          <p className="mb-4 rounded-lg bg-destructive/10 px-3 py-2 text-center text-sm text-destructive">
            Sign-in didn&apos;t complete. Please try again.
          </p>
        )}

        <Card>
          <CardContent>
            <LoginForm />
          </CardContent>
        </Card>
      </div>
    </Container>
  );
}
