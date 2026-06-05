import { Goal } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { PHASE_LABELS, type TournamentPhase } from '@/lib/tournament';
import {
  MatchPredictionCard,
  type CardPrediction,
  type CardTeam,
} from '@/components/picks/match-prediction-card';
import type { FirstScoringTeam } from '@/lib/predictions';

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="mt-8 grid place-items-center rounded-xl border border-dashed border-border bg-card/50 py-20 text-center">
      <Goal className="size-8 text-muted-foreground" />
      <p className="mt-3 font-medium">{title}</p>
      <p className="text-sm text-muted-foreground">{body}</p>
    </div>
  );
}

export default async function PicksPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: matchDay } = await supabase
    .from('match_days')
    .select('id, name, phase')
    .eq('status', 'active')
    .maybeSingle();

  const header = (
    <div>
      <h1 className="font-display text-3xl font-extrabold uppercase tracking-tight">Picks</h1>
      <p className="mt-1 text-muted-foreground">
        {matchDay
          ? `${matchDay.name} · ${PHASE_LABELS[matchDay.phase as TournamentPhase]}`
          : "The active match day's fixtures will live here."}
      </p>
    </div>
  );

  if (!matchDay) {
    return (
      <section>
        {header}
        <EmptyState
          title="No active match day yet"
          body="Predictions open once an admin starts a match day."
        />
      </section>
    );
  }

  const { data: matches } = await supabase
    .from('matches')
    .select('id, team_a_id, team_b_id, kickoff_utc')
    .eq('match_day_id', matchDay.id)
    .order('kickoff_utc', { ascending: true });

  if (!matches || matches.length === 0) {
    return (
      <section>
        {header}
        <EmptyState title="No matches yet" body="The admin hasn't added matches to this match day." />
      </section>
    );
  }

  const teamIds = [...new Set(matches.flatMap((m) => [m.team_a_id, m.team_b_id]))];
  const matchIds = matches.map((m) => m.id);

  const [{ data: teams }, { data: preds }, { data: settings }, { count: boostersUsed }] =
    await Promise.all([
      supabase.from('teams').select('id, name, short_name').in('id', teamIds),
      supabase
        .from('predictions')
        .select('match_id, score_a, score_b, first_scoring_team, first_goal_bucket, booster_applied')
        .eq('user_id', user!.id)
        .in('match_id', matchIds),
      supabase.from('league_settings').select('booster_total').maybeSingle(),
      supabase
        .from('predictions')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user!.id)
        .eq('booster_applied', true),
    ]);

  const teamMap = new Map<number, CardTeam>(
    (teams ?? []).map((t) => [t.id, { id: t.id, name: t.name, shortName: t.short_name }]),
  );
  const predMap = new Map<number, CardPrediction>(
    (preds ?? []).map((p) => [
      p.match_id,
      {
        scoreA: p.score_a,
        scoreB: p.score_b,
        firstScoringTeam: p.first_scoring_team as FirstScoringTeam | null,
        firstGoalBucket: p.first_goal_bucket,
        boosterApplied: p.booster_applied,
      },
    ]),
  );

  const boosterTotal = settings?.booster_total ?? 5;
  const boostersRemaining = Math.max(0, boosterTotal - (boostersUsed ?? 0));

  return (
    <section>
      <div className="flex items-end justify-between gap-3">
        {header}
        <span className="shrink-0 rounded-full bg-accent/15 px-3 py-1.5 text-xs font-semibold text-accent">
          {boostersRemaining}/{boosterTotal} boosters
        </span>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {matches.map((m) => {
          const teamA = teamMap.get(m.team_a_id);
          const teamB = teamMap.get(m.team_b_id);
          if (!teamA || !teamB) return null;
          return (
            <MatchPredictionCard
              key={m.id}
              matchId={m.id}
              kickoffUtc={new Date(m.kickoff_utc).toISOString()}
              teamA={teamA}
              teamB={teamB}
              initial={predMap.get(m.id) ?? null}
              boostersRemaining={boostersRemaining}
            />
          );
        })}
      </div>
    </section>
  );
}
