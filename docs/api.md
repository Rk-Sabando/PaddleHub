# PaddleHub API Reference

Internal reference for the HTTP routes under [src/app/api/](../src/app/api/). Covers the core resources: events, signups, matches, courts, ratings, profile, onboarding, users. Webhooks ([webhooks/clerk](../src/app/api/webhooks/clerk/route.ts)), Pusher auth ([pusher/auth](../src/app/api/pusher/auth/route.ts)), push subscriptions ([push/subscribe](../src/app/api/push/subscribe/route.ts)), and dev seed routes are intentionally omitted.

## Conventions

**Base path.** All routes are under `/api`. Examples below show the path relative to the host.

**Auth.** Authentication is via Clerk. Every request that mutates state runs through one of two helpers in [src/lib/auth.ts](../src/lib/auth.ts):

| Helper          | Effect                                                                |
| --------------- | --------------------------------------------------------------------- |
| `requireAuth()` | Any signed-in user. Lazily creates a DB row mirroring the Clerk user. |
| `requireRole(Role.ADMIN)` | Signed in **and** `user.role === ADMIN`. Throws 403 otherwise. |

Routes labeled **Public** do not call either helper. Routes labeled **Auth** require any signed-in user. Routes labeled **Admin** require `Role.ADMIN`.

**Request bodies.** JSON. Schemas live in [src/lib/validators/](../src/lib/validators/) and are enforced with Zod (`safeParse` → 400 with `issues`, or `parse` → thrown ZodError surfaced as a 500). Date fields accept anything `z.coerce.date()` accepts (ISO strings work).

**Error shape.**

```json
{ "error": "human-readable message", "issues": { /* zod flatten(), optional */ } }
```

**Common status codes.**

| Code | When                                                                              |
| ---- | --------------------------------------------------------------------------------- |
| 200  | Success                                                                           |
| 201  | Resource created                                                                  |
| 400  | Body failed Zod validation (`issues` populated)                                   |
| 401  | Not signed in (`UnauthorizedError`)                                               |
| 403  | Wrong role (`ForbiddenError`)                                                     |
| 404  | Target row does not exist                                                         |
| 409  | Domain conflict (duplicate, capacity, in-flight matchmaking — see per-route refs) |
| 500  | Unhandled error or ZodError on routes that use `parse` instead of `safeParse`     |

Service-layer errors carry their own `status` field which the route returns verbatim — see the domain error classes in [src/server/services/](../src/server/services/) for exact codes.

**Domain enums.** Sourced from [prisma/schema.prisma](../prisma/schema.prisma):

- `MatchFormat`: `SINGLES` | `DOUBLES`
- `MatchStatus`: `OPEN` | `CONFIRMED` | `COMPLETED` | `CANCELLED`
- `EventStatus`: `OPEN` | `IN_PROGRESS` | `COMPLETED` | `CANCELLED`
- `SignupStatus`: `PENDING` | `CONFIRMED` | `DECLINED`
- `CourtStatus`: `AVAILABLE` | `MAINTENANCE` | `CLOSED` | `RENTED`
- `SkillLevel`: `BEGINNER` | `INTERMEDIATE` | `ADVANCED` | `PRO`
- `Role`: `PLAYER` | `ADMIN`

---

## Events

Source: [src/app/api/events/](../src/app/api/events/)

### POST /api/events — create event

**Auth:** Admin.
**Source:** [route.ts](../src/app/api/events/route.ts)
**Validator:** `createEventSchema` in [event.ts](../src/lib/validators/event.ts)

Body:

| Field          | Type                       | Rules                                                     |
| -------------- | -------------------------- | --------------------------------------------------------- |
| `name`         | string                     | 1–120 chars                                               |
| `description?` | string                     | ≤ 1000 chars (empty string allowed)                       |
| `scheduledAt`  | date (coerced)             | required                                                  |
| `endsAt?`      | date \| null               | must be `> scheduledAt` if provided                       |
| `format`       | `SINGLES \| DOUBLES`       |                                                           |
| `capacity`     | int                        | 2–256                                                     |
| `skillMin`     | number                     | 1–5, default 1                                            |
| `skillMax`     | number                     | 1–5, default 5; must be ≥ `skillMin`                      |

