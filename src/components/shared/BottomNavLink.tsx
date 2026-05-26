"use client";

import type { Route } from "next";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

type Props = {
  href: Route;
  label: string;
  children: React.ReactNode;
};

// Per-tab link. Lives client-side because active highlighting needs the live
// pathname — the parent BottomNav stays server-rendered.
export function BottomNavLink({ href, label, children }: Props) {
  const pathname = usePathname();
  const active = pathname === href || pathname.startsWith(`${href}/`);
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex h-full flex-col items-center justify-center gap-0.5 text-xs",
        active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
      <span className="leading-none">{label}</span>
    </Link>
  );
}
