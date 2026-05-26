"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
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
  const router = useRouter();

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
      // Private per-user channel is the most reliable signal that *this*
      // player's view has changed (the public event channel can lag or drop
      // for some clients). Re-fetch the server-rendered page so the hero card
      // flips from "queued" → "now playing" without a manual reload.
      router.refresh();
    };

    channel.bind(events.userNotification, onNotification);

    return () => {
      channel.unbind(events.userNotification, onNotification);
      client.unsubscribe(channels.user(userId));
    };
  }, [userId, eventId, router]);

  return null;
}

