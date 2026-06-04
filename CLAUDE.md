# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

> The line above imports the scaffold's framework warning: **this is Next.js 16**,
> which has breaking changes vs. earlier versions. Before writing framework code,
> consult the bundled docs in `node_modules/next/dist/docs/`. Known gotchas already
> hit: `cookies()` is **async** (await it); the `middleware` convention is renamed to
> **`proxy`** (`src/proxy.ts`, exports a `proxy` function).

## What this is

**Nart World Cup** — a company-internal football match-prediction game for World Cup
2026, exclusive to Technarts employees. Players predict matches before kickoff and earn
points in a single shared league; an admin runs the tournament.

- **`SPEC.md`** — the canonical feature specification (frozen for v1). Read this for
  *what* the app does: scoring rules, booster, match-day lifecycle, visibility rules,
  onboarding, animations, comments.
- **`docs/SCHEMA.md`** — the canonical Postgres data model (entities, RLS policies,
  scoring computation). Read this before touching the database.
- **`docs/DESIGN.md`** — the canonical design system (brand palette, typography,
  motion, app shell). Read this before building UI; use design tokens, not hexes.

When SPEC.md / SCHEMA.md and the code disagree, the docs are the source of truth — fix
the code or update the docs deliberately, don't let them drift silently.

## Commands

Node **20** is required (Next 16 needs ≥18.18; the machine default may be older — see
`.nvmrc`, use `nvm use`). All scripts run through npm.

| Command | Purpose |
|---|---|
| `npm run dev` | Start the dev server |
| `npm run build` | Production build |
| `npm run lint` | ESLint |
| `npm run db:generate` | Generate a Drizzle migration from `src/lib/db/schema.ts` |
| `npm run db:migrate` | Apply migrations |
| `npm run db:push` | Push schema directly (dev only) |
| `npm run db:studio` | Drizzle Studio |

## Architecture

Single Next.js (App Router) app; Supabase provides Postgres, auth, realtime, storage.

- **Two audiences, two auth systems.** Players sign in with **Supabase Google SSO**
  restricted to `@technarts.com`. Admins use a **separate username/password** login at
  `/admin` (the `admins` table, not Supabase Auth). Keep these strictly separate.
- **Auth/session plumbing**: `src/lib/supabase/{client,server}.ts` create the browser
  and server Supabase clients; `src/proxy.ts` refreshes the session per request.
- **Database**: Drizzle over postgres-js in `src/lib/db/` (`schema.ts` is the single
  source for tables/enums; `index.ts` exports the `db` client). Migrations in
  `drizzle/`.
- **Prediction secrecy is enforced server-side via Postgres RLS** (see SCHEMA.md §7),
  never in the client. A player may read others' predictions only after a match has
  kicked off. Admin writes use the **service role** key and bypass RLS — keep that key
  server-only.
- **External sports data goes through an adapter.** `src/lib/api/types.ts` defines the
  canonical shapes; `src/lib/api/adapter.ts` is the `SportsApiAdapter` interface every
  provider implementation must satisfy. App logic reads only canonical shapes, so the
  provider (not yet chosen) can be swapped without touching app code.

## Conventions

- Import alias `@/*` → `src/*`.
- Store all times as UTC; render in the viewer's local zone. The per-match prediction
  lock is `kickoff - 5 minutes`.
- Tailwind v4 (CSS-config, no `tailwind.config.js`). Animations use Framer Motion.
- Design tokens (TechNarts navy `#2c397a` + orange `#f37123`) live in
  `src/app/globals.css`; use semantic utilities (`bg-primary`, `text-accent`,
  `bg-card`…), never hardcoded hexes. Fonts: Saira Condensed (display/scores) +
  Hanken Grotesk (body). Light is the default theme; dark via the `.dark` class
  (`next-themes`). See `docs/DESIGN.md`.
