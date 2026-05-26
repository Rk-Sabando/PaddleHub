"use client";

import { useEffect } from "react";

// Registers /sw.js as soon as the app mounts. Required for PWA installability —
// browsers gate the install prompt on having an active service worker, and we
// can't wait for the user to opt in to push first.
export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch((err) => {
      console.error("[sw] registration failed", err);
    });
  }, []);
  return null;
}
