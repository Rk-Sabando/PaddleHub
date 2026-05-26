import webpush, { type WebPushError } from "web-push";
import { db } from "@/lib/db";

const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const privateKey = process.env.VAPID_PRIVATE_KEY;
const subject = process.env.VAPID_SUBJECT ?? "mailto:admin@paddlehub.local";

let configured = false;
function ensureConfigured() {
  if (configured) return true;
  if (!publicKey || !privateKey) {
    console.warn(
      "[push] VAPID keys missing — set NEXT_PUBLIC_VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY. Push disabled.",
    );
    return false;
  }
  webpush.setVapidDetails(subject, publicKey, privateKey);
  configured = true;
  return true;
}

export type PushPayload = {
  title: string;
  body: string;
  // Optional deep link the SW should open on click. Defaults to /dashboard.
  url?: string;
  // Notification tag — when set, a newer push replaces an older one with the
  // same tag (e.g. "court-assignment:<eventId>") instead of stacking.
  tag?: string;
  // Echoed to the client; useful for debugging in the SW console.
  type?: string;
};

// Fan-out helper: send the same payload to every device the user has registered.
// Prunes subscriptions the push service rejects (410 Gone / 404 Not Found).
export async function sendPushToUser(userId: string, payload: PushPayload): Promise<void> {
  if (!ensureConfigured()) return;
  const subs = await db.pushSubscription.findMany({ where: { userId } });
  if (subs.length === 0) return;

  const dead: string[] = [];
  await Promise.all(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          JSON.stringify(payload),
          { TTL: 60 * 60 },
        );
      } catch (err) {
        const status = (err as WebPushError | undefined)?.statusCode;
        if (status === 404 || status === 410) {
          dead.push(sub.endpoint);
        } else {
          console.error(
            `[push] failed to send to ${sub.endpoint.slice(0, 40)}…`,
            err,
          );
        }
      }
    }),
  );

  if (dead.length > 0) {
    await db.pushSubscription.deleteMany({ where: { endpoint: { in: dead } } });
  }
}

export async function sendPushToUsers(userIds: string[], payload: PushPayload): Promise<void> {
  await Promise.all(userIds.map((id) => sendPushToUser(id, payload)));
}
