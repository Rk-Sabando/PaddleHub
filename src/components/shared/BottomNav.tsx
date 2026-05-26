import type { Route } from "next";
import { requireAuth } from "@/lib/auth";
import { navItemsForRole } from "@/lib/nav";
import { BottomNavLink } from "./BottomNavLink";

// Mobile-only bottom tab bar. Sidebar handles md+ screens. Mirrors the role-
// based navigation so players don't see admin-only routes.
export async function BottomNav() {
  const user = await requireAuth();
  const items = navItemsForRole(user.role);

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 backdrop-blur md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="flex h-14 items-stretch">
        {items.map(({ href, label, icon: Icon }) => (
          <li key={href} className="flex-1">
            <BottomNavLink href={href as Route} label={label}>
              <Icon className="h-5 w-5" aria-hidden />
            </BottomNavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
