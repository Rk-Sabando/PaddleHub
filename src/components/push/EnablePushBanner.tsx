"use client";

import { Bell, BellOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePushSubscription } from "@/hooks/usePushSubscription";

// Inline banner: gives players a one-tap opt-in for background match
// notifications. Hides itself when the browser doesn't support push at all.
export function EnablePushBanner() {
  const { state, busy, subscribe, unsubscribe } = usePushSubscription();

  if (state === "loading" || state === "unsupported") return null;

  if (state === "denied") {
    return (
      <div className="flex items-start gap-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
        <BellOff className="mt-0.5 h-4 w-4 shrink-0" />
        <div className="min-w-0">
          <div className="font-medium">Notifications are blocked</div>
          <p className="text-xs">
            Enable notifications for this site in your browser settings to get pinged when your next match is ready.
          </p>
        </div>
      </div>
    );
  }

  if (state === "subscribed") {
    return (
      <div className="flex flex-col gap-2 rounded-md border bg-card p-3 text-sm sm:flex-row sm:items-center sm:justify-between sm:gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <Bell className="h-4 w-4 shrink-0 text-green-600" />
          <span className="min-w-0">You&apos;ll get a push when your next match is ready.</span>
        </div>
        <Button
          className="self-end text-nowrap sm:self-auto"
          variant="ghost"
          size="sm"
          onClick={() => unsubscribe()}
          disabled={busy}
        >
          Turn off
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 rounded-md border border-dashed bg-card p-3 text-sm sm:flex-row sm:items-center sm:justify-between sm:gap-3">
      <div className="flex min-w-0 items-start gap-2 sm:items-center">
        <Bell className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground sm:mt-0" />
        <span className="min-w-0">
          Get notified when your next match is ready — even if the tab is closed.
        </span>
      </div>
      <Button
        className="self-end text-nowrap sm:self-auto"
        size="sm"
        onClick={() => subscribe()}
        disabled={busy}
      >
        {busy ? "Enabling…" : "Enable push"}
      </Button>
    </div>
  );
}
