# Recruiter Demo Script

A 3-minute walkthrough hitting the headline features.

## 0. Setup (before the call)

- Open `https://paddlehub.vercel.app` (or local `npm run dev` after `npm run db:seed`).
- Sign in as `alice@demo.paddlehub.app` in one tab and `bob@demo.paddlehub.app` in another (incognito).

## 1. Landing → sign-in (30s)

- "Production-ready auth via Clerk — OAuth, magic links, sessions, MFA out of the box."
- Click "Sign in", complete flow, land on `/dashboard`.

## 2. Browse + filter matches (30s)

- Navigate to `/matches`. Adjust the skill slider — filters sync to the URL.
- Point at React Query devtools (bottom corner): cached responses, optimistic updates.

## 3. Create a match (30s)

- `/matches/new`. Fill the form; show inline Zod validation (e.g., past date rejected).
- Submit. New match appears in the list without a full reload (mutation invalidates the query).

## 4. Real-time join (45s)

- In tab A, open the new match's detail page.
- In tab B (Bob), click Join.
- Tab A updates instantly: slot count ticks up, "Bob joined" appears in chat.
- "That's Pusher presence channels. Server triggers events from the API route after the DB write."

## 5. Dark mode + mobile (15s)

- Toggle theme. Resize to mobile width. Lighthouse score in DevTools.

## 6. Code highlights (30s, optional)

- `src/lib/validators/match.ts` — one Zod schema shared by form + API.
- `src/server/services/matchService.ts` — business logic isolated from HTTP.
- `tests/unit/validators.test.ts` — Vitest; CI runs lint + typecheck + tests on every PR.
