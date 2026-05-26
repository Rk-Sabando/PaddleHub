import type { Route } from "next";
import Link from "next/link";
import { requireAuth } from "@/lib/auth";
import { navItemsForRole } from "@/lib/nav";

export async function Sidebar() {
  const user = await requireAuth();
  const items = navItemsForRole(user.role);

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
