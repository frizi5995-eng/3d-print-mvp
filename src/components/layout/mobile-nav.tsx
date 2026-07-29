"use client";

import Link from "next/link";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const NAV_LINKS = [
  { href: "/#how-it-works", label: "How it works" },
  { href: "/#materials", label: "Materials" },
  { href: "/#faq", label: "FAQ" },
];

export function MobileNav({
  isSignedIn,
  isAdmin,
}: {
  isSignedIn: boolean;
  isAdmin: boolean;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="ghost" size="icon" aria-label="Open menu" className="md:hidden" />
        }
      >
        <Menu className="size-4.5" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        {NAV_LINKS.map((link) => (
          <DropdownMenuItem key={link.href} render={<Link href={link.href} />}>
            {link.label}
          </DropdownMenuItem>
        ))}
        {isSignedIn && (
          <DropdownMenuItem render={<Link href="/account/requests" />}>
            My requests
          </DropdownMenuItem>
        )}
        {isAdmin && (
          <DropdownMenuItem render={<Link href="/admin/dashboard" />}>Admin</DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem render={<Link href={isSignedIn ? "/account" : "/login"} />}>
          {isSignedIn ? "Account" : "Sign in"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
