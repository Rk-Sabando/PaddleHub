"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { EventStatus } from "@prisma/client";
import { Button } from "@/components/ui/button";

const transitions: Record<EventStatus, EventStatus[]> = {
  [EventStatus.OPEN]: [EventStatus.MATCHMAKING, EventStatus.CANCELLED],
  [EventStatus.MATCHMAKING]: [
    EventStatus.OPEN,
    EventStatus.IN_PROGRESS,
    EventStatus.CANCELLED,
  ],
  [EventStatus.IN_PROGRESS]: [EventStatus.COMPLETED, EventStatus.CANCELLED],
  [EventStatus.COMPLETED]: [],
  [EventStatus.CANCELLED]: [],
};

const labels: Record<EventStatus, string> = {
  [EventStatus.OPEN]: "Open for signups",
  [EventStatus.MATCHMAKING]: "Matchmaking",
  [EventStatus.IN_PROGRESS]: "In progress",
  [EventStatus.COMPLETED]: "Completed",
  [EventStatus.CANCELLED]: "Cancelled",
};

const actionLabels: Record<EventStatus, string> = {
  [EventStatus.OPEN]: "Reopen signups",
  [EventStatus.MATCHMAKING]: "Close signups → Matchmaking",
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
  const [pending, setPending] = useState<EventStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  const next = transitions[status];

  const move = async (target: EventStatus) => {
    setPending(target);
    setError(null);
    const res = await fetch(`/api/events/${eventId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status: target }),
    });
    setPending(null);
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      setError(body?.error ?? "Could not update event status.");
      return;
    }
    router.refresh();
  };

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
              disabled={pending !== null}
              onClick={() => move(target)}
            >
              {pending === target ? "Updating…" : actionLabels[target]}
            </Button>
          ))}
        </div>
      )}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
