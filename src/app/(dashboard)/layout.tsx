import { BottomNav } from "@/components/shared/BottomNav";
import { Navbar } from "@/components/shared/Navbar";
import { Sidebar } from "@/components/shared/Sidebar";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      {/* min-w-0 here breaks the min-content propagation up the flex chain —
          without it, any wide descendant (e.g. a long status pill, a table) can
          force the column wider than the viewport on mobile, causing the
          browser to render with a horizontal scrollbar / require zoom-out. */}
      <div className="flex min-w-0 flex-1 flex-col">
        <Navbar />
        <main className="min-w-0 flex-1 p-6 pb-20 md:pb-6">{children}</main>
      </div>
      <BottomNav />
    </div>
  );
}
