"use client";

import { useRouter } from "next/navigation";
import type {
  Court,
  Match,
  MatchParticipant,
  User,
} from "@prisma/client";
import { CourtStatus, MatchStatus } from "@prisma/client";
import { Plus, Timer, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useAssignMatchToCourt } from "@/hooks/useEvents";
import { useEndAndAdvanceMatch } from "@/hooks/useMatches";
import { MatchTimer } from "../MatchTimer";
import { CourtStatusEditor } from "./CourtStatusEditor";

type MatchRow = Match & {
  participants: (MatchParticipant & { user: User })[];
};

type Props = {
  eventId: string;
  court: Court;
  matches: MatchRow[];
};

export function EventCourtCard({ eventId, court, matches }: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const end = useEndAndAdvanceMatch();
  const assign = useAssignMatchToCourt(eventId);

  // At most one match should be CONFIRMED on a court at a time. If multiple
  // happen to exist (data drift), take the most recently started.
  const active =
    matches
      .filter((m) => m.status === MatchStatus.CONFIRMED)
      .sort(
        (a, b) =>
          (b.startedAt?.getTime() ?? 0) - (a.startedAt?.getTime() ?? 0),
      )[0] ?? null;

  const handleEnd = () => {
    if (!active) return;
    end.mutate(active.id, {
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
        <div className="min-w-0">
          <div className="truncate font-semibold leading-tight">{court.name}</div>
          <div className="truncate text-xs text-muted-foreground">
            {court.location}
          </div>
        </div>
        <CourtStatusEditor courtId={court.id} status={court.status} />
      </header>

      {active ? (
        <>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Trophy className="h-3.5 w-3.5" />
            <span className="truncate">{active.format}</span>
          </div>

          <ul className="space-y-1 text-sm">
            {active.participants.map((p) => (
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
              {active.startedAt ? (
                <MatchTimer startedAt={active.startedAt} />
              ) : (
                <span className="text-sm">—</span>
              )}
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={end.isPending}
              onClick={handleEnd}
            >
              {end.isPending ? "Ending…" : "End game"}
            </Button>
          </div>
        </>
      ) : court.status === CourtStatus.AVAILABLE ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-md border border-dashed py-8 text-sm text-muted-foreground">
          <span>Idle — no match assigned</span>
          <Button
            type="button"
            size="sm"
            disabled={assign.isPending}
            onClick={() =>
              assign.mutate(court.id, {
                onSuccess: (data) => {
                  if (data.assigned) {
                    toast({
                      title: "Match assigned",
                      description: data.participants
                        .map((p) => p.name)
                        .join(", "),
                    });
                  } else {
                    toast({
                      title: "Nothing to assign",
                      description: data.message,
                    });
                  }
                  router.refresh();
                },
              })
            }
          >
            <Plus className="mr-1 h-4 w-4" />
            {assign.isPending ? "Assigning…" : "Assign next match"}
          </Button>
        </div>
      ) : (
        <div className="flex flex-1 items-center justify-center rounded-md border border-dashed py-8 text-sm text-muted-foreground">
          Court is {court.status.toLowerCase()}
        </div>
      )}
    </div>
  );
}
