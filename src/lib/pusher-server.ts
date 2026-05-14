import "server-only";
import Pusher from "pusher";

// Server-side: trigger events from API routes / services. Never imported by
// client code — `server-only` makes that a build-time error.
export const pusherServer = new Pusher({
  appId: process.env.PUSHER_APP_ID!,
  key: process.env.NEXT_PUBLIC_PUSHER_KEY!,
  secret: process.env.PUSHER_SECRET!,
  cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER!,
  useTLS: true,
});
