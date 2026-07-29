import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/layout/container";
import { Logo } from "@/components/layout/logo";
import { getCurrentUser } from "@/lib/auth/customer";
import { getAdminUser } from "@/lib/auth/admin";

const NAV_LINKS = [
  { href: "/#how-it-works", label: "How it works" },
  { href: "/#materials", label: "Materials" },
  { href: "/#faq", label: "FAQ" },
];

export async function Header() {
  const user = await getCurrentUser();
  // Reuses the exact same ADMIN_EMAILS allowlist check as /admin — no
  // separate admin-role definition here.
  const admin = user ? await getAdminUser() : null;

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur">
      <Container className="flex h-14 items-center justify-between">
        <Logo />

        <nav className="hidden items-center gap-6 md:flex">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              {link.label}
            </Link>
          ))}
          {user && (
            <Link
              href="/account/requests"
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              My requests
            </Link>
          )}
          {admin && (
            <Link
              href="/admin/dashboard"
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              Admin
            </Link>
          )}
          <Link
            href={user ? "/account" : "/login"}
            className="text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            {user ? "Account" : "Sign in"}
          </Link>
        </nav>

        <Button size="sm" nativeButton={false} render={<Link href="/#upload" />}>
          Upload model
        </Button>
      </Container>
    </header>
  );
}
