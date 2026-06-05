-- Custom SQL migration: the scoring engine.
-- finalize_match_day computes per-prediction points into prediction_scores,
-- recomputes profiles.total_points, and writes a standings snapshot with rank_delta.
-- unfinalize_match_day reverses the most recent finalize (reversible-finalize strategy,
-- see docs/SCHEMA.md §5). Point values come from docs/SCHEMA.md §8.

CREATE OR REPLACE FUNCTION public.finalize_match_day(p_match_day_id int)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status       match_day_status;
  v_unconcluded  int;
  v_snapshot_id  uuid;
  v_prev_id      uuid;
BEGIN
  -- Guard: the match day must exist and be active.
  SELECT status INTO v_status FROM match_days WHERE id = p_match_day_id FOR UPDATE;
  IF v_status IS NULL THEN
    RAISE EXCEPTION 'Match day % not found', p_match_day_id;
  END IF;
  IF v_status <> 'active' THEN
    RAISE EXCEPTION 'Match day % is not active (status: %)', p_match_day_id, v_status;
  END IF;

  -- Guard: every non-cancelled match must have a concluded result.
  SELECT count(*) INTO v_unconcluded
  FROM matches m
  LEFT JOIN match_results r ON r.match_id = m.id
  WHERE m.match_day_id = p_match_day_id
    AND m.status <> 'cancelled'
    AND r.match_id IS NULL;
  IF v_unconcluded > 0 THEN
    RAISE EXCEPTION 'Match day % has % unconcluded match(es)', p_match_day_id, v_unconcluded;
  END IF;

  -- Recompute from scratch: clear any stale scores for this day.
  DELETE FROM prediction_scores WHERE match_day_id = p_match_day_id;

  -- Score every prediction on this day's matches. Null components score 0
  -- (partial predictions are allowed). final_total doubles when the booster is on.
  INSERT INTO prediction_scores (
    prediction_id, match_id, user_id, match_day_id,
    outcome_pts, home_goals_pts, away_goals_pts, goal_diff_pts,
    first_team_pts, first_minute_pts, motm_pts,
    base_total, booster_applied, final_total
  )
  SELECT
    p.id, p.match_id, p.user_id, m.match_day_id,
    c.outcome_pts, c.home_goals_pts, c.away_goals_pts, c.goal_diff_pts,
    c.first_team_pts, c.first_minute_pts, c.motm_pts,
    t.base_total,
    p.booster_applied,
    t.base_total * (CASE WHEN p.booster_applied THEN 2 ELSE 1 END)
  FROM predictions p
  JOIN matches m       ON m.id = p.match_id
  JOIN match_results r ON r.match_id = p.match_id
  CROSS JOIN LATERAL (
    SELECT
      -- outcome: predicted win/draw/loss direction matches actual
      CASE WHEN p.score_a IS NOT NULL AND p.score_b IS NOT NULL AND (
             (p.score_a > p.score_b AND r.score_a > r.score_b) OR
             (p.score_a = p.score_b AND r.score_a = r.score_b) OR
             (p.score_a < p.score_b AND r.score_a < r.score_b)
           ) THEN 3 ELSE 0 END AS outcome_pts,
      CASE WHEN p.score_a IS NOT NULL AND p.score_a = r.score_a THEN 2 ELSE 0 END AS home_goals_pts,
      CASE WHEN p.score_b IS NOT NULL AND p.score_b = r.score_b THEN 2 ELSE 0 END AS away_goals_pts,
      CASE WHEN p.score_a IS NOT NULL AND p.score_b IS NOT NULL
            AND (p.score_a - p.score_b) = (r.score_a - r.score_b) THEN 3 ELSE 0 END AS goal_diff_pts,
      CASE WHEN p.first_scoring_team IS NOT NULL
            AND p.first_scoring_team = r.first_scoring_team THEN 2 ELSE 0 END AS first_team_pts,
      CASE WHEN p.first_goal_bucket IS NOT NULL
            AND p.first_goal_bucket = r.first_goal_bucket THEN 8 ELSE 0 END AS first_minute_pts,
      CASE WHEN p.motm_player_id IS NOT NULL
            AND p.motm_player_id = r.motm_player_id THEN 4 ELSE 0 END AS motm_pts
  ) c
  CROSS JOIN LATERAL (
    SELECT c.outcome_pts + c.home_goals_pts + c.away_goals_pts + c.goal_diff_pts
         + c.first_team_pts + c.first_minute_pts + c.motm_pts AS base_total
  ) t
  WHERE m.match_day_id = p_match_day_id
    AND m.status <> 'cancelled';

  -- Recompute cumulative totals across all finalized days (reset then sum).
  UPDATE profiles SET total_points = 0;
  UPDATE profiles pr
  SET total_points = s.pts
  FROM (
    SELECT user_id, sum(final_total) AS pts
    FROM prediction_scores
    GROUP BY user_id
  ) s
  WHERE pr.id = s.user_id;

  -- Previous match-day snapshot (by match-day sequence) drives rank_delta.
  SELECT s.id INTO v_prev_id
  FROM standings_snapshots s
  JOIN match_days md ON md.id = s.match_day_id
  WHERE s.kind = 'match_day'
    AND md.sequence < (SELECT sequence FROM match_days WHERE id = p_match_day_id)
  ORDER BY md.sequence DESC
  LIMIT 1;

  INSERT INTO standings_snapshots (match_day_id, kind)
  VALUES (p_match_day_id, 'match_day')
  RETURNING id INTO v_snapshot_id;

  INSERT INTO standings_snapshot_rows (snapshot_id, user_id, rank, points_this_day, total_points, rank_delta)
  WITH day_pts AS (
    SELECT user_id, sum(final_total) AS pts_this_day
    FROM prediction_scores
    WHERE match_day_id = p_match_day_id
    GROUP BY user_id
  ),
  ranked AS (
    SELECT
      pr.id AS user_id,
      pr.total_points,
      COALESCE(d.pts_this_day, 0) AS points_this_day,
      rank() OVER (ORDER BY pr.total_points DESC) AS rnk
    FROM profiles pr
    LEFT JOIN day_pts d ON d.user_id = pr.id
  ),
  prev AS (
    SELECT user_id, rank AS prev_rank
    FROM standings_snapshot_rows
    WHERE snapshot_id = v_prev_id
  )
  SELECT
    v_snapshot_id, r.user_id, r.rnk, r.points_this_day, r.total_points,
    -- positive delta = moved up the table since the last finalize
    COALESCE(prev.prev_rank - r.rnk, 0) AS rank_delta
  FROM ranked r
  LEFT JOIN prev ON prev.user_id = r.user_id;

  UPDATE match_days SET status = 'finalized', finalized_at = now() WHERE id = p_match_day_id;
