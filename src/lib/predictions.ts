export const GOAL_BUCKETS = [
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
] as const;

export type GoalBucket = (typeof GOAL_BUCKETS)[number];
export type FirstScoringTeam = 'A' | 'B' | 'none';

export function goalBucketLabel(b: GoalBucket): string {
  return b === 'none' ? 'No goal' : `${b}'`;
}

/** Per-match prediction lock: 5 minutes before kickoff. */
export const LOCK_MS_BEFORE_KICKOFF = 5 * 60 * 1000;

export function lockTimeMs(kickoffUtc: string | Date): number {
  return new Date(kickoffUtc).getTime() - LOCK_MS_BEFORE_KICKOFF;
}
