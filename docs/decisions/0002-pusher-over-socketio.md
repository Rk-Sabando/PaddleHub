# 2. Use Pusher Channels for realtime instead of Socket.IO

Date: 2026-05-11

## Status

Accepted

## Context

The app needs real-time updates for match participant changes and per-match chat. Vercel's serverless platform cannot hold long-lived WebSocket connections, so a self-hosted Socket.IO server would require a second deploy target (Fly.io, Railway, etc.).

## Decision

Use Pusher Channels. Server-side events are triggered from `matchService` after DB writes; clients subscribe via `useMatchChannel`. Private/presence channel auth flows through `/api/pusher/auth`.

## Consequences

- Single deploy target (Vercel) — simpler ops and CI.
- Vendor lock-in to Pusher (mitigated by isolating it in `src/lib/pusher.ts`).
- Free tier (200k messages/day) is enough for portfolio traffic; upgrade path exists.
- If we outgrow Pusher, swap to Ably or a self-hosted Socket.IO server — only `src/lib/pusher.ts` and the auth route change.
