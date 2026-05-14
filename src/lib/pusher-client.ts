import PusherClient from "pusher-js";

// No "use client" directive on purpose: this file only exports a plain
// function, not a React component. With "use client" on a non-component
// module Turbopack treats every export as a client-reference proxy meant for
// components, and plain functions end up as `undefined` in the consuming
// bundle. Server safety is enforced by the `typeof window` guard below
// instead — the actual `new PusherClient(...)` only fires when a hook calls
// getPusherClient() from inside useEffect, which only runs in the browser.

let _client: PusherClient | null = null;

export function getPusherClient(): PusherClient {
  if (typeof window === "undefined") {
    throw new Error(
      "getPusherClient() called on the server — call it from an effect or event handler instead.",
    );
  }
  if (!_client) {
    _client = new PusherClient(process.env.NEXT_PUBLIC_PUSHER_KEY!, {
      cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER!,
      authEndpoint: "/api/pusher/auth",
    });
  }
  return _client;
}
