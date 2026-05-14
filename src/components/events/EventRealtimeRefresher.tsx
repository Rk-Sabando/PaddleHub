"use client";

import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useEventChannel } from "@/hooks/useEventChannel";
import { eventKey } from "@/hooks/useEvents";

// Drop into a server-rendered event-detail page. It subscribes to the
// per-event Pusher channel and re-fetches server components on any change.
export function EventRealtimeRefresher({ eventId }: { eventId: string }) {
  const router = useRouter();
  const qc = useQueryClient();

  useEventChannel(eventId, {
    onSignupRequested: () => {
      qc.invalidateQueries({ queryKey: eventKey(eventId) });
      router.refresh();
    },
    onSignupDecided: () => {
      qc.invalidateQueries({ queryKey: eventKey(eventId) });
      router.refresh();
    },
    onEventUpdated: () => {
      qc.invalidateQueries({ queryKey: eventKey(eventId) });
      router.refresh();
    },
  });

  return null;
}
