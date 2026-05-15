import type { Match, MatchParticipant, User } from "@prisma/client";
import { Hourglass } from "lucide-react";

export type QueuedMatchCardItem = Match & {
  participants: (MatchParticipant & { user: User })[];
};

// Pre-formed match still waiting for a court. No timer, no end button — those
// only kick in once a court frees up and endAndAdvanceMatch promotes this row.
export function QueuedMatchCard({ match }: { match: QueuedMatchCardItem }) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-dashed bg-muted/20 p-4">
      <header className="flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-1.5 font-medium leading-tight">
            <Hourglass className="h-4 w-4 text-muted-foreground" />
            Waiting for a court
          </div>
          <div className="text-xs text-muted-foreground">{match.format}</div>
        </div>
        <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-700">
          Up next
        </span>
      </header>

      <ul className="space-y-1 text-sm">
        {match.participants.map((p) => (
          <li
            key={p.id}
            className="flex items-center justify-between rounded bg-background/60 px-2 py-1"
          >
            <span className="truncate font-medium">{p.user.name}</span>
            <span className="text-xs text-muted-foreground tabular-nums">
              {p.user.skillRating.toFixed(1)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
