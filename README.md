# PaddleHub

> Find your next pickleball match — by skill, schedule, and format.

A full-stack match-making app built as a portfolio project demonstrating modern SPA workflows, authentication, real-time updates, and polished UI.

**Live demo:** _coming soon_
**Demo credentials:** see `docs/demo-script.md`

## Stack

| Layer    | Tech                                                          |
| -------- | ------------------------------------------------------------- |
| Frontend | Next.js 15 (App Router), React 19, TypeScript, Tailwind v3, shadcn/ui |
| State    | TanStack Query v5                                             |
| Backend  | Next.js Route Handlers, Prisma                                |
| Database | Postgres (Neon / Supabase)                                    |
| Auth     | Clerk                                                         |
| Realtime | Pusher Channels                                               |
| Tests    | Vitest + Testing Library, Playwright                          |
| Deploy   | Vercel + GitHub Actions                                       |

## Features

**MVP**
- Email/OAuth sign-in, profile with skill rating
- Create, browse, filter, and join matches
- Real-time slot updates and per-match chat
- Post-match score entry and partner ratings
- Player dashboard with stats
- Light/dark theme, mobile-first, accessible

**Advanced**
- Smart match-making (skill proximity + history)
- ELO-style rating + leaderboards
- In-app notifications + email digests
- Round-robin tournament mode
- Admin moderation panel
- PWA (installable + offline shell)

## Local setup

```bash
npm install
cp .env.example .env
# fill in Clerk, Postgres, Pusher secrets
npm run db:migrate
npm run db:seed
npm run dev
```

Open http://localhost:3000.

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start Next.js dev server |
| `npm run test` | Vitest unit + component tests |
| `npm run test:e2e` | Playwright end-to-end tests |
| `npm run typecheck` | TypeScript strict check |
| `npm run db:studio` | Browse the database |

## Project layout

```
src/
  app/              Next.js App Router (routes + API)
  components/       UI primitives, feature components
  lib/              Shared client+server utilities (db, auth, pusher, zod)
  hooks/            React Query + Pusher hooks
  server/services/  Business logic (testable in isolation)
prisma/             Schema, migrations, seed
tests/              Vitest + Playwright
```

See `docs/architecture.md` for the system diagram and `docs/api.md` for the HTTP API reference.

## License

MIT
