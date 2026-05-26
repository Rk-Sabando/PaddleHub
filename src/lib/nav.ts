import type { LucideIcon } from "lucide-react";
import { Calendar, LayoutDashboard, MapPin, Settings, Trophy } from "lucide-react";
import { Role } from "@prisma/client";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

const playerNav: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/events", label: "Event", icon: Trophy },
  { href: "/settings", label: "Settings", icon: Settings },
];

const adminNav: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/events", label: "Events", icon: Calendar },
  { href: "/courts", label: "Courts", icon: MapPin },
];

export function navItemsForRole(role: Role): NavItem[] {
  return role === Role.ADMIN ? adminNav : playerNav;
}
