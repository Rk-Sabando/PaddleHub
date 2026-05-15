import { Role } from "@prisma/client";
import { requireRole } from "@/lib/auth";
import { courtService } from "@/server/services/courtService";
import { CourtCard } from "./CourtCard";
import { CourtFormDialog } from "./CourtFormDialog";

export const dynamic = "force-dynamic";

export default async function CourtsPage() {
  await requireRole(Role.ADMIN);
  const courts = await courtService.list();

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Court management</h1>
          <p className="text-sm text-muted-foreground">
            Add, edit, or retire courts. Live match assignment lives on each
            event&apos;s detail page.
          </p>
        </div>
        <CourtFormDialog mode="create" />
      </header>

      {courts.length === 0 ? (
        <p className="rounded-md border bg-muted/30 p-6 text-center text-sm text-muted-foreground">
          No courts yet. Add the first one to get matchmaking off the ground.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {courts.map((c) => (
            <CourtCard key={c.id} court={c} />
          ))}
        </div>
      )}
    </div>
  );
}
