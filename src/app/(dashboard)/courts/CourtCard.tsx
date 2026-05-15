"use client";

import type { Court, CourtStatus, User } from "@prisma/client";
import { CourtFormDialog } from "./CourtFormDialog";
import { DeleteCourtButton } from "./DeleteCourtButton";

export type CourtCardItem = Court & {
  manager: Pick<User, "id" | "name" | "email">;
  _count: { matches: number };
};

const statusStyles: Record<CourtStatus, string> = {
  AVAILABLE: "bg-green-100 text-green-800",
  MAINTENANCE: "bg-amber-100 text-amber-800",
  CLOSED: "bg-zinc-200 text-zinc-700",
  RENTED: "bg-blue-100 text-blue-800",
};

export function CourtCard({ court }: { court: CourtCardItem }) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border bg-card p-4 shadow-sm">
      <header className="flex items-start justify-between gap-2">
        <div>
          <div className="font-semibold leading-tight">{court.name}</div>
          <div className="text-xs text-muted-foreground">{court.location}</div>
        </div>
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusStyles[court.status]}`}
        >
          {court.status}
        </span>
      </header>

      <dl className="grid grid-cols-2 gap-2 text-xs">
        <div>
          <dt className="text-muted-foreground">Surface</dt>
          <dd className="font-medium">{court.surface}</dd>
        </div>
      </dl>

      <div className="flex justify-end gap-2 border-t pt-3">
        <CourtFormDialog mode="edit" court={court} />
        <DeleteCourtButton court={court} />
      </div>
    </div>
  );
}
