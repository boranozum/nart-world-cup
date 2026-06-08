import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
  type AnyPgColumn,
} from 'drizzle-orm/pg-core';

/* ------------------------------------------------------------------ enums */
// Mirrors docs/SCHEMA.md §1.
export const matchDayStatus = pgEnum('match_day_status', ['draft', 'active', 'finalized']);
export const matchStatus = pgEnum('match_status', [
  'scheduled',
  'locked',
  'live',
  'concluded',
  'cancelled',
]);
export const firstScoringTeam = pgEnum('first_scoring_team', ['A', 'B', 'none']);
export const goalMinuteBucket = pgEnum('goal_minute_bucket', [
  '0-10',
  '11-20',
  '21-30',
  '31-40',
  '41-50',
  '51-60',
  '61-70',
  '71-80',
  '81-90',
  '90+',
  'none',
]);
export const resultSource = pgEnum('result_source', ['api', 'admin']);
export const themePref = pgEnum('theme_pref', ['light', 'dark', 'system']);
export const leagueStatus = pgEnum('league_status', ['active', 'finalized']);
export const notificationType = pgEnum('notification_type', [
  'mention',
  'match_day_finalized',
  'reminder',
  'system',
]);
export const tournamentPhase = pgEnum('tournament_phase', [
  'group',
  'round_of_32',
  'round_of_16',
  'quarter_final',
  'semi_final',
  'third_place',
  'final',
]);

/* ------------------------------------------------------ identity & config */

