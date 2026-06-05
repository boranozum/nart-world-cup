import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ArrowLeft, Lock, Zap } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { PlayerAvatar } from '@/components/player-avatar';
import { LocalTime } from '@/components/local-time';
import { goalBucketLabel, type GoalBucket } from '@/lib/predictions';
import { CommentThread, type ThreadComment } from './comment-thread';

function one<T>(x: T | T[] | null | undefined): T | null {
  if (!x) return null;
  return Array.isArray(x) ? (x[0] ?? null) : x;
}

type Pred = {
  user_id: string;
  score_a: number | null;
  score_b: number | null;
  first_scoring_team: 'A' | 'B' | 'none' | null;
  first_goal_bucket: string | null;
  motm_player_id: number | null;
  booster_applied: boolean;
};

export default async function MatchDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: idParam } = await params;
  const id = Number(idParam);
  if (!Number.isFinite(id)) notFound();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: match } = await supabase
    .from('matches')
    .select('id, team_a_id, team_b_id, kickoff_utc, status')
    .eq('id', id)
    .maybeSingle();
  if (!match) notFound();

  const kickoffMs = new Date(match.kickoff_utc).getTime();
  // eslint-disable-next-line react-hooks/purity -- a server render legitimately reads the current time
  const started = kickoffMs <= Date.now() || ['live', 'concluded'].includes(match.status);

  const [{ data: teams }, { data: result }, { data: allPredsRaw }, { data: myScore }] =
    await Promise.all([
      supabase.from('teams').select('id, name, short_name').in('id', [match.team_a_id, match.team_b_id]),
      supabase
        .from('match_results')
        .select('score_a, score_b, first_scoring_team, first_goal_bucket, motm_player_id')
        .eq('match_id', id)
        .maybeSingle(),
      // RLS returns only your own row before kickoff, everyone's after.
      supabase
        .from('predictions')
        .select('user_id, score_a, score_b, first_scoring_team, first_goal_bucket, motm_player_id, booster_applied, profiles(username, avatar_url, email)')
        .eq('match_id', id),
      supabase
        .from('prediction_scores')
        .select('outcome_pts, home_goals_pts, away_goals_pts, goal_diff_pts, first_team_pts, first_minute_pts, motm_pts, base_total, booster_applied, final_total')
        .eq('match_id', id)
        .eq('user_id', user.id)
        .maybeSingle(),
    ]);

  const teamMap = new Map((teams ?? []).map((t) => [t.id, t]));
  const teamA = teamMap.get(match.team_a_id);
  const teamB = teamMap.get(match.team_b_id);
  const shortA = teamA?.short_name || teamA?.name || 'A';
  const shortB = teamB?.short_name || teamB?.name || 'B';

  const allPreds = (allPredsRaw ?? []) as unknown as (Pred & {
    profiles: { username: string | null; avatar_url: string | null; email: string } | { username: string | null; avatar_url: string | null; email: string }[] | null;
  })[];
  const myPred = allPreds.find((p) => p.user_id === user.id) ?? null;
  const others = allPreds.filter((p) => p.user_id !== user.id);

  // Players (for MOTM names).
  const motmIds = [
    ...new Set([result?.motm_player_id, ...allPreds.map((p) => p.motm_player_id)].filter(Boolean)),
  ] as number[];
  const { data: players } = motmIds.length
    ? await supabase.from('players').select('id, name').in('id', motmIds)
    : { data: [] };
  const playerMap = new Map((players ?? []).map((p) => [p.id, p.name]));

  // Popular scorelines (post-kickoff).
  const withScores = allPreds.filter((p) => p.score_a != null && p.score_b != null);
  const tally = new Map<string, number>();
  for (const p of withScores) {
    const key = `${p.score_a}-${p.score_b}`;
    tally.set(key, (tally.get(key) ?? 0) + 1);
  }
  const popular = [...tally.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([key, n]) => ({ key, n, pct: Math.round((n / withScores.length) * 100) }));

  // Comments.
  const { data: commentsRaw } = await supabase
    .from('comments')
    .select('id, user_id, parent_id, body, created_at, updated_at, deleted_at, profiles(username, avatar_url, email)')
    .eq('match_id', id)
    .order('created_at', { ascending: true });
  const commentIds = (commentsRaw ?? []).map((c) => c.id);
  const { data: likes } = commentIds.length
    ? await supabase.from('comment_likes').select('comment_id, user_id').in('comment_id', commentIds)
    : { data: [] };
  const likeCount = new Map<string, number>();
  const likedByMe = new Set<string>();
  for (const l of likes ?? []) {
    likeCount.set(l.comment_id, (likeCount.get(l.comment_id) ?? 0) + 1);
    if (l.user_id === user.id) likedByMe.add(l.comment_id);
  }
  const authorName = (p: { username: string | null; email: string } | null) =>
    p?.username?.trim() || p?.email?.split('@')[0] || 'Player';
  const comments: ThreadComment[] = (commentsRaw ?? []).map((c) => {
    const prof = one(c.profiles) as { username: string | null; avatar_url: string | null; email: string } | null;
    return {
      id: c.id,
      userId: c.user_id,
      parentId: c.parent_id,
      body: c.body,
      createdAt: new Date(c.created_at).toISOString(),
      updatedAt: new Date(c.updated_at).toISOString(),
      deletedAt: c.deleted_at ? new Date(c.deleted_at).toISOString() : null,
      authorName: authorName(prof),
      authorAvatar: prof?.avatar_url ?? null,
      likeCount: likeCount.get(c.id) ?? 0,
      likedByMe: likedByMe.has(c.id),
    };
  });

  const firstTeamLabel = (v: 'A' | 'B' | 'none' | null) =>
    v === 'A' ? shortA : v === 'B' ? shortB : v === 'none' ? 'No goal' : '—';

  const predLine = (p: Pred) => (
    <span className="text-muted-foreground">
      <span className="font-display text-base font-bold tabular-nums text-foreground">
        {p.score_a != null && p.score_b != null ? `${p.score_a}–${p.score_b}` : '—'}
      </span>
      {' · 1st: '}
      <span className="text-foreground">{firstTeamLabel(p.first_scoring_team)}</span>
      {' · '}
      <span className="text-foreground">
        {p.first_goal_bucket ? goalBucketLabel(p.first_goal_bucket as GoalBucket) : '—'}
      </span>
      {p.motm_player_id && (
        <>
          {' · MOTM: '}
          <span className="text-foreground">{playerMap.get(p.motm_player_id) ?? '—'}</span>
        </>
      )}
    </span>
  );

  const breakdown = myScore
    ? ([
        ['Outcome', myScore.outcome_pts],
        ['Home goals', myScore.home_goals_pts],
        ['Away goals', myScore.away_goals_pts],
        ['Goal difference', myScore.goal_diff_pts],
        ['First scorer', myScore.first_team_pts],
        ['First-goal minute', myScore.first_minute_pts],
        ['Man of the match', myScore.motm_pts],
      ] as const)
    : null;

  return (
    <section className="max-w-2xl">
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Back
      </Link>

      {/* Scoreboard */}
      <div className="mt-4 overflow-hidden rounded-2xl border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border px-4 py-2 text-xs">
          <span className="text-muted-foreground">
            <LocalTime iso={new Date(match.kickoff_utc).toISOString()} />
          </span>
          <span className="font-semibold uppercase text-muted-foreground">{match.status}</span>
        </div>
        <div className="flex items-center justify-center gap-4 px-4 py-6">
          <span className="flex-1 text-right font-display text-xl font-bold uppercase">
            {teamA?.name}
          </span>
          <span className="font-display text-3xl font-extrabold tabular-nums">
            {result ? `${result.score_a} : ${result.score_b}` : 'vs'}
          </span>
          <span className="flex-1 text-left font-display text-xl font-bold uppercase">
            {teamB?.name}
          </span>
        </div>
        {result && (
          <div className="border-t border-border px-4 py-2 text-center text-xs text-muted-foreground">
            1st goal: <span className="text-foreground">{firstTeamLabel(result.first_scoring_team)}</span>
            {' · '}
            {goalBucketLabel(result.first_goal_bucket as GoalBucket)}
            {result.motm_player_id && (
              <> · MOTM: <span className="text-foreground">{playerMap.get(result.motm_player_id) ?? '—'}</span></>
            )}
          </div>
        )}
      </div>

      {/* Your prediction + breakdown */}
      <div className="mt-6 rounded-xl border border-border bg-card p-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Your prediction</h2>
          {myPred?.booster_applied && (
            <span className="inline-flex items-center gap-1 rounded-full bg-accent/15 px-2 py-0.5 text-xs font-semibold text-accent">
              <Zap className="size-3" /> ×2
            </span>
          )}
        </div>
        <div className="mt-2 text-sm">
          {myPred ? predLine(myPred) : <span className="text-muted-foreground">You didn’t predict this match.</span>}
        </div>

        {breakdown && (
          <div className="mt-4 border-t border-border pt-3">
            <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
              {breakdown.map(([label, pts]) => (
                <div key={label} className="flex justify-between">
                  <span className="text-muted-foreground">{label}</span>
                  <span className={pts > 0 ? 'font-medium text-success' : 'text-muted-foreground'}>
                    +{pts}
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-2 flex justify-between border-t border-border pt-2 text-sm font-semibold">
              <span>Total{myScore!.booster_applied ? ' (×2 booster)' : ''}</span>
              <span className="text-accent">+{myScore!.final_total}</span>
            </div>
          </div>
        )}
      </div>

      {/* Post-kickoff: others + popular picks */}
      {started ? (
        <>
          {popular.length > 0 && (
            <div className="mt-6">
              <h2 className="font-display text-lg font-bold uppercase tracking-tight">Popular scorelines</h2>
              <div className="mt-3 space-y-2">
                {popular.map((p) => (
                  <div key={p.key} className="flex items-center gap-3">
                    <span className="w-12 font-display font-bold tabular-nums">{p.key.replace('-', '–')}</span>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full bg-accent" style={{ width: `${p.pct}%` }} />
                    </div>
                    <span className="w-10 text-right text-sm text-muted-foreground">{p.pct}%</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="mt-6">
            <h2 className="font-display text-lg font-bold uppercase tracking-tight">
              Everyone’s picks
            </h2>
            {others.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">No other predictions for this match.</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {others.map((p) => {
                  const prof = one(p.profiles);
                  return (
                    <li key={p.user_id} className="flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-2">
                      <PlayerAvatar name={authorName(prof)} avatarUrl={prof?.avatar_url} className="size-7 text-[10px]" />
                      <Link href={`/u/${p.user_id}`} className="w-28 shrink-0 truncate text-sm font-medium hover:underline">
                        {authorName(prof)}
                      </Link>
                      <span className="min-w-0 flex-1 truncate text-xs">
                        {predLine(p)}
                      </span>
                      {p.booster_applied && <Zap className="size-3.5 shrink-0 text-accent" />}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </>
      ) : (
        <div className="mt-6 flex items-center gap-2 rounded-xl border border-dashed border-border bg-card/50 px-4 py-3 text-sm text-muted-foreground">
          <Lock className="size-4" /> Everyone’s picks and popular scorelines unlock at kickoff.
        </div>
      )}

      {/* Comments */}
      <div className="mt-10">
        <CommentThread
          matchId={id}
          currentUserId={user.id}
          comments={comments}
          predictionsSecret={!started}
        />
      </div>
    </section>
  );
}
