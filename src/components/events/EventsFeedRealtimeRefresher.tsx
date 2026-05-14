"use client";

import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useEventsFeed } from "@/hooks/useEventsFeed";
import { eventsKey } from "@/hooks/useEvents";

// Drop into any list-style server page that renders multiple events. It
// subscribes to the global events feed and re-fetches on create/update.
export function EventsFeedRealtimeRefresher() {
  const router = useRouter();
  const qc = useQueryClient();

  useEventsFeed({
    onEventCreated: () => {
      qc.invalidateQueries({ queryKey: eventsKey });
      router.refresh();
    },
    onEventUpdated: () => {
      qc.invalidateQueries({ queryKey: eventsKey });
      router.refresh();
    },
  });

  return null;
}
