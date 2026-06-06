# Nart World Cup — Database Schema (design)

Target: **Supabase Postgres**, accessed via **Drizzle**. This is the design doc to
agree on *before* writing migrations. DDL below is illustrative (Postgres dialect);
column types/constraints are the contract, exact Drizzle syntax comes later.

Conventions:
- Player identity lives in Supabase's `auth.users`; our app data for a player lives
  in **`profiles`** (1:1, same `id`).
- All timestamps are `timestamptz`, stored UTC.
- `api_ref` columns are nullable placeholders for the (not-yet-chosen) sports API.
- **Admin actions run server-side with the Supabase service role and bypass RLS.**
  RLS exists to protect *player*-initiated reads/writes.

---

## 1. Enums

```sql
create type match_day_status   as enum ('draft', 'active', 'finalized');
create type match_status       as enum ('scheduled', 'locked', 'live', 'concluded', 'cancelled');
create type first_scoring_team  as enum ('A', 'B', 'none');
create type goal_minute_bucket  as enum (
  '0-10','11-20','21-30','31-40','41-50',
  '51-60','61-70','71-80','81-90','90+','none'
);
create type result_source       as enum ('api', 'admin');
create type theme_pref          as enum ('light', 'dark', 'system');
create type league_status       as enum ('active', 'finalized');
create type notification_type   as enum ('mention', 'match_day_finalized', 'reminder', 'system');
create type tournament_phase    as enum (
  'group','round_of_32','round_of_16','quarter_final','semi_final','third_place','final'
);  -- WC 2026 (48-team) bracket; drives phase leaderboards
```

---

## 2. Identity & config

### `profiles` — one row per player
```sql
create table profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  email         text not null unique,          -- enforced @technarts.com at auth layer
  username      text unique,                   -- chosen during onboarding
  avatar_url    text,
  theme         theme_pref not null default 'system',
  onboarded_at  timestamptz,                   -- null until onboarding flow completes
  joined_at     timestamptz not null default now(),  -- tie-breaker: earliest join
  total_points  integer not null default 0,    -- denormalized cache, recomputed on finalize
  created_at    timestamptz not null default now()
);
```

### `admins` — separate username/password auth (NOT Supabase Auth)
```sql
create table admins (
  id            uuid primary key default gen_random_uuid(),
  username      text not null unique,
  password_hash text not null,                 -- argon2/bcrypt; verified server-side at /admin
  created_at    timestamptz not null default now()
);
```

### `league_settings` — single-row global config
```sql
create table league_settings (
  id            boolean primary key default true check (id),   -- singleton guard
  booster_total integer not null default 5,
  status        league_status not null default 'active',
  finalized_at  timestamptz
);
```

---

## 3. Sporting data

### `teams`
```sql
create table teams (
  id         integer generated always as identity primary key,  -- auto-increment id per spec
  name       text not null,
  short_name text,
  badge_url  text,
  api_ref    text,
  created_at timestamptz not null default now()
);
```

### `players` — needed for MOTM
```sql
create table players (
  id         integer generated always as identity primary key,
  team_id    integer not null references teams(id) on delete cascade,
  name       text not null,
  face_url   text,                              -- optional player face photo
  api_ref    text,
  created_at timestamptz not null default now()
);
```

### `match_days`
```sql
create table match_days (
  id           integer generated always as identity primary key,
  name         text not null,                 -- "Matchday 1", "Round of 16", "Final"
  phase        tournament_phase not null,     -- drives phase leaderboards
  sequence     integer not null,              -- ordering across the tournament
  status       match_day_status not null default 'draft',
  finalized_at timestamptz,
  created_at   timestamptz not null default now()
);

-- Only one match day may be 'active' at a time (sequencing rule).
create unique index one_active_match_day on match_days ((status))
  where status = 'active';
```

