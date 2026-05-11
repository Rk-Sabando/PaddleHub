import Pusher from "pusher";
import PusherClient from "pusher-js";

// Server-side: trigger events from API routes / services.
export const pusherServer = new Pusher({
  appId: process.env.PUSHER_APP_ID!,
  key: process.env.NEXT_PUBLIC_PUSHER_KEY!,
  secret: process.env.PUSHER_SECRET!,
  cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER!,
  useTLS: true,
});

// Client-side: subscribe to channels from React components.
export const pusherClient = new PusherClient(process.env.NEXT_PUBLIC_PUSHER_KEY!, {
  cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER!,
  authEndpoint: "/api/pusher/auth",
});

// Channel naming conventions.
export const channels = {
  match: (id: string) => `presence-match-${id}`,
  user: (id: string) => `private-user-${id}`,
};

export const events = {
  matchUpdated: "match:updated",
  participantJoined: "participant:joined",
  participantLeft: "participant:left",
  chatMessage: "chat:message",
} as const;
