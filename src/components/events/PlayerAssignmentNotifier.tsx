"use client";

import { useEffect } from "react";
import { channels, events } from "@/lib/pusher";
import { getPusherClient } from "@/lib/pusher-client";
import { toast } from "@/hooks/use-toast";

type CourtAssignmentNotification = {
  type?: string;
  eventId?: string | null;
  title?: string;
  message?: string;
};

export function PlayerAssignmentNotifier({
  userId,
  eventId,
}: {
  userId: string;
  eventId: string;
}) {
  useEffect(() => {
    const client = getPusherClient();
    const channel = client.subscribe(channels.user(userId));

    const onNotification = (payload: unknown) => {
      const data = payload as CourtAssignmentNotification;
      if (data.type !== "court-assignment") return;
      if (data.eventId !== eventId) return;
      toast({
        title: data.title ?? "Paddle up!",
        description: data.message ?? "You are assigned to a court for your next match.",
      });
    };

    channel.bind(events.userNotification, onNotification);

    return () => {
      channel.unbind(events.userNotification, onNotification);
      client.unsubscribe(channels.user(userId));
    };
  }, [userId, eventId]);

  return null;
}