### `matches`
```sql
create table matches (
  id          integer generated always as identity primary key,
  match_day_id integer not null references match_days(id) on delete cascade,
  team_a_id   integer not null references teams(id),
  team_b_id   integer not null references teams(id),
  kickoff_utc timestamptz not null,
  status      match_status not null default 'scheduled',
  api_ref     text,
  created_at  timestamptz not null default now(),
  check (team_a_id <> team_b_id)
);
-- Per-match lock = kickoff_utc - interval '5 minutes' (derived, not stored).
```

### `match_results` — 1:1 with a concluded match
```sql
create table match_results (
  match_id          integer primary key references matches(id) on delete cascade,
  score_a           integer not null,
  score_b           integer not null,
  first_scoring_team first_scoring_team not null,
  first_goal_bucket goal_minute_bucket not null,
  motm_player_id    integer references players(id),
  source            result_source not null,    -- 'api' pulled, possibly admin-corrected
  concluded_by      uuid references admins(id),
  concluded_at      timestamptz not null default now()
);
```

---

## 4. Predictions, scoring & boosters

### `predictions` — one row per (user, match)
```sql
create table predictions (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references profiles(id) on delete cascade,
  match_id         integer not null references matches(id) on delete cascade,
  score_a          integer,                    -- nullable: partial predictions allowed
  score_b          integer,
  first_scoring_team first_scoring_team,
  first_goal_bucket  goal_minute_bucket,
  motm_player_id   integer references players(id),
  booster_applied  boolean not null default false,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (user_id, match_id)                   -- one prediction per match => no booster stacking
);
```
Editing is allowed by RLS/app only while `now() < kickoff - 5 min`.

**Booster cap (5/tournament, refund on cancel):** enforced by a trigger / app check —
count of `predictions` with `booster_applied = true` for a user, where the related
match is **not** `cancelled`, must be `<= league_settings.booster_total`. Cancelled
matches automatically free the booster (refund) because they're excluded from the count.

### `prediction_scores` — computed at match-day finalize (drives the points breakdown UI)
```sql
create table prediction_scores (
  prediction_id   uuid primary key references predictions(id) on delete cascade,
  match_id        integer not null references matches(id) on delete cascade,
  user_id         uuid not null references profiles(id) on delete cascade,
  match_day_id    integer not null references match_days(id) on delete cascade,
  outcome_pts     integer not null default 0,  -- +3
  home_goals_pts  integer not null default 0,  -- +2
  away_goals_pts  integer not null default 0,  -- +2
  goal_diff_pts   integer not null default 0,  -- +3
  first_team_pts  integer not null default 0,  -- +2
  first_minute_pts integer not null default 0, -- +8
  motm_pts        integer not null default 0,  -- +4
  base_total      integer not null default 0,  -- sum of the above
  booster_applied boolean not null default false,
  final_total     integer not null default 0,  -- base_total * (booster ? 2 : 1)
  created_at      timestamptz not null default now()
);
create index prediction_scores_md_idx on prediction_scores (match_day_id);
```

---

## 5. History & snapshots (reversible finalize)

### `standings_snapshots` — recorded at each match-day finalize and at league finalize
```sql
create table standings_snapshots (
  id            uuid primary key default gen_random_uuid(),
  match_day_id  integer references match_days(id),   -- null for league-final snapshot
  kind          text not null check (kind in ('match_day','league_final')),
  created_at    timestamptz not null default now()
);

create table standings_snapshot_rows (
  snapshot_id      uuid not null references standings_snapshots(id) on delete cascade,
  user_id          uuid not null references profiles(id) on delete cascade,
  rank             integer not null,
  points_this_day  integer not null default 0,  -- gained in this match day
  total_points     integer not null,            -- cumulative after this finalize
  rank_delta       integer not null default 0,  -- vs previous snapshot (up/down animation)
  primary key (snapshot_id, user_id)
);
```

**Reversible finalize strategy:** match-day points live entirely in
`prediction_scores` (scoped by `match_day_id`) and the per-day snapshot. To
**un-finalize**: delete that match day's `prediction_scores`, drop its snapshot, set
`match_days.status` back to `active`, and recompute `profiles.total_points`. The
previous snapshot is the implicit backup, satisfying the spec's "store points before
finalize" safety requirement.

