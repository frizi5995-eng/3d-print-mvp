import Link from "next/link";
import { Container } from "@/components/layout/container";

export function Footer() {
  return (
    <footer className="border-t border-border/80">
      <Container className="flex flex-col items-center justify-between gap-4 py-8 text-sm text-muted-foreground sm:flex-row">
        <span>© {new Date().getFullYear()} Fabrik</span>
        <div className="flex items-center gap-6">
          <Link href="/#faq" className="hover:text-foreground">
            FAQ
          </Link>
          <a href="mailto:hello@fabrik.example" className="hover:text-foreground">
            hello@fabrik.example
          </a>
        </div>
      </Container>
    </footer>
  );
}