END;
$$;
--> statement-breakpoint

CREATE OR REPLACE FUNCTION public.unfinalize_match_day(p_match_day_id int)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status   match_day_status;
  v_sequence integer;
BEGIN
  SELECT status, sequence INTO v_status, v_sequence
  FROM match_days WHERE id = p_match_day_id FOR UPDATE;
  IF v_status IS NULL THEN
    RAISE EXCEPTION 'Match day % not found', p_match_day_id;
  END IF;
  IF v_status <> 'finalized' THEN
    RAISE EXCEPTION 'Match day % is not finalized (status: %)', p_match_day_id, v_status;
  END IF;

  -- Match days finalize in sequence order; un-finalize must happen newest-first so
  -- rank_deltas stay coherent. (Ordering by sequence, not wall-clock, is tie-proof.)
  IF EXISTS (
    SELECT 1 FROM match_days
    WHERE status = 'finalized' AND sequence > v_sequence
  ) THEN
    RAISE EXCEPTION 'A later match day is finalized; un-finalize the most recent one first';
  END IF;

  -- Drop this day's snapshot (rows cascade) and its computed scores.
  DELETE FROM standings_snapshots WHERE kind = 'match_day' AND match_day_id = p_match_day_id;
  DELETE FROM prediction_scores WHERE match_day_id = p_match_day_id;

  -- Recompute cumulative totals from what remains.
  UPDATE profiles SET total_points = 0;
  UPDATE profiles pr
  SET total_points = s.pts
  FROM (
    SELECT user_id, sum(final_total) AS pts
    FROM prediction_scores
    GROUP BY user_id
  ) s
  WHERE pr.id = s.user_id;

  UPDATE match_days SET status = 'active', finalized_at = NULL WHERE id = p_match_day_id;
END;
$$;
