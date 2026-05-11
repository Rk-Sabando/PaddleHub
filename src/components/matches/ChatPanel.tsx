"use client";
// TODO: Real-time chat — subscribe to Pusher presence channel `presence-match-<id>`.
export function ChatPanel({ matchId }: { matchId: string }) {
  return <div className="rounded-md border p-4">Chat for {matchId}</div>;
}
