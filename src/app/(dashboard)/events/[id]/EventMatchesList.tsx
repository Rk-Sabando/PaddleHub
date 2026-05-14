"use client";

import type { Court, Match, MatchParticipant, User } from "@prisma/client";
import { Pagination, usePagination } from "@/components/shared/Pagination";

export type MatchRow = Match & {
  court: Court;
  participants: (MatchParticipant & { user: User })[];
};

type Props = {
  matches: MatchRow[];
  pageSize?: number;
  emptyMessage?: string;
};

export function EventMatchesList({
  matches,
  pageSize = 10,
  emptyMessage = "No matches scheduled yet.",
}: Props) {
  const pagination = usePagination(matches, pageSize);

  if (matches.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyMessage}</p>;
  }

  return (
    <div className="space-y-3">
      <ul className="divide-y rounded-md border">
        {pagination.pageItems.map((m) => (
          <li key={m.id} className="p-3 text-sm">
            <div className="font-medium">{m.court.name}</div>
            <div className="text-xs text-muted-foreground">
              {m.scheduledAt.toISOString().slice(11, 16)} ·{" "}
              {m.participants.map((p) => p.user.name).join(", ")}
            </div>
          </li>
        ))}
      </ul>
      <Pagination {...pagination} pageSize={pageSize} />
    </div>
  );
}
