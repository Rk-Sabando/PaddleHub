"use client";

import { useRouter } from "next/navigation";
import { EventStatus } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { useUpdateEventStatus } from "@/hooks/useEvents";
import { eventStatusLabels } from "@/lib/eventStatus";

const transitions: Record<EventStatus, EventStatus[]> = {
  [EventStatus.OPEN]: [EventStatus.IN_PROGRESS, EventStatus.CANCELLED],
  [EventStatus.IN_PROGRESS]: [EventStatus.COMPLETED, EventStatus.CANCELLED],
  [EventStatus.COMPLETED]: [],
  [EventStatus.CANCELLED]: [],
};

const actionLabels: Record<EventStatus, string> = {
  [EventStatus.OPEN]: "Reopen",
  [EventStatus.IN_PROGRESS]: "Start event",
  [EventStatus.COMPLETED]: "Mark completed",
  [EventStatus.CANCELLED]: "Cancel event",
};

type Props = {
  eventId: string;
  status: EventStatus;
  confirmedCount: number;
};

export function EventStatusControl({ eventId, status, confirmedCount }: Props) {
  const router = useRouter();
  const update = useUpdateEventStatus(eventId);
  const inFlight = update.isPending ? update.variables : undefined;

  const next = transitions[status];
  // Can't kick off a live event with an empty roster — there'd be nobody to
  // matchmake. Cancel is still allowed (it's the "abort" path).
  const blockStart =
    status === EventStatus.OPEN && confirmedCount === 0;

  return (
    <div className="space-y-2 rounded-md border bg-card p-3 text-sm">
      <div>
        <div className="text-xs uppercase text-muted-foreground">Status</div>
        <div className="font-medium">{eventStatusLabels[status]}</div>
      </div>
      {next.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {next.map((target) => {
            const disableThis =
              update.isPending ||
              (blockStart && target === EventStatus.IN_PROGRESS);
            return (
              <Button
                key={target}
                size="sm"
                variant={target === EventStatus.CANCELLED ? "outline" : "default"}
                disabled={disableThis}
                onClick={() =>
                  update.mutate(target, { onSuccess: () => router.refresh() })
                }
              >
                {inFlight === target ? "Updating…" : actionLabels[target]}
              </Button>
            );
          })}
        </div>
      )}
    </div>
  );
}
