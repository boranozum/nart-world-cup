'use server';

import { createClient } from '@/lib/supabase/server';
import {
  lockTimeMs,
  GOAL_BUCKETS,
  normalizePrediction,
  type GoalBucket,
} from '@/lib/predictions';

type SaveInput = {
  matchId: number;
  scoreA: number | null;
  scoreB: number | null;
  firstScoringTeam: 'A' | 'B' | 'none' | null;
  firstGoalBucket: string | null;
  motmPlayerId: number | null;
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
    .select('id, kickoff_utc, match_day_id, team_a_id, team_b_id')
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
  const rawBucket =
    input.firstGoalBucket && (GOAL_BUCKETS as readonly string[]).includes(input.firstGoalBucket)
      ? (input.firstGoalBucket as GoalBucket)
      : null;

  // Enforce the score's logical constraints server-side so a crafted client can
  // never store an impossible prediction (e.g. a 0-0 with a first scorer set).
  const { firstScoringTeam, firstGoalBucket: bucket } = normalizePrediction({
    scoreA: input.scoreA,
    scoreB: input.scoreB,
    firstScoringTeam: input.firstScoringTeam,
    firstGoalBucket: rawBucket,
  });

  // The MOTM pick must be a player on one of the two teams in this match.
  let motmPlayerId: number | null = null;
  if (input.motmPlayerId != null) {
    const { data: player } = await supabase
      .from('players')
      .select('id, team_id')
      .eq('id', input.motmPlayerId)
      .maybeSingle();
    if (!player || (player.team_id !== match.team_a_id && player.team_id !== match.team_b_id)) {
      return { error: 'That player is not in this match.' };
    }
    motmPlayerId = player.id;
  }

  const { error } = await supabase.from('predictions').upsert(
    {
      user_id: user.id,
      match_id: input.matchId,
      score_a: input.scoreA,
      score_b: input.scoreB,
      first_scoring_team: firstScoringTeam,
      first_goal_bucket: bucket,
      motm_player_id: motmPlayerId,
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
