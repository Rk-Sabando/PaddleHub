# Architecture

## System overview

```
[Browser] ──► [Next.js (Vercel)] ──► [Postgres (Neon)]
    │              │
    │              └──► [Clerk] (auth)
    │
    └─────────────► [Pusher Channels] (realtime)
                         ▲
                         │ (server triggers)
                    [Next.js API]
```

## Request flow

1. **Auth.** Clerk middleware (`src/middleware.ts`) protects all routes except `/`, `/sign-in`, `/sign-up`, and webhooks. The first time a Clerk user hits the app, `requireAuth()` (`src/lib/auth.ts`) lazily creates a matching `User` row. Clerk webhooks (`/api/webhooks/clerk`) keep email/name/avatar in sync.
2. **Data fetching.** Pages use TanStack Query hooks (`src/hooks/useMatches.ts`) that hit `/api/matches`. Server-side filtering and pagination keep payloads small.
3. **Mutations.** Joining or creating a match goes through `matchService` (`src/server/services/matchService.ts`), which writes to Postgres via Prisma and then triggers a Pusher event on `presence-match-<id>`.
4. **Realtime.** The match detail page subscribes via `useMatchChannel` and re-renders on `participant:joined`, `participant:left`, and `chat:message` events. Pusher private/presence channel auth goes through `/api/pusher/auth`.

## Data model

See `prisma/schema.prisma`. Highlights:

- `User` 1:N `Match` (via `hostId`)
- `MatchParticipant` join table with `waitlist` flag
- `Rating` is unique per `(matchId, fromId, toId)` so each player rates each other once
- `Notification` stores in-app bell items; `readAt = NULL` means unread

## Why these choices

- **Clerk over rolling our own.** Recruiters recognize it; OAuth + magic links + sessions work out of the box. The webhook + lazy-create pattern keeps Postgres as the source of truth for app data.
- **Pusher over Socket.IO.** Vercel serverless functions can't hold long-lived connections; Pusher handles the transport so the app stays on a single deploy target.
- **Services over fat route handlers.** `server/services/*` is plain TypeScript with no Next.js coupling, so Vitest can exercise the business logic without spinning up the framework.
- **Zod at both ends.** `src/lib/validators/*` is imported by `react-hook-form` resolvers AND route handlers — one schema, two consumers, no drift.
