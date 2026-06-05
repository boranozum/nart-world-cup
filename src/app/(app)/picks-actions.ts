'use server';

import { createClient } from '@/lib/supabase/server';
import { lockTimeMs, GOAL_BUCKETS } from '@/lib/predictions';

type SaveInput = {
  matchId: number;
  scoreA: number | null;
  scoreB: number | null;
  firstScoringTeam: 'A' | 'B' | 'none' | null;
  firstGoalBucket: string | null;
  boosterApplied: boolean;
};

export async function savePrediction(input: SaveInput): Promise<{ error: string } | { ok: true }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'You are not signed in.' };

  const { data: match } = await supabase
    .from('matches')
    .select('id, kickoff_utc, match_day_id')
    .eq('id', input.matchId)
    .maybeSingle();
  if (!match) return { error: 'Match not found.' };

  const { data: md } = await supabase
    .from('match_days')
    .select('status')
    .eq('id', match.match_day_id)
    .maybeSingle();
  if (md?.status !== 'active') return { error: 'This match day is not open for predictions.' };

  if (Date.now() >= lockTimeMs(match.kickoff_utc)) {
    return { error: 'Predictions are locked for this match.' };
  }

  // Light validation — partial predictions are allowed.
  const bucket =
    input.firstGoalBucket && (GOAL_BUCKETS as readonly string[]).includes(input.firstGoalBucket)
      ? input.firstGoalBucket
      : null;

  const { error } = await supabase.from('predictions').upsert(
    {
      user_id: user.id,
      match_id: input.matchId,
      score_a: input.scoreA,
      score_b: input.scoreB,
      first_scoring_team: input.firstScoringTeam,
      first_goal_bucket: bucket,
      booster_applied: input.boosterApplied,
    },
    { onConflict: 'user_id,match_id' },
  );

  if (error) {
    if (error.message?.includes('Booster limit')) {
      return { error: 'You have used all your boosters.' };
    }
    return { error: 'Could not save your prediction. Please try again.' };
  }
  return { ok: true };
}
