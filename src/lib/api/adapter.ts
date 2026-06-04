import type {
  CanonicalMatch,
  CanonicalMatchResult,
  CanonicalPlayer,
  CanonicalTeam,
} from './types';

/**
 * Contract every sports-data provider adapter must implement. Swapping providers
 * means writing a new implementation of this interface — no app logic changes.
 *
 * No provider is chosen yet (SPEC.md §11). Implementations live under
 * src/lib/api/providers/<name>.ts and are selected via env config.
 */
export interface SportsApiAdapter {
  /** All teams relevant to the tournament. */
  fetchTeams(): Promise<CanonicalTeam[]>;

  /** Squad for a team, used to populate MOTM choices. */
  fetchPlayers(teamApiRef: string): Promise<CanonicalPlayer[]>;

  /** Fixtures, optionally bounded by a date range. */
  fetchMatches(range?: { fromUtc: string; toUtc: string }): Promise<CanonicalMatch[]>;

  /** Final result for a single match; null if not yet concluded upstream. */
  fetchMatchResult(matchApiRef: string): Promise<CanonicalMatchResult | null>;
}
