/**
 * Canonical sporting-data shapes. The app only ever reads these; provider-specific
 * adapters (src/lib/api/adapter.ts) map external API responses into them.
 * Mirrors docs/SCHEMA.md §4.4. `apiRef` keys link canonical rows to the provider.
 */

export type FirstScoringTeam = 'A' | 'B' | 'none';

export type GoalMinuteBucket =
  | '0-10'
  | '11-20'
  | '21-30'
  | '31-40'
  | '41-50'
  | '51-60'
  | '61-70'
  | '71-80'
  | '81-90'
  | '90+'
  | 'none';

export type CanonicalMatchStatus = 'scheduled' | 'live' | 'concluded' | 'cancelled';

export interface CanonicalTeam {
  apiRef: string;
  name: string;
  shortName?: string;
  badgeUrl?: string;
}

export interface CanonicalPlayer {
  apiRef: string;
  teamApiRef: string;
  name: string;
}

export interface CanonicalMatch {
  apiRef: string;
  homeTeamApiRef: string;
  awayTeamApiRef: string;
  /** ISO-8601 UTC kickoff. */
  kickoffUtc: string;
  status: CanonicalMatchStatus;
}

export interface CanonicalMatchResult {
  matchApiRef: string;
  scoreA: number;
  scoreB: number;
  firstScoringTeam: FirstScoringTeam;
  firstGoalBucket: GoalMinuteBucket;
  /** Some providers may not supply MOTM; admin fills it in at conclusion. */
  motmPlayerApiRef?: string | null;
}
