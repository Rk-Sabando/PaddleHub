import Link from "next/link";

export function Sidebar() {
  return (
    <aside className="hidden w-56 border-r p-4 md:block">
      <nav className="flex flex-col gap-1">
        <Link href="/dashboard" className="rounded-md px-3 py-2 hover:bg-accent">Dashboard</Link>
        <Link href="/matches" className="rounded-md px-3 py-2 hover:bg-accent">Find a match</Link>
        <Link href="/matches/new" className="rounded-md px-3 py-2 hover:bg-accent">Create</Link>
        <Link href="/settings" className="rounded-md px-3 py-2 hover:bg-accent">Settings</Link>
      </nav>
    </aside>
  );
}
