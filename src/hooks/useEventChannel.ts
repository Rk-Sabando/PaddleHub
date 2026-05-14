"use client";

import { useEffect, useRef } from "react";
import { channels, events } from "@/lib/pusher";
import { getPusherClient } from "@/lib/pusher-client";

type Handlers = {
  onSignupRequested?: (data: unknown) => void;
  onSignupDecided?: (data: unknown) => void;
  onEventUpdated?: (data: unknown) => void;
};

// Per-event channel — fires on signup requests, signup decisions, and event
// status updates. Cheap public channel; no auth required.
//
// `handlers` is captured by ref so callers can pass inline objects without
// causing re-subscription on every render.
export function useEventChannel(eventId: string, handlers: Handlers) {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    const client = getPusherClient();
    const channel = client.subscribe(channels.event(eventId));
    const onRequested = (data: unknown) =>
      handlersRef.current.onSignupRequested?.(data);
    const onDecided = (data: unknown) =>
      handlersRef.current.onSignupDecided?.(data);
    const onUpdated = (data: unknown) =>
      handlersRef.current.onEventUpdated?.(data);

    channel.bind(events.signupRequested, onRequested);
    channel.bind(events.signupDecided, onDecided);
    channel.bind(events.eventUpdated, onUpdated);

    return () => {
      channel.unbind(events.signupRequested, onRequested);
      channel.unbind(events.signupDecided, onDecided);
      channel.unbind(events.eventUpdated, onUpdated);
      client.unsubscribe(channels.event(eventId));
    };
  }, [eventId]);
}
