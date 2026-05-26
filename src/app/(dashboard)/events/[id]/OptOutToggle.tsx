"use client";

import { useRouter } from "next/navigation";
import { Pause, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSetOptOut } from "@/hooks/useEventSignups";

type Props = {
  eventId: string;
  optedOut: boolean;
};

// Mid-event toggle: lets a player stop being matchmade for further matches
// while staying on the event roster + keeping match history. Only renders when
// the parent decides it's appropriate (event IN_PROGRESS + player has at least
// one COMPLETED match).
export function OptOutToggle({ eventId, optedOut }: Props) {
  const router = useRouter();
  const set = useSetOptOut(eventId);
  const onSuccess = () => router.refresh();

  if (optedOut) {
    return (
      <Button
        type="button"
        variant="outline"
        disabled={set.isPending}
        onClick={() => set.mutate(false, { onSuccess })}
      >
        <Play className="mr-1.5 h-4 w-4" />
        {set.isPending ? "Resuming…" : "Resume matchmaking"}
      </Button>
    );
  }

  return (
    <Button
      type="button"
      variant="outline"
      disabled={set.isPending}
      onClick={() => set.mutate(true, { onSuccess })}
    >
      <Pause className="mr-1.5 h-4 w-4" />
      {set.isPending ? "Sitting out…" : "Sit out remaining matches"}
    </Button>
  );
}
