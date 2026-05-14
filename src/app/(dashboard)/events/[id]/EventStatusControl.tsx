"use client";

import { useRouter } from "next/navigation";
import { EventStatus } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { useUpdateEventStatus } from "@/hooks/useEvents";

const transitions: Record<EventStatus, EventStatus[]> = {
  [EventStatus.OPEN]: [EventStatus.IN_PROGRESS, EventStatus.CANCELLED],
  [EventStatus.IN_PROGRESS]: [EventStatus.COMPLETED, EventStatus.CANCELLED],
  [EventStatus.COMPLETED]: [],
  [EventStatus.CANCELLED]: [],
};

const labels: Record<EventStatus, string> = {
  [EventStatus.OPEN]: "Upcoming",
  [EventStatus.IN_PROGRESS]: "In progress",
  [EventStatus.COMPLETED]: "Completed",
  [EventStatus.CANCELLED]: "Cancelled",
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
};

export function EventStatusControl({ eventId, status }: Props) {
  const router = useRouter();
  const update = useUpdateEventStatus(eventId);
  const inFlight = update.isPending ? update.variables : undefined;

  const next = transitions[status];

  return (
    <div className="space-y-2 rounded-md border bg-card p-3 text-sm">
      <div>
        <div className="text-xs uppercase text-muted-foreground">Status</div>
        <div className="font-medium">{labels[status]}</div>
      </div>
      {next.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {next.map((target) => (
            <Button
              key={target}
              size="sm"
              variant={target === EventStatus.CANCELLED ? "outline" : "default"}
              disabled={update.isPending}
              onClick={() =>
                update.mutate(target, { onSuccess: () => router.refresh() })
              }
            >
              {inFlight === target ? "Updating…" : actionLabels[target]}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}
