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

/**
 * Logical constraints a predicted score places on the other prediction fields.
 *
 * The score is the most concrete component, so it drives what is possible for
 * the first-scoring team and the first-goal minute. A goalless 0-0 means there
 * was "No goal"; any predicted goal means there must have been a first scorer
 * and a real first-goal minute; and a team that scored zero cannot be the first
 * to score. `scoreA`/`scoreB` may be `null` when the user hasn't entered them
 * yet, in which case fewer constraints apply.
 */
export type PredictionConstraints = {
  /** "First to score" options that are impossible and must be disabled. */
  firstTeamDisabled: Record<FirstScoringTeam, boolean>;
  /** The "No goal" minute bucket is impossible (a goal was predicted). */
  bucketNoneDisabled: boolean;
  /** Every real time bucket is impossible (a goalless draw was predicted). */
  bucketTimeDisabled: boolean;
  /** When the score fully determines the first scorer, the value to force. */
  forcedFirstTeam: FirstScoringTeam | null;
  /** When the score forces the minute bucket (0-0 ⇒ "No goal"). */
  forcedBucket: GoalBucket | null;
};

export function predictionConstraints(
  scoreA: number | null,
  scoreB: number | null,
): PredictionConstraints {
  const aScored = scoreA != null && scoreA > 0;
  const bScored = scoreB != null && scoreB > 0;
  const aZero = scoreA === 0;
  const bZero = scoreB === 0;
  const anyGoal = aScored || bScored;
  const goalless = aZero && bZero;

  if (goalless) {
    return {
      firstTeamDisabled: { A: true, B: true, none: false },
      bucketNoneDisabled: false,
      bucketTimeDisabled: true,
      forcedFirstTeam: 'none',
      forcedBucket: 'none',
    };
  }

  // Exactly one side scored (and the other is a confirmed 0) ⇒ first scorer known.
  let forcedFirstTeam: FirstScoringTeam | null = null;
  if (aZero && bScored) forcedFirstTeam = 'B';
  else if (bZero && aScored) forcedFirstTeam = 'A';

  return {
    firstTeamDisabled: { A: aZero, B: bZero, none: anyGoal },
    bucketNoneDisabled: anyGoal,
    bucketTimeDisabled: false,
    forcedFirstTeam,
    forcedBucket: null,
  };
}

/**
 * Reconcile a first-scoring-team / first-goal-minute pick against the score so
 * stored predictions can never be logically impossible. Used server-side as a
 * defense-in-depth mirror of the live UI enforcement.
 */
export function normalizePrediction(p: {
  scoreA: number | null;
  scoreB: number | null;
  firstScoringTeam: FirstScoringTeam | null;
  firstGoalBucket: GoalBucket | null;
}): { firstScoringTeam: FirstScoringTeam | null; firstGoalBucket: GoalBucket | null } {
  const c = predictionConstraints(p.scoreA, p.scoreB);

  let firstScoringTeam = p.firstScoringTeam;
  if (c.forcedFirstTeam) firstScoringTeam = c.forcedFirstTeam;
  else if (firstScoringTeam && c.firstTeamDisabled[firstScoringTeam]) firstScoringTeam = null;

  let firstGoalBucket = p.firstGoalBucket;
  if (c.forcedBucket) firstGoalBucket = c.forcedBucket;
  else if (firstGoalBucket === 'none' && c.bucketNoneDisabled) firstGoalBucket = null;
  else if (firstGoalBucket && firstGoalBucket !== 'none' && c.bucketTimeDisabled)
    firstGoalBucket = 'none';

  return { firstScoringTeam, firstGoalBucket };
}