**201** → `{ "event": Event }`

### PATCH /api/events/[id] — update or transition status

**Auth:** Admin.
**Source:** [[id]/route.ts](../src/app/api/events/[id]/route.ts)

Two modes, discriminated by request body:

1. **Status transition** — body is exactly `{ "status": EventStatus }`. Runs `eventService.updateStatus`.
2. **Field edit** — any other shape is parsed with `updateEventSchema` (same shape as create). Runs `eventService.update`.

**200** → `{ "event": Event }`

Errors: 400 on bad input, 404 `EventNotFoundError`, plus `InvalidStatusTransitionError`, `EventNotEditableError`, `EventCapacityError` (each carries its own status code).

### PATCH /api/events/[id]/matchmaking-disabled — toggle matchmaking pool

**Auth:** Admin.
**Source:** [matchmaking-disabled/route.ts](../src/app/api/events/[id]/matchmaking-disabled/route.ts)

Body: `{ "matchmakingDisabled": boolean }`. Writes the flag directly via Prisma; no service-layer guards.

**200** → `{ "event": Event }`

### POST /api/events/[id]/matchmake — run matchmaker

**Auth:** Admin.
**Source:** [matchmake/route.ts](../src/app/api/events/[id]/matchmake/route.ts)

No body. Triggers `eventService.matchmake(id)`.

**200**:

```json
{
  "ok": true,
  "created": 0,
  "matchObjects": [ /* Match[] */ ],
  "leftover": [ /* signups not placed */ ],
  "validation": { /* matchmaker validation summary */ },
  "perMatch": [ /* per-court grouping data */ ],
  "courtsUsed": [ /* Court[] */ ]
}
```

Errors: `MatchmakingAlreadyRunError`, `NotEnoughPlayersError`, `NoAvailableCourtsError`, `EventTerminalError`, `EventNotStartedError` — each returns its own status.

### POST /api/events/[id]/courts/[courtId]/assign — assign next queued match

**Auth:** Admin.
**Source:** [courts/[courtId]/assign/route.ts](../src/app/api/events/[id]/courts/[courtId]/assign/route.ts)

No body. Pops the next match from the event's queue onto the given court.

**200**, no queue/match available:

```json
{ "ok": true, "assigned": false, "message": "No queued match or players available." }
```

**200**, assigned:

```json
{
  "ok": true,
  "assigned": true,
  "matchId": "…",
  "participants": [{ "userId": "…", "name": "…" }]
}
```

Errors: `EventClosedError`.

---

## Event signups

### POST /api/events/[id]/signup — request to join

**Auth:** Any signed-in user.
**Source:** [signup/route.ts](../src/app/api/events/[id]/signup/route.ts)

No body. Creates an `EventSignup` in `PENDING` for `(user, event)`.

**201** → `{ "signup": EventSignup }`

Errors: `EventClosedError`, `AlreadySignedUpError`.

### DELETE /api/events/[id]/signup — withdraw

**Auth:** Any signed-in user.
**Source:** same file as above.

No body. Removes the caller's signup.

**200** → `{ "ok": true }`

### PATCH /api/events/[id]/signups/[signupId] — admin confirm or decline

**Auth:** Admin.
**Source:** [signups/[signupId]/route.ts](../src/app/api/events/[id]/signups/[signupId]/route.ts)

Body: `{ "status": "CONFIRMED" | "DECLINED" }`. Other statuses are rejected at validation.

**200** → `{ "signup": EventSignup }`

Errors: `EventCapacityError` (over capacity when confirming), `SignupNotFoundError`.

### PATCH /api/events/[id]/opt-out — player toggles matchmaking exclusion

