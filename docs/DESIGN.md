# Nart World Cup — Design System

Canonical UI/UX direction. Source of truth for look & feel; tokens live in
`src/app/globals.css`, fonts/provider in `src/app/layout.tsx`.

## Direction (frozen)

| Decision | Choice |
|---|---|
| Language | **English** only (no i18n for v1) |
| Platform | **Desktop-first**, responsive down to mobile |
| Personality | **Bold & sporty** — broadcast/scoreboard energy |
| Navigation | **Hybrid** — top bar (brand, notifications, profile, theme) + bottom tabs on mobile (Picks · League · Me) |
| Default theme | **Light** (per-user dark toggle via `next-themes`, class strategy) |
| Typography | **Sporty scoreboard mix** — condensed display + tabular numerals for headings/scores, clean grotesk for body |
| Motion | **Balanced** — orchestrate key moments (match-day reveal, table movement, score reveals); restrained elsewhere |

## Brand & palette

Derived from **technarts.com** ("Technology is an art."). Navy primary, orange accent.

| Token | Light | Dark | Use |
|---|---|---|---|
| `primary` | `#2c397a` | `#4a5bd0` | brand, primary buttons, links |
| `primary-strong` | `#18204b` | `#2c397a` | hero/nav backgrounds, deep fills |
| `accent` | `#f37123` | `#f37123` | points, boosters, CTAs, highlights |
| `background` | `#f4f5f8` | `#0e1430` | app background |
| `foreground` | `#1b2240` | `#e9ecf7` | body text |
| `card` | `#ffffff` | `#18204b` | cards/surfaces |
| `muted` / `muted-foreground` | `#e9ecf2` / `#5d6480` | `#1c2547` / `#9aa3c6` | secondary surfaces/text |
| `border` / `input` | `#dde1ea` | `#2a3360` | hairlines, fields |
| `success` | `#16a34a` | `#29c06a` | correct picks, live/positive |
| `danger` | `#e5484d` | `#ff5b60` | errors, wrong picks, rank drops |

All exposed as Tailwind v4 utilities via `@theme inline` (e.g. `bg-primary`,
`text-accent`, `border-border`, `bg-card`). Never hardcode hexes in components —
use the tokens so dark mode and rebrands stay free.

## Typography

- **Display:** `Saira Condensed` (`--font-display`, weights 500–800) — headings,
  section titles, scores. Sporty, condensed, tabular figures.
- **Body:** `Hanken Grotesk` (`--font-sans`) — everything else. Refined, legible.
- Headings default to the display font (base layer). Big numbers use the `.score`
  utility (display font + `tabular-nums`).
- Deliberately **not** Inter/Roboto/Arial.

## Motion (Framer Motion)

- One orchestrated, staggered reveal per page load beats scattered micro-interactions.
- Reserve the big sequences for: match-day finalize overview (points → table
  movement → top-3), perfect-prediction celebration, score reveals.
- Respect `prefers-reduced-motion` (to wire up in shared motion helpers).

## Components & conventions

- **shadcn/ui** primitives on these tokens; Tailwind v4 (CSS config, no
  `tailwind.config.js`).
- Radii via `--radius` scale (`rounded-md/lg/xl`).
- Theme: `ThemeProvider` (`src/components/theme-provider.tsx`) with
  `attribute="class"`, `defaultTheme="light"`. `ThemeToggle` for switching.
- `<html suppressHydrationWarning>` is required for `next-themes`.

## App shell (to build)

- **Top bar:** wordmark, notifications bell, profile avatar, theme toggle.
- **Bottom tabs (mobile):** Picks · League · Me.
- **Desktop:** top bar carries primary nav; bottom tabs hidden ≥ md.
