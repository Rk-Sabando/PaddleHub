import type { Route } from "next";
import Link from "next/link";
import { Role } from "@prisma/client";
import { requireAuth } from "@/lib/auth";

type NavItem = { href: string; label: string };

const playerNav: NavItem[] = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/events", label: "Event" },
  { href: "/settings", label: "Settings" },
];

const adminNav: NavItem[] = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/events", label: "Events" },
];

export async function Sidebar() {
  const user = await requireAuth();
  const items = user.role === Role.ADMIN ? adminNav : playerNav;

  return (
    <aside className="hidden w-56 border-r p-4 md:block">
      <nav className="flex flex-col gap-1">
        {items.map((item) => (
          <Link
            key={item.href}
            href={item.href as Route}
            className="rounded-md px-3 py-2 hover:bg-accent"
          >
            {item.label}
          </Link>
        ))}
      </nav>
    </aside>
  );
}