---

## 6. Social: comments, likes, reactions, notifications

### `comments` — per-match thread, max depth 1
```sql
create table comments (
  id         uuid primary key default gen_random_uuid(),
  match_id   integer not null references matches(id) on delete cascade,
  user_id    uuid not null references profiles(id) on delete cascade,
  parent_id  uuid references comments(id) on delete cascade,  -- null = top-level
  body       text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz                          -- soft delete (author or admin)
);
-- Depth-1 guard (a reply's parent must itself be top-level) enforced by a trigger.
create index comments_match_idx on comments (match_id, created_at);
```

### `comment_likes`
```sql
create table comment_likes (
  comment_id uuid not null references comments(id) on delete cascade,
  user_id    uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (comment_id, user_id)
);
```

### `comment_reactions` — emoji
```sql
create table comment_reactions (
  comment_id uuid not null references comments(id) on delete cascade,
  user_id    uuid not null references profiles(id) on delete cascade,
  emoji      text not null,
  primary key (comment_id, user_id, emoji)
);
```

### `comment_mentions` — drives @-tag notifications + linking
```sql
create table comment_mentions (
  comment_id        uuid not null references comments(id) on delete cascade,
  mentioned_user_id uuid not null references profiles(id) on delete cascade,
  primary key (comment_id, mentioned_user_id)
);
```

### `notifications`
```sql
create table notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references profiles(id) on delete cascade,  -- recipient
  type       notification_type not null,
  payload    jsonb not null default '{}',     -- e.g. { comment_id, match_id, actor_id }
  read_at    timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_user_idx on notifications (user_id, read_at);
```

---

## 7. Row-Level Security (the visibility rules)

RLS is enabled on all player-facing tables. The **critical** rule is prediction
secrecy (§5.1 of SPEC): a player may read others' predictions only after the match
has started.

```sql
alter table predictions enable row level security;

-- A player can always see and manage their own prediction.
create policy own_predictions on predictions
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Others' predictions are visible only once the match has started/concluded.
create policy reveal_after_kickoff on predictions
  for select using (
    user_id <> auth.uid()
    and exists (
      select 1 from matches m
      where m.id = predictions.match_id
        and (m.kickoff_utc <= now() or m.status in ('live','concluded'))
    )
  );
```

Other policies (sketch):
- `profiles` — `select` to any authenticated user (public profiles); `update` only
  where `id = auth.uid()` (username/avatar/theme).
- `comments` / `comment_likes` / `comment_reactions` — `select` to all; `insert`
  where `user_id = auth.uid()`; `update`/`delete` own rows (admin deletes via service
  role).
- `notifications` — `select`/`update` only where `user_id = auth.uid()`.
- `match_results`, `standings_snapshots*`, `teams`, `players`, `matches`,
  `match_days` — `select` to all authenticated; writes via service role only.

> The same `reveal_after_kickoff` policy automatically satisfies "profile predictions
> visible except for the active match day," since active-day matches haven't kicked off.

---

## 8. Scoring computation (reference)

At match-day finalize, for each prediction vs `match_results`, compute and store the
per-component points in `prediction_scores`:

| Component | Condition | Pts |
|---|---|---|
| outcome | predicted win/draw/loss matches actual | 3 |
| home goals | `score_a` == actual `score_a` | 2 |
| away goals | `score_b` == actual `score_b` | 2 |
| goal diff | `(score_a - score_b)` == actual diff | 3 |
| first team | `first_scoring_team` matches | 2 |
| first minute | `first_goal_bucket` matches | 8 |
| MOTM | `motm_player_id` matches | 4 |

`final_total = base_total * (booster_applied ? 2 : 1)`. Null prediction components
score 0 (partial predictions). After all matches in the day are scored, recompute
each `profiles.total_points`, write the standings snapshot with `rank_delta` vs the
previous snapshot.

---

## 9. Open items affecting schema
- Sports API provider → shape of `api_ref`, MOTM availability, result polling.
- Booster cap enforcement: DB trigger vs. server-side check (leaning trigger for
  safety).
