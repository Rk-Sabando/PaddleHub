"use client";

import { useEffect, useRef } from "react";
import { channels, events } from "@/lib/pusher";
import { getPusherClient } from "@/lib/pusher-client";

type Handlers = {
  onEventCreated?: (data: unknown) => void;
  onEventUpdated?: (data: unknown) => void;
};

// Global events feed — used by list views (admin + player /events,
// admin /dashboard) so they don't need N per-event subscriptions to learn
// about new events or surface-level state changes.
//
// `handlers` is captured by ref so callers can pass inline objects without
// causing re-subscription on every render.
export function useEventsFeed(handlers: Handlers) {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    const client = getPusherClient();
    const channel = client.subscribe(channels.eventsFeed);
    const onCreated = (data: unknown) =>
      handlersRef.current.onEventCreated?.(data);
    const onUpdated = (data: unknown) =>
      handlersRef.current.onEventUpdated?.(data);

    channel.bind(events.eventCreated, onCreated);
    channel.bind(events.eventUpdated, onUpdated);

    return () => {
      channel.unbind(events.eventCreated, onCreated);
      channel.unbind(events.eventUpdated, onUpdated);
      client.unsubscribe(channels.eventsFeed);
    };
  }, []);
}