**Auth:** Any signed-in user (acts on caller's own signup).
**Source:** [opt-out/route.ts](../src/app/api/events/[id]/opt-out/route.ts)

Body: `{ "optedOut": boolean }`. Sets `EventSignup.optedOut` for the caller; player remains on the roster but is excluded from future matchmaking pool reads.

**200** → `{ "signup": EventSignup }`

Errors: `SignupNotFoundError`, `InvalidStatusTransitionError`.

---

## Matches

Source: [src/app/api/matches/](../src/app/api/matches/)

> **Note:** the match routes use `body.parse()` directly (not `safeParse`). Validation failures bubble out as ZodErrors and surface as 500s. Worth tightening, but documented here as-is.

### GET /api/matches — list matches

**Auth:** Public.
**Source:** [route.ts](../src/app/api/matches/route.ts)
**Validator:** `listMatchesQuerySchema`

Query params:

| Param      | Type           | Default |
| ---------- | -------------- | ------- |
| `status`   | `MatchStatus`  | —       |
| `format`   | `MatchFormat`  | —       |
| `skillMin` | number         | —       |
| `skillMax` | number         | —       |
| `page`     | int ≥ 1        | 1       |
| `pageSize` | int 1–50       | 20      |

**200** → `{ "matches": Match[] }`

### POST /api/matches — create match

**Auth:** Any signed-in user (becomes host).
**Validator:** `createMatchSchema`

Body:

| Field         | Type                  | Rules                              |
| ------------- | --------------------- | ---------------------------------- |
| `courtId`     | string                | required                           |
| `scheduledAt` | date (coerced)        | must be in the future              |
| `format`      | `SINGLES \| DOUBLES`  |                                    |
| `skillMin`    | number                | 1–5                                |
| `skillMax`    | number                | 1–5, ≥ `skillMin`                  |
| `capacity`    | int                   | 2–8                                |
| `notes?`      | string                | ≤ 500 chars                        |

**201** → `{ "match": Match }`

### GET /api/matches/[id] — fetch match

**Auth:** Public.
**Source:** [[id]/route.ts](../src/app/api/matches/[id]/route.ts)

**200** → `{ "match": Match }` or **404** if not found.

### PATCH /api/matches/[id] — update match

**Auth:** Any signed-in user (host enforcement is in `matchService.update`).
**Validator:** `updateMatchSchema` (all `createMatchSchema` fields, optional).

**200** → `{ "match": Match }`

### DELETE /api/matches/[id] — cancel match

**Auth:** Any signed-in user (host enforcement is in `matchService.cancel`).

**200** → `{ "ok": true }`

### POST /api/matches/[id]/join — join a match

**Auth:** Any signed-in user.
**Source:** [[id]/join/route.ts](../src/app/api/matches/[id]/join/route.ts)

No body. Returns whatever `matchService.join` produces (typically `{ participant, waitlist }`).

### POST /api/matches/[id]/leave — leave a match

**Auth:** Any signed-in user.
**Source:** [[id]/leave/route.ts](../src/app/api/matches/[id]/leave/route.ts)

No body.

### POST /api/matches/[id]/end — end match and advance queue

**Auth:** Admin **or** a participant of the match (route-level check in [end/route.ts](../src/app/api/matches/[id]/end/route.ts)).

No body. Runs `eventService.endAndAdvanceMatch`, which closes the current match and assigns the next queued match to the freed court if one is available.

**200**:

```json
{
  "ok": true,
  "endedMatchId": "…",
  "nextMatchId": "…" /* or null */,
  "nextParticipants": [{ "userId": "…", "name": "…" }]
}
```

Errors: 403 if non-admin caller is not a participant.

---

## Courts

Source: [src/app/api/courts/](../src/app/api/courts/)

### POST /api/courts — create court

**Auth:** Admin.
**Source:** [route.ts](../src/app/api/courts/route.ts)
**Validator:** `createCourtSchema` in [court.ts](../src/lib/validators/court.ts)

Body:

| Field      | Type            | Rules                                   |
| ---------- | --------------- | --------------------------------------- |
| `name`     | string          | 1–80 chars, unique                      |
| `location` | string          | 1–120 chars                             |
| `surface`  | string          | 1–40 chars                              |
| `status?`  | `CourtStatus`   | defaults to `AVAILABLE`                 |

**201** → `{ "court": Court }`. **409** `CourtNameConflictError` if `name` collides.

### PATCH /api/courts/[id] — update court

**Auth:** Admin.
**Source:** [[id]/route.ts](../src/app/api/courts/[id]/route.ts)
**Validator:** `updateCourtSchema` (all fields optional).

**200** → `{ "court": Court }`. Errors: `CourtNotFoundError`, `CourtNameConflictError`.

### DELETE /api/courts/[id] — delete court

**Auth:** Admin.

**200** → `{ "ok": true }`. Errors: `CourtNotFoundError`, `CourtHasMatchesError` (cannot delete if matches reference the court).

---

## Ratings

### POST /api/ratings — submit a post-match rating

**Auth:** Any signed-in user (caller is `from`).
**Source:** [route.ts](../src/app/api/ratings/route.ts)
**Validator:** `createRatingSchema` in [rating.ts](../src/lib/validators/rating.ts)

> Uses `parse()` directly — validation failures surface as 500. Same caveat as matches.

Body:

| Field           | Type   | Rules                                |
| --------------- | ------ | ------------------------------------ |
| `matchId`       | cuid   | required                             |
| `toId`          | cuid   | required (the rated user)            |
| `sportsmanship` | int    | 1–5                                  |
| `punctuality`   | int    | 1–5                                  |
| `comment?`      | string | ≤ 500 chars                          |

**201** → `{ "rating": Rating }`. The `(matchId, fromId, toId)` triple is unique — second submission errors at the DB layer.

---

## Profile & onboarding

### PATCH /api/profile — update own profile

**Auth:** Any signed-in user.
**Source:** [route.ts](../src/app/api/profile/route.ts)
**Validator:** `onboardingSchema` in [user.ts](../src/lib/validators/user.ts) (reused — keeps the field set in sync with onboarding).

Body:

| Field             | Type                                              | Rules               |
| ----------------- | ------------------------------------------------- | ------------------- |
| `name`            | string                                            | 1–80 chars          |
| `bio?`            | string                                            | ≤ 500, empty → null |
| `skillLevel`      | `BEGINNER \| INTERMEDIATE \| ADVANCED \| PRO`     |                     |
| `skillRating`     | number (coerced)                                  | 1–5                 |
| `preferredFormat` | `SINGLES \| DOUBLES`                              |                     |

**200** → `{ "user": User }`.

### POST /api/onboarding — finish first-time setup

**Auth:** Signed in (uses `auth()` directly + `ensureUserFromClerk`).
**Source:** [route.ts](../src/app/api/onboarding/route.ts)
**Validator:** `onboardingSchema`.

Same body as `PATCH /api/profile`. Additionally:

1. Stamps `onboardedAt = now()` on the DB row.
2. Pushes `{ onboarded: true, role }` into Clerk `publicMetadata` so middleware can read it from `sessionClaims` without a DB hit.

> The Clerk session JWT only carries `publicMetadata` if the **session token template includes `publicMetadata`** (Clerk Dashboard → Sessions → Customize session token). Without that, the DB row updates but the middleware claim stays empty.

**200**:

```json
{
  "ok": true,
  "user": { /* User */ },
  "clerkPublicMetadata": { "onboarded": true, "role": "PLAYER" }
}
```

If the Clerk metadata write fails the route returns **500** with `"Saved your profile, but we couldn't finish account setup. Please try again later."` — the DB row is already updated at that point.

---

## Users

### GET /api/users/[id] — fetch a user by id

**Auth:** Public.
**Source:** [route.ts](../src/app/api/users/[id]/route.ts)

**200** → `{ "user": User }` or **404**. Returns the full Prisma `User` row, including `email` and `clerkId` — keep that in mind before exposing this endpoint publicly.