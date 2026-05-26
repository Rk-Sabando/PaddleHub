"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useToggleMatchmakingDisabled } from "@/hooks/useEvents";

export function MatchmakingToggleButton({ eventId, matchmakingDisabled }: { eventId: string; matchmakingDisabled: boolean }) {
  const router = useRouter();
  const toggleMatchmakingMutation = useToggleMatchmakingDisabled(eventId);

  return (
    <Button
      key={eventId}
      size="sm"
      className={`mt-2 rounded px-4 py-2 text-sm font-medium ${matchmakingDisabled ? 'bg-red-500 text-white' : 'bg-green-500 text-white'}`}
      disabled={toggleMatchmakingMutation.isPending}
      onClick={() =>
        toggleMatchmakingMutation.mutate(!matchmakingDisabled, { onSuccess: () => router.refresh() })
      }
    >
      {matchmakingDisabled ? 'Resume Matchmaking' : 'Stop Matchmaking'}
    </Button>
  );
}