"use client";
import { useEffect } from "react";
import { pusherClient, channels, events } from "@/lib/pusher";

// Subscribes to the presence channel for a match. Caller passes handlers per event.
export function useMatchChannel(
  matchId: string,
  handlers: {
    onUpdate?: (data: unknown) => void;
    onJoined?: (data: unknown) => void;
    onLeft?: (data: unknown) => void;
    onMessage?: (data: unknown) => void;
  },
) {
  useEffect(() => {
    const channel = pusherClient.subscribe(channels.match(matchId));
    if (handlers.onUpdate) channel.bind(events.matchUpdated, handlers.onUpdate);
    if (handlers.onJoined) channel.bind(events.participantJoined, handlers.onJoined);
    if (handlers.onLeft) channel.bind(events.participantLeft, handlers.onLeft);
    if (handlers.onMessage) channel.bind(events.chatMessage, handlers.onMessage);
    return () => {
      pusherClient.unsubscribe(channels.match(matchId));
    };
  }, [matchId, handlers]);
}
