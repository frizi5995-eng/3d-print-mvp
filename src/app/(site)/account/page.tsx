import Link from "next/link";
import { Container } from "@/components/layout/container";
import { Button } from "@/components/ui/button";
import { requireCustomerUser } from "@/lib/auth/customer";
import { getMyDashboardCounts } from "@/lib/customer/requests";
import { signOutCustomer } from "@/app/(site)/account/actions";

export default async function AccountPage() {
  const user = await requireCustomerUser();
  const counts = await getMyDashboardCounts(user.id);

  const tiles = [
    { label: "Active requests", value: counts.active, href: "/account/requests?filter=all" },
    { label: "Quotes to review", value: counts.quotesRequiringAction, href: "/account/requests?filter=quote_ready" },
    { label: "Awaiting payment", value: counts.awaitingPayment, href: "/account/requests?filter=accepted" },
    { label: "In manufacturing", value: counts.manufacturing, href: "/account/requests?filter=manufacturing" },
    { label: "Shipped", value: counts.shipped, href: "/account/requests?filter=shipped" },
    { label: "Completed", value: counts.completed, href: "/account/requests?filter=completed" },
  ];

  return (
    <Container className="flex flex-col gap-6 py-10 sm:py-14">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Account</h1>
          <p className="mt-1 text-sm text-muted-foreground">Signed in as {user.email}</p>
        </div>
        <form action={signOutCustomer}>
          <Button type="submit" variant="outline">
            Sign out
          </Button>
        </form>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {tiles.map((tile) => (
          <Link
            key={tile.label}
            href={tile.href}
            className="flex flex-col gap-1 rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary/50"
          >
            <span className="text-2xl font-semibold">{tile.value}</span>
            <span className="text-sm text-muted-foreground">{tile.label}</span>
          </Link>
        ))}
      </div>

      <Button nativeButton={false} render={<Link href="/account/requests" />} className="w-fit">
        View all requests
      </Button>
    </Container>
  );
}