// One row per player. `id` mirrors auth.users(id); the FK to auth.users is added
// in the follow-up SQL migration (Drizzle does not manage the auth schema).
export const profiles = pgTable('profiles', {
  id: uuid('id').primaryKey(),
  email: text('email').notNull().unique(),
  username: text('username').unique(),
  avatarUrl: text('avatar_url'),
  theme: themePref('theme').notNull().default('system'),
  onboardedAt: timestamp('onboarded_at', { withTimezone: true }),
  disclaimerAcceptedAt: timestamp('disclaimer_accepted_at', { withTimezone: true }),
  joinedAt: timestamp('joined_at', { withTimezone: true }).notNull().defaultNow(),
  totalPoints: integer('total_points').notNull().default(0),
  blockedAt: timestamp('blocked_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// Admin auth — separate username/password, NOT Supabase Auth.
export const admins = pgTable('admins', {
  id: uuid('id').primaryKey().defaultRandom(),
  username: text('username').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// Single-row global config.
export const leagueSettings = pgTable(
  'league_settings',
  {
    id: boolean('id').primaryKey().default(true),
    boosterTotal: integer('booster_total').notNull().default(5),
    // Configurable scoring weights (defaults from SPEC §6). The scoring engine
    // (finalize_match_day) reads these so admins can retune points per component.
    outcomePts: integer('outcome_pts').notNull().default(3),
    homeGoalsPts: integer('home_goals_pts').notNull().default(2),
    awayGoalsPts: integer('away_goals_pts').notNull().default(2),
    goalDiffPts: integer('goal_diff_pts').notNull().default(3),
    firstTeamPts: integer('first_team_pts').notNull().default(2),
    firstMinutePts: integer('first_minute_pts').notNull().default(8),
    motmPts: integer('motm_pts').notNull().default(4),
    status: leagueStatus('status').notNull().default('active'),
    finalizedAt: timestamp('finalized_at', { withTimezone: true }),
  },
  (t) => [check('league_settings_singleton', sql`${t.id}`)],
);

/* ----------------------------------------------------------- sporting data */

export const teams = pgTable('teams', {
  id: integer('id').generatedAlwaysAsIdentity().primaryKey(),
  name: text('name').notNull(),
  shortName: text('short_name'),
  badgeUrl: text('badge_url'),
  apiRef: text('api_ref'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const players = pgTable('players', {
  id: integer('id').generatedAlwaysAsIdentity().primaryKey(),
  teamId: integer('team_id')
    .notNull()
    .references(() => teams.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  faceUrl: text('face_url'),
  apiRef: text('api_ref'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const matchDays = pgTable(
  'match_days',
  {
    id: integer('id').generatedAlwaysAsIdentity().primaryKey(),
    name: text('name').notNull(),
    phase: tournamentPhase('phase').notNull(),
    sequence: integer('sequence').notNull(),
    status: matchDayStatus('status').notNull().default('draft'),
    finalizedAt: timestamp('finalized_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // Only one match day may be 'active' at a time (sequencing rule).
    uniqueIndex('one_active_match_day')
      .on(t.status)
      .where(sql`${t.status} = 'active'`),
  ],
);

export const matches = pgTable(
  'matches',
  {
    id: integer('id').generatedAlwaysAsIdentity().primaryKey(),
    matchDayId: integer('match_day_id')
      .notNull()
      .references(() => matchDays.id, { onDelete: 'cascade' }),
    teamAId: integer('team_a_id')
      .notNull()
      .references(() => teams.id),
    teamBId: integer('team_b_id')
      .notNull()
      .references(() => teams.id),
    kickoffUtc: timestamp('kickoff_utc', { withTimezone: true }).notNull(),
    status: matchStatus('status').notNull().default('scheduled'),
    apiRef: text('api_ref'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [check('matches_distinct_teams', sql`${t.teamAId} <> ${t.teamBId}`)],
);

export const matchResults = pgTable('match_results', {
  matchId: integer('match_id')
    .primaryKey()
    .references(() => matches.id, { onDelete: 'cascade' }),
  scoreA: integer('score_a').notNull(),
  scoreB: integer('score_b').notNull(),
  firstScoringTeam: firstScoringTeam('first_scoring_team').notNull(),
  firstGoalBucket: goalMinuteBucket('first_goal_bucket').notNull(),
  motmPlayerId: integer('motm_player_id').references(() => players.id),
  source: resultSource('source').notNull(),
  concludedBy: uuid('concluded_by').references(() => admins.id),
  concludedAt: timestamp('concluded_at', { withTimezone: true }).notNull().defaultNow(),
});

/* ------------------------------------------ predictions, scoring & boosters */

export const predictions = pgTable(
  'predictions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    matchId: integer('match_id')
      .notNull()
      .references(() => matches.id, { onDelete: 'cascade' }),
    scoreA: integer('score_a'),
    scoreB: integer('score_b'),
    firstScoringTeam: firstScoringTeam('first_scoring_team'),
    firstGoalBucket: goalMinuteBucket('first_goal_bucket'),
    motmPlayerId: integer('motm_player_id').references(() => players.id),
    boosterApplied: boolean('booster_applied').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique('predictions_user_match_unique').on(t.userId, t.matchId)],
);

export const predictionScores = pgTable(
  'prediction_scores',
  {
    predictionId: uuid('prediction_id')
      .primaryKey()
      .references(() => predictions.id, { onDelete: 'cascade' }),
    matchId: integer('match_id')
      .notNull()
      .references(() => matches.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    matchDayId: integer('match_day_id')
      .notNull()
      .references(() => matchDays.id, { onDelete: 'cascade' }),
    outcomePts: integer('outcome_pts').notNull().default(0),
    homeGoalsPts: integer('home_goals_pts').notNull().default(0),
    awayGoalsPts: integer('away_goals_pts').notNull().default(0),
    goalDiffPts: integer('goal_diff_pts').notNull().default(0),
    firstTeamPts: integer('first_team_pts').notNull().default(0),
    firstMinutePts: integer('first_minute_pts').notNull().default(0),
    motmPts: integer('motm_pts').notNull().default(0),
    baseTotal: integer('base_total').notNull().default(0),
    boosterApplied: boolean('booster_applied').notNull().default(false),
    finalTotal: integer('final_total').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('prediction_scores_md_idx').on(t.matchDayId)],
);

/* ----------------------------------------------------- history & snapshots */

export const standingsSnapshots = pgTable(
  'standings_snapshots',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    matchDayId: integer('match_day_id').references(() => matchDays.id),
    kind: text('kind').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [check('standings_kind_check', sql`${t.kind} in ('match_day','league_final')`)],
);

export const standingsSnapshotRows = pgTable(
  'standings_snapshot_rows',
  {
    snapshotId: uuid('snapshot_id')
      .notNull()
      .references(() => standingsSnapshots.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    rank: integer('rank').notNull(),
    pointsThisDay: integer('points_this_day').notNull().default(0),
    totalPoints: integer('total_points').notNull(),
    rankDelta: integer('rank_delta').notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.snapshotId, t.userId] })],
);

/* ---------------------------------------------------------------- social */

export const comments = pgTable(
  'comments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    matchId: integer('match_id')
      .notNull()
      .references(() => matches.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    parentId: uuid('parent_id').references((): AnyPgColumn => comments.id, {
      onDelete: 'cascade',
    }),
    body: text('body').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [index('comments_match_idx').on(t.matchId, t.createdAt)],
);

export const commentLikes = pgTable(
  'comment_likes',
  {
    commentId: uuid('comment_id')
      .notNull()
      .references(() => comments.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.commentId, t.userId] })],
);

export const commentReactions = pgTable(
  'comment_reactions',
  {
    commentId: uuid('comment_id')
      .notNull()
      .references(() => comments.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    emoji: text('emoji').notNull(),
  },
  (t) => [primaryKey({ columns: [t.commentId, t.userId, t.emoji] })],
);

export const commentMentions = pgTable(
  'comment_mentions',
  {
    commentId: uuid('comment_id')
      .notNull()
      .references(() => comments.id, { onDelete: 'cascade' }),
    mentionedUserId: uuid('mentioned_user_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
  },
  (t) => [primaryKey({ columns: [t.commentId, t.mentionedUserId] })],
);

export const notifications = pgTable(
  'notifications',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    type: notificationType('type').notNull(),
    payload: jsonb('payload').notNull().default({}),
    readAt: timestamp('read_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('notifications_user_idx').on(t.userId, t.readAt)],
);
