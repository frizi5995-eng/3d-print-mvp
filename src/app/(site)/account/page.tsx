import Link from "next/link";
import { Container } from "@/components/layout/container";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { requireCustomerUser } from "@/lib/auth/customer";
import { signOutCustomer } from "@/app/(site)/account/actions";

export default async function AccountPage() {
  const user = await requireCustomerUser();

  return (
    <Container className="flex flex-col gap-6 py-10 sm:py-14">
      <h1 className="text-2xl font-semibold tracking-tight">Account</h1>

      <Card className="max-w-md">
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">Signed in as</span>
            <span className="font-medium">{user.email}</span>
          </div>

          <Button nativeButton={false} render={<Link href="/account/requests" />}>
            My requests
          </Button>

          <form action={signOutCustomer}>
            <Button type="submit" variant="outline" className="w-full">
              Sign out
            </Button>
          </form>
        </CardContent>
      </Card>
    </Container>
  );
}
