// Shared Pusher constants. Safe to import from either server or client code.
// The actual SDK instances live in `pusher-server.ts` and `pusher-client.ts`
// so neither bundle pulls in the other's code path.

export const channels = {
  match: (id: string) => `presence-match-${id}`,
  user: (id: string) => `private-user-${id}`,
  // Public per-event channel: signup requests, signup decisions, status flips.
  // Subscribed to by anyone on /events/[id].
  event: (id: string) => `event-${id}`,
  // Public global feed: an event was created, or any event's surface-level
  // state changed (capacity, status). Subscribed to by anyone on a list view
  // so we don't need N per-event subscriptions.
  eventsFeed: "events-feed",
};

export const events = {
  matchUpdated: "match:updated",
  participantJoined: "participant:joined",
  participantLeft: "participant:left",
  chatMessage: "chat:message",
  userNotification: "user:notification",

  eventCreated: "event:created",
  eventUpdated: "event:updated",
  signupRequested: "signup:requested",
  signupDecided: "signup:decided",
} as const;
