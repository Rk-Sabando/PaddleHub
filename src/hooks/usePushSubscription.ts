"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/lib/apiClient";

export type PushState =
  | "unsupported" // browser lacks Notification / PushManager / service workers
  | "loading" // determining current state
  | "denied" // user blocked notifications in browser settings
  | "default" // never asked yet
  | "subscribed"; // active PushSubscription matches us

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

function isSupported() {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

async function getRegistration(): Promise<ServiceWorkerRegistration> {
  const existing = await navigator.serviceWorker.getRegistration("/sw.js");
  if (existing) return existing;
  return navigator.serviceWorker.register("/sw.js");
}

export function usePushSubscription() {
  const [state, setState] = useState<PushState>("loading");
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    if (!isSupported()) {
      setState("unsupported");
      return;
    }
    if (Notification.permission === "denied") {
      setState("denied");
      return;
    }
    const reg = await navigator.serviceWorker.getRegistration("/sw.js");
    const sub = await reg?.pushManager.getSubscription();
    if (sub && Notification.permission === "granted") {
      setState("subscribed");
    } else {
      setState("default");
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const subscribe = useCallback(async () => {
    if (!isSupported()) return;
    const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!publicKey) {
      console.error("[push] NEXT_PUBLIC_VAPID_PUBLIC_KEY is not set");
      return;
    }
    setBusy(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        await refresh();
        return;
      }
      const reg = await getRegistration();
      // Ensure the worker is active before we ask for a subscription.
      if (!reg.active) await navigator.serviceWorker.ready;
      const existing = await reg.pushManager.getSubscription();
      const sub =
        existing ??
        (await reg.pushManager.subscribe({
          userVisibleOnly: true,
          // Cast to BufferSource — TS widens Uint8Array.buffer to ArrayBufferLike,
          // but pushManager.subscribe only accepts ArrayBuffer-backed views.
          applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
        }));
      const json = sub.toJSON() as {
        endpoint?: string;
        keys?: { p256dh?: string; auth?: string };
      };
      await apiFetch("/api/push/subscribe", {
        method: "POST",
        body: {
          endpoint: json.endpoint,
          keys: { p256dh: json.keys?.p256dh, auth: json.keys?.auth },
          userAgent: navigator.userAgent,
          // Page origin where this subscription was created. The server uses
          // it to prune the user's subscriptions from other origins (e.g. a
          // stale dev tunnel URL still showing "Possible Scam" notifications
          // tied to a no-longer-current host).
          origin: window.location.origin,
        },
      });
      setState("subscribed");
    } catch (err) {
      console.error("[push] subscribe failed", err);
      await refresh();
    } finally {
      setBusy(false);
    }
  }, [refresh]);

  const unsubscribe = useCallback(async () => {
    if (!isSupported()) return;
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.getRegistration("/sw.js");
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        const endpoint = sub.endpoint;
        await sub.unsubscribe();
        await apiFetch("/api/push/subscribe", {
          method: "DELETE",
          body: { endpoint },
        });
      }
      setState("default");
    } catch (err) {
      console.error("[push] unsubscribe failed", err);
      await refresh();
    } finally {
      setBusy(false);
    }
  }, [refresh]);

  return { state, busy, subscribe, unsubscribe };
}
