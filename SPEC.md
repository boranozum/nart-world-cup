# Nart World Cup — Feature Specification

A company-wide football match-prediction game for **World Cup 2026**, exclusive to
Technarts employees. Users predict match outcomes before kickoff and earn points;
everyone competes in a single league. An admin runs the tournament: sets up match
days and matches, pulls/confirms results, and finalizes.

> Status: feature set frozen for v1. Tech stack chosen — see §0.

---

## 0. Tech Stack

| Concern | Choice |
|---|---|
| Framework | **Next.js (App Router)** — single app for player UI, admin UI, and server logic |
| UI | **React + Framer Motion + Tailwind + shadcn/ui** (animation-heavy flows) |
| Auth (players) | **Supabase Auth** — Google provider, restricted to `@technarts.com` |
| Auth (admins) | Separate **username/password** + admin role, gated at `/admin` |
| Database | **Supabase Postgres** |
| ORM | **Drizzle** (SQL-first, lightweight, composes well with Supabase RLS) |
| Realtime | **Supabase Realtime** (live standings, post-kickoff prediction reveal) |
| Storage | **Supabase Storage** (profile pictures) |
| Scheduled jobs | **Supabase scheduled functions** (API result pulls) |
| Hosting | **Vercel** (app) + **Supabase** (data/auth/realtime/storage) |

**Key implementation note:** the prediction-secrecy rules (§5.1) — hiding other
users' predictions during the active match day — must be enforced **server-side**
(Postgres RLS and/or server-only queries), never relied upon in the client.

---

## 1. Users & Authentication

- **Players** sign in with **Google SSO**, restricted to `@technarts.com` accounts.
  No other accounts can join. No separate email/password for players.
- **Admins** sign in with **username + password** at a dedicated `/admin` route.
  Admin auth is independent of Google SSO.
- **Two distinct UIs**: the player app and the admin panel.
- **Late arrivals**: employees may join at any time during the tournament. They
  start at **0 points** with **no backfill** — concluded match days show `—` for
  them and earn nothing retroactively.

### Admin security note
Username/password at `/admin` is a deliberate simplicity choice. Provisioning of
admin accounts (seeded vs. self-service) is an implementation detail; treat admin
credentials as privileged and rate-limit the login.

---

## 2. Single League

- One league contains **all employees**. There are no sub-leagues.
- The league has a **standings table** ranked by total points.
- **Tie-breaker order**: total points → most exact scorelines → most correct
  outcomes → most correct MOTM → earliest join time.
- The **latest standings** are shown throughout the app.
- A **standings snapshot** is stored after every match-day finalization (history).

---

## 3. Match Days

Replaces the original "Week" concept to fit a tournament calendar (daily group-stage
fixtures, then sparser knockout rounds).

- A **match day** contains **1..n matches**.
- A match day is **active** or **passive**. Predictions can only be made for matches
  in the **active** match day.
- **Sequencing rule**: a new match day cannot be opened until the current one is
  **finalized**.
- **Finalize gate**: the admin cannot finalize a match day until **every match in it
  is concluded**.

---

## 4. Teams, Matches & the External API

All sporting data (teams, fixtures, scores, players, MOTM) comes from an **external
sports API**. We define a **canonical internal format** and write **adapters** that
map each provider's response into it, so the provider can be swapped without touching
app logic.

### 4.1 Teams
- Added via the admin panel; identified by an auto-incrementing ID.
- Real-world league membership is not tracked — teams are added on demand.

### 4.2 Matches
- Belongs to a match day. Has **Team A**, **Team B**, and a **kickoff date/time**.
- Times are stored in **UTC** and rendered in the viewer's **local timezone**
  (WC 2026 is in North America; players are in Türkiye).
- **Prediction lock**: per-match, **5 minutes before kickoff**. Until then users may
  edit their prediction freely.

### 4.3 Result conclusion (admin-triggered)
- The admin **triggers conclusion per match**. This **pulls that match's result from
  the API** (final score + MOTM + first-scoring team + first-goal minute).
- The admin **reviews and may correct** any pulled value before it stands.
- A match flips to **concluded** after this step. Admin may also force-conclude.

### 4.4 Canonical data contract (sketch — to refine at build time)
```
Team        { id, name, shortName, flag/badge, apiRef }
Player      { id, name, teamId, apiRef }
Match       { id, matchDayId, teamAId, teamBId, kickoffUtc, status, apiRef }
              status ∈ { scheduled, locked, live, concluded }
MatchResult { matchId, scoreA, scoreB, firstScoringTeam, firstGoalMinute, motmPlayerId }
```
Adapters convert provider payloads → these shapes. App logic only ever reads the
canonical shapes.

---

## 5. Predictions

A prediction for a single match has **four components**:

1. **Score** — e.g. Team A 3 – Team B 2
2. **First-scoring team** — Team A / Team B / No goal
3. **First-goal minute bucket** — `0-10, 11-20, 21-30, 31-40, 41-50, 51-60, 61-70,
   71-80, 81-90, 90+, No goal`
4. **Man of the Match (MOTM)** — a player from either squad

- **Partial predictions allowed.** Each component is scored independently. The UI
  **warns** the user before submit/lock if any of the four fields is empty.
- Editable until the per-match 5-minute lock.

