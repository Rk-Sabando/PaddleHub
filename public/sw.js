// PaddleHub service worker. Handles background web-push delivery so players
// see their next-game notification even when the tab is closed.

self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// Chrome's PWA install criteria require a fetch handler to exist. We don't
// actually want to cache anything (the app is fully dynamic + auth-gated), so
// this is a pass-through to the network.
self.addEventListener("fetch", () => {});

self.addEventListener("push", (event) => {
  let data = {};
  if (event.data) {
    try {
      data = event.data.json();
    } catch {
      data = { title: "PaddleHub", body: event.data.text() };
    }
  }
  const title = data.title || "PaddleHub";
  const options = {
    body: data.body || "",
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    tag: data.tag,
    renotify: !!data.tag,
    data: { url: data.url || "/dashboard" },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/dashboard";
  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clients) => {
        // If a tab is already open at this URL (or any PaddleHub tab), focus it.
        for (const client of clients) {
          if (client.url.includes(url) && "focus" in client) return client.focus();
        }
        for (const client of clients) {
          if ("focus" in client) {
            client.navigate(url);
            return client.focus();
          }
        }
        if (self.clients.openWindow) return self.clients.openWindow(url);
        return undefined;
      }),
  );
});
