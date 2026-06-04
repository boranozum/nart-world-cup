import { pgEnum } from 'drizzle-orm/pg-core';

/**
 * Enums mirror docs/SCHEMA.md §1. Table definitions are added in the next step
 * (translating docs/SCHEMA.md into Drizzle tables + the first migration).
 */
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

// TODO(next step): translate the tables in docs/SCHEMA.md §2–§6 to Drizzle.
