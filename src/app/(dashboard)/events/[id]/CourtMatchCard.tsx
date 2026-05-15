"use client";

import { useRouter } from "next/navigation";
import {
  type Court,
  type CourtStatus,
  type Match,
  type MatchParticipant,
  type User,
  MatchStatus,
} from "@prisma/client";
import { Timer, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useEndAndAdvanceMatch } from "@/hooks/useMatches";
import { MatchTimer } from "./MatchTimer";

export type CourtMatchCardItem = Match & {
  court: Court;
  participants: (MatchParticipant & { user: User })[];
};

const courtStatusStyles: Record<CourtStatus, string> = {
  AVAILABLE: "bg-green-100 text-green-800",
  MAINTENANCE: "bg-amber-100 text-amber-800",
  CLOSED: "bg-zinc-200 text-zinc-700",
  RENTED: "bg-blue-100 text-blue-800",
};

const matchStatusStyles: Record<MatchStatus, string> = {
  OPEN: "bg-zinc-100 text-zinc-700",
  CONFIRMED: "bg-emerald-100 text-emerald-800",
  COMPLETED: "bg-zinc-200 text-zinc-700",
  CANCELLED: "bg-red-100 text-red-800",
};

export function CourtMatchCard({ match }: { match: CourtMatchCardItem }) {
  const router = useRouter();
  const { toast } = useToast();
  const end = useEndAndAdvanceMatch();
  const isActive = match.status === MatchStatus.CONFIRMED;

  const handleEnd = () => {
    end.mutate(match.id, {
      onSuccess: (data) => {
        toast({
          title: "Match ended",
          description: data.nextMatchId
            ? `New match assigned: ${data.nextParticipants.map((p) => p.name).join(", ")}`
            : "No more players available — court is now idle.",
        });
        router.refresh();
      },
    });
  };

  return (
    <div className="flex flex-col gap-3 rounded-lg border bg-card p-4 shadow-sm">
      <header className="flex items-start justify-between gap-2">
        <div>
          <div className="font-semibold leading-tight">{match.court.name}</div>
          <div className="text-xs text-muted-foreground">{match.court.location}</div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-medium ${courtStatusStyles[match.court.status]}`}
          >
            {match.court.status}
          </span>
          {match.status !== MatchStatus.CONFIRMED && (
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-medium ${matchStatusStyles[match.status]}`}
            >
              {match.status}
            </span>
          )}
        </div>
      </header>

      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Trophy className="h-3.5 w-3.5" />
        <span className="truncate">{match.format}</span>
      </div>

      <ul className="space-y-1 text-sm">
        {match.participants.map((p) => (
          <li
            key={p.id}
            className="flex items-center justify-between rounded bg-muted/40 px-2 py-1"
          >
            <span className="truncate font-medium">{p.user.name}</span>
            <span className="text-xs text-muted-foreground tabular-nums">
              {p.user.skillRating.toFixed(1)}
            </span>
          </li>
        ))}
      </ul>

      <div className="flex items-center justify-between gap-2 border-t pt-3">
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <Timer className="h-4 w-4" />
          {isActive && match.startedAt ? (
            <MatchTimer startedAt={match.startedAt} />
          ) : (
            <span className="text-sm">—</span>
          )}
        </div>
        {isActive && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={end.isPending}
            onClick={handleEnd}
          >
            {end.isPending ? "Ending…" : "End game"}
          </Button>
        )}
      </div>
    </div>
  );
}
