"use client";

import type { Court, Match, MatchParticipant, User } from "@prisma/client";
import { Pagination, usePagination } from "@/components/shared/Pagination";

export type MatchHistoryRow = MatchParticipant & {
  match: Match & {
    host: User;
    court: Court | null;
  };
};

type Props = {
  history: MatchHistoryRow[];
  pageSize?: number;
};

export function MatchHistoryList({ history, pageSize = 10 }: Props) {
  const pagination = usePagination(history, pageSize);

  if (history.length === 0) {
    return <p className="text-sm text-muted-foreground">No completed matches yet.</p>;
  }

  return (
    <div className="space-y-3">
      <ul className="divide-y rounded-md border">
        {pagination.pageItems.map((p) => (
          <li key={p.id} className="flex justify-between p-3">
            <div>
              <div className="font-medium">vs {p.match.host.name}</div>
              <div className="text-xs text-muted-foreground">
                {p.match.scheduledAt.toISOString().slice(0, 10)} ·{" "}
                {p.match.court?.name ?? "TBD"}
              </div>
            </div>
            <div className="text-sm">{p.match.status}</div>
          </li>
        ))}
      </ul>
      <Pagination {...pagination} pageSize={pageSize} />
    </div>
  );
}
