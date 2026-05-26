"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useEventChannel } from "@/hooks/useEventChannel";
import { eventKey } from "@/hooks/useEvents";

type Props = {
  eventId: string;
  // Safety-net polling interval in milliseconds. Set to 0 to disable. The
  // Pusher subscription is the primary update path; polling backs it up so a
  // dropped subscription, network blip, or hidden-tab throttle can't strand
  // the page on stale data.
  pollIntervalMs?: number;
};

// Drop into a server-rendered event-detail page. It subscribes to the
// per-event Pusher channel and re-fetches server components on any change.
export function EventRealtimeRefresher({
  eventId,
  pollIntervalMs = 20_000,
}: Props) {
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

  useEffect(() => {
    if (pollIntervalMs <= 0) return;
    // Pause polling when the tab is hidden — saves bandwidth and won't deliver
    // a useful update to a backgrounded tab anyway. Resumes (and refreshes
    // immediately) when the tab comes back into focus.
    let timer: ReturnType<typeof setInterval> | null = null;
    const start = () => {
      if (timer) return;
      timer = setInterval(() => router.refresh(), pollIntervalMs);
    };
    const stop = () => {
      if (timer) clearInterval(timer);
      timer = null;
    };
    const onVisibility = () => {
      if (document.hidden) {
        stop();
      } else {
        router.refresh();
        start();
      }
    };
    if (!document.hidden) start();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [pollIntervalMs, router]);

  return null;
}
