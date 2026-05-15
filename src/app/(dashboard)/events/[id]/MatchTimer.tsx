"use client";

import { useEffect, useState } from "react";

// Counts up from a given start instant. Refreshes once per second. Server
// gives us the start as a Date so re-renders from router.refresh() reset the
// clock to "now - newStart" automatically when a new match begins.
function format(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => n.toString().padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

export function MatchTimer({ startedAt }: { startedAt: Date | string }) {
  const start =
    typeof startedAt === "string" ? new Date(startedAt) : startedAt;
  const [now, setNow] = useState<number>(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <span className="font-mono tabular-nums text-sm">
      {format(now - start.getTime())}
    </span>
  );
}
