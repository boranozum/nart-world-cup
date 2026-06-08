# Nart World Cup

A company-internal football match-prediction game for **World Cup 2026**, exclusive
to Technarts employees. Players predict match outcomes before kickoff and earn points
in a single shared league; an admin runs the tournament — setting up match days and
matches, pulling/confirming results, and finalizing.

See [`SPEC.md`](./SPEC.md) for the full feature specification.

## Tech stack

| Concern | Choice |
|---|---|
| Framework | Next.js (App Router) — single app for player UI, admin UI, and server logic |
| UI | React + Framer Motion + Tailwind v4 + shadcn/ui |
| Auth (players) | Supabase Auth — Google provider, restricted to `@technarts.com` |
| Auth (admins) | Separate username/password + admin role, gated at `/admin` |
| Database | Supabase Postgres |
| ORM | Drizzle (over postgres-js) |
| Realtime | Supabase Realtime (live standings, post-kickoff prediction reveal) |
| Storage | Supabase Storage (profile pictures) |
| Scheduled jobs | Supabase scheduled functions (API result pulls) |
| Hosting | Vercel (app) + Supabase (data/auth/realtime/storage) |

## Getting started

Node **20** is required (`.nvmrc` — run `nvm use`).

```bash
npm install
cp .env.example .env.local   # fill in Supabase + admin + sports API credentials
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the app.

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Start the dev server |
| `npm run build` | Production build |
| `npm run lint` | ESLint |
| `npm run db:generate` | Generate a Drizzle migration from `src/lib/db/schema.ts` |
| `npm run db:migrate` | Apply migrations |
| `npm run db:push` | Push schema directly (dev only) |
| `npm run db:studio` | Drizzle Studio |

## Documentation

| Doc | Covers |
|---|---|
| [`SPEC.md`](./SPEC.md) | Feature spec — scoring rules, booster, match-day lifecycle, visibility rules, onboarding, animations, comments |
| [`docs/SCHEMA.md`](./docs/SCHEMA.md) | Postgres data model — entities, RLS policies, scoring computation |
| [`docs/DESIGN.md`](./docs/DESIGN.md) | Design system — brand palette, typography, motion, app shell |

When the docs and the code disagree, the docs are the source of truth — fix the code
or update the docs deliberately, don't let them drift silently.