### 5.1 Visibility of predictions
- During the **active** match day, a user sees **only their own** prediction.
- Other users' predictions become visible **once a match has started / concluded**,
  in the match detail and history views.
- **Popular predictions**: after a match starts, show the distribution (% of the
  league) across the common scorelines.

---

## 6. Scoring

| Rule | Points |
|---|---|
| Correct outcome (win/draw/loss) | **+3** |
| Correct home-team goal count | **+2** |
| Correct away-team goal count | **+2** |
| Correct goal difference | **+3** |
| Correct first-scoring team | **+2** |
| Correct first-goal minute bucket | **+8** |
| Correct Man of the Match | **+4** |

- Rules **stack**: a perfect scoreline earns outcome + home goals + away goals +
  goal difference simultaneously.
- Components are scored independently, so partial predictions still earn partial
  points.

### 6.1 x2 Booster
- Each user gets **5 boosters for the whole tournament** (configurable).
- **No stacking** — at most one booster per match.
- A booster **doubles all points** earned on the match it is applied to.
- Multiple boosters may be spent within a single match day (on different matches).
- **Unused boosters are lost** at tournament end.
- If a boosted match is **cancelled**, the booster is **refunded**.

---

## 7. Finalization

### 7.1 Match-day finalization
- Available only when **all matches** in the day are concluded.
- **Safety**: snapshot user points + standings **before** computing, store as backup.
  Finalize is **reversible** (un-finalize) to correct a wrong result.
- On finalize, points for all users across the league are computed and added to
  totals; a standings snapshot is recorded.

### 7.2 Match-day overview animation
Shown when a user refreshes / enters the app after a match day is finalized:
1. Their **points for each game**, revealed in order.
2. **League-table changes** with **up/down movement animations**.
3. **Top-3 point scorers** for that match day.

### 7.3 League finalization
- Admin can **finalize the entire league** at tournament end.
- On the user's next refresh/entry: an animation for the **top-3 contenders**,
  followed by the **final league table** (+ end-of-tournament awards, see §10).
- The match-day/prediction page then reads **"the league is over"**; all other pages
  (history, profiles, standings) stay active for viewing.

---

## 8. Comments & Replies (YouTube-style)

- A **comment thread is attached to each match**, shown in the match detail view.
- **Structure**: top-level comments + **one level of replies** (flat at depth 1).
- **@ tagging**: typeahead over `@technarts.com` users; an `@mention` sends an
  in-app notification linking back to the comment. Replies can also `@tag`.
- **Timing**: commenting is **open anytime** (even before kickoff). Predictions stay
  hidden by the §5.1 rules; the UI hints that picks are secret to discourage leaks.
- **Reactions & likes**: emoji reactions and a like count; sort by top / newest.
- **Moderation**: authors edit/delete their own; admins can delete any.

---

## 9. Pages & Flows

### 9.1 Onboarding (first login)
1. **Profile setup** — choose username + profile picture.
2. **Intro slideshow** — visually rich explainer of the app.
3. **Guided app tour** — walks the user through the main screens.

### 9.2 Player pages
- **Prediction page** — active match day's matches; make/edit predictions until
  lock; after kickoff, open a match to see others' predictions + popular picks +
  comments. Shows "the league is over" once the league is finalized.
- **League / standings page** — latest table; access to per-match-day history.
- **User profile** — public to all employees; shows past predictions and points.
  Predictions for the **active** match day are hidden (others'); a user's own
  profile lets them edit avatar/username.
- **Match detail** — score, both teams' predictions (post-kickoff), popular
  predictions, points breakdown, and the comment thread.
- **History** — past match days, predictions, and standings snapshots.

### 9.3 Admin panel (`/admin`)
- Create / manage **teams**.
- Create **match days** (respecting the sequencing rule).
- Add **matches** to the active match day.
- **Conclude** matches (pull result from API, review/correct).
- **Finalize** a match day; **un-finalize** to correct.
- **Finalize the league**.

### 9.4 Theming
- Per-user **dark / light mode** preference, persisted.

---

## 10. Joy & Engagement Backlog

Not all required for v1, but the design should leave room for these.

**Social / banter**
- Popular-predictions bar (post-kickoff %). *(core, §5.1)*
- Comments, replies, reactions. *(core, §8)*
- Rivalries — follow a colleague; show a head-to-head delta on their card.

**Progression & identity**
- Achievements/badges: Oracle (exact scoreline), Nostradamus (correct minute),
  Risk-Taker, Comeback King (biggest single-day climb), Iron Streak.
- Visible **streak** counters.
- **Phase leaderboards**: Group Stage / R16 / QF / SF / Final, plus overall.

**Moment-to-moment**
- Countdown timers to each match's lock + "you haven't predicted yet" nudge.
- **Reminder notifications** before a match day locks (email via Google account
  and/or web push).
- Perfect-prediction celebration (confetti/haptics + shareable card).
- Match-Day MVP + biggest mover, surfaced in the finalize animation.

**End-of-tournament payoff**
- Awards ceremony with superlatives (most boosters wasted, best match day, worst
  prediction).
- Shareable tournament summary card.

---

## 11. Open / Deferred Decisions
- Exact admin-account provisioning mechanism (seeded vs. self-service).
- Which external sports API provider (drives adapter specifics, MOTM availability,
  result latency).
- Notification transport for reminders/mentions (in-app vs. email vs. web push).
- Final booster count (default 5, configurable).
