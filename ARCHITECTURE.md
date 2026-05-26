# Architecture

A retrospective on PaddleHub. For the system diagram and request flow, see [docs/architecture.md](docs/architecture.md). For the HTTP contract, see [docs/api.md](docs/api.md).

## What we built

A pickleball match-making web app where admins schedule **Events**, players request signups, and a matchmaker turns the confirmed roster into **Matches** queued onto **Courts**. When a match ends, the next queued match auto-advances to the freed court. Players join/leave match queues, chat in real time, get web-push notifications when backgrounded, and rate each other post-match.

The shape:

- **Next.js 15 App Router** as both the SPA shell and the API. One deploy target (Vercel), no separate backend.
- **Postgres via Prisma**. Domain modelled as `User`, `Event`, `EventSignup`, `Match`, `MatchParticipant`, `Court`, `Rating`, plus `PushSubscription` and `Notification`.
- **Clerk** for auth. Our DB row is lazily mirrored from Clerk on first request; `publicMetadata.role` rides on the session JWT so middleware does role checks without a DB hit.
- **Service layer** under [src/server/services/](src/server/services/) holds the domain logic — plain TypeScript, no Next.js coupling, throws typed errors (`EventCapacityError`, `CourtNameConflictError`, …) that route handlers translate to status codes.
- **Pusher Channels** for realtime; **Web Push** for backgrounded clients (installed PWA only).
- **Zod validators** in [src/lib/validators/](src/lib/validators/) shared by route handlers and `react-hook-form` resolvers — one schema, two consumers.

## Key decisions and why

- **Single deploy target (Vercel) drove the realtime choice.** Serverless functions can't hold WebSocket connections, so Pusher won over Socket.IO ([ADR 0002](docs/decisions/0002-pusher-over-socketio.md)). Worth it for ops simplicity; the trade is vendor lock-in, mitigated by isolating Pusher in [src/lib/pusher.ts](src/lib/pusher.ts).
- **Service layer over fat route handlers.** Route handlers do auth + Zod + error mapping; everything else lives in `*Service.ts`. Makes Vitest tests possible without spinning up Next, and gives us one place to throw domain errors with explicit `status` codes.
- **Lazy user mirroring instead of a Clerk-webhook-only sync.** `requireAuth()` creates the DB row on first hit. Webhook-only sync would race the first request after sign-up. The cost is a `findUnique` per request, which is cheap and behind Clerk's edge cache anyway.
- **`publicMetadata.role` mirrored to Clerk during onboarding.** Middleware reads role from `sessionClaims` so unauthorized admin routes never reach the route handler. The DB remains source of truth; the JWT is just a fast-path cache.
- **Events and Matches kept as separate aggregates.** Matches can exist standalone (pickup play) or be generated from an Event. Courts attach per-Match, not per-Event — gave the matchmaker room to pack multiple courts and made the "end match → advance queue" loop trivial.
- **Zod everywhere, but with one inconsistency.** Event/court/onboarding routes use `safeParse` → 400 with `issues`. Match and rating routes use `.parse()` directly, so validation errors throw and surface as 500. Documented in [docs/api.md](docs/api.md); should be aligned.

## What we'd do differently with more time

- **Move matchmaking out of the request lifecycle.** `POST /api/events/[id]/matchmake` runs the algorithm synchronously and returns the result. Fine at portfolio scale; a queued background job (Inngest, QStash, or Vercel cron + worker) is the right shape.
- **Add a thin typed API client.** [src/lib/apiClient.ts](src/lib/apiClient.ts) exists but the hooks each hand-roll their fetches. A generated client (or even hand-written wrappers keyed off the Zod schemas) would remove the drift between hook and route.
- **Lock down [GET /api/users/[id]](src/app/api/users/[id]/route.ts).** Currently public and returns the full Prisma `User` row including `email` and `clerkId`. Should be authed and project a safe subset.
- **Optimistic UI for join/leave.** Today the UI waits for the Pusher round-trip. With TanStack Query mutations + a cache update on success, the perceived latency drops to zero and Pusher just confirms.
- **Property-based tests on the matchmaker.** Skill-band + pairing logic has enough surface area that fast-check would find edge cases unit tests miss.
- **Rate limiting on writes.** No per-user throttle on match creation, ratings, or signup-spam endpoints.

## Where it breaks first at 100x

Ranked by what I'd expect to fail first:

1. **Postgres connection exhaustion under serverless cold starts.** Prisma in Vercel functions opens a pool per invocation; without pgbouncer-style pooling (Neon supports it, but the connection string would need updating), 100x traffic spikes will exhaust the connection cap before CPU or memory matters. *Fix: switch to Neon's pooled connection string + add `?pgbouncer=true&connection_limit=1` for serverless.*
2. **Matchmaking timeout.** `eventService.matchmake` runs the full algorithm in one request. At 100x signups per event, the pairing search will blow past Vercel's 10s default. *Fix: queue the job, return 202, push the result via Pusher when done.*
3. **Pusher message budget.** Free tier is 200k messages/day. At 100x active users with chat + participant events + match transitions, that's a single weekend. *Fix: upgrade tier, or batch low-priority events (e.g. coalesce roster updates with debouncing on the server).*
4. **`/api/matches` index coverage.** Only `(status, scheduledAt)` is indexed; the filter accepts `status`, `format`, `skillMin`, `skillMax`. At 100x rows, the skill-range + format combinations will table-scan. *Fix: composite index on `(status, format, skillMin, skillMax)`, or move list reads to a denormalized search table.*
5. **Push fan-out is unpartitioned.** [PushSubscription](prisma/schema.prisma) is indexed on `userId` only. When a single event notification fans out to 100x recipients with multiple devices each, that's a large in-process loop calling Web Push sequentially. *Fix: queue the fan-out, or shard by event.*
6. **N+1 risk in matchmake response.** The route returns `matchObjects`, `perMatch`, `courtsUsed`, and `leftover` — the underlying loops likely do per-match queries. Fine for one event; not fine when admins re-run matchmaking on a busy night.

Auth (Clerk) and the static asset path (Vercel CDN) are the parts I'd *least* worry about at 100x — they're already designed for it.
