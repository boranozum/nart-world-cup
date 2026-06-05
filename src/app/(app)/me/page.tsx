import { Trophy } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { PlayerAvatar } from '@/components/player-avatar';
import { ProfileEditor } from './profile-editor';

/** Supabase returns to-one relations as an object, but can surface arrays — normalize. */
function one<T>(x: T | T[] | null | undefined): T | null {
  if (!x) return null;
  return Array.isArray(x) ? (x[0] ?? null) : x;
}

type ScoreRow = {
  final_total: number;
  booster_applied: boolean;
  match_day_id: number;
  predictions: { score_a: number | null; score_b: number | null } | { score_a: number | null; score_b: number | null }[] | null;
  matches:
    | { id: number; team_a_id: number; team_b_id: number; kickoff_utc: string; match_results: { score_a: number; score_b: number } | { score_a: number; score_b: number }[] | null }
    | null;
  match_days: { name: string; sequence: number } | { name: string; sequence: number }[] | null;
};

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-card px-4 py-3">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-0.5 font-display text-2xl font-bold tabular-nums">{value}</p>
    </div>
  );
}

export default async function MePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from('profiles')
    .select('username, avatar_url, email, total_points')
    .eq('id', user!.id)
    .maybeSingle();

  // Current rank from the most recent standings snapshot.
  const { data: latestSnap } = await supabase
    .from('standings_snapshots')
    .select('id')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  let rank: number | null = null;
  let fieldSize: number | null = null;
  if (latestSnap) {
    const [{ data: myRow }, { count }] = await Promise.all([
      supabase
        .from('standings_snapshot_rows')
        .select('rank')
        .eq('snapshot_id', latestSnap.id)
        .eq('user_id', user!.id)
        .maybeSingle(),
      supabase
        .from('standings_snapshot_rows')
        .select('*', { count: 'exact', head: true })
        .eq('snapshot_id', latestSnap.id),
    ]);
    rank = myRow?.rank ?? null;
    fieldSize = count ?? null;
  }

  // Past predictions with points (only finalized days produce prediction_scores).
  const { data: scoreRowsRaw } = await supabase
    .from('prediction_scores')
    .select(
      'final_total, booster_applied, match_day_id, predictions(score_a, score_b), matches(id, team_a_id, team_b_id, kickoff_utc, match_results(score_a, score_b)), match_days(name, sequence)',
    )
    .eq('user_id', user!.id);
  const scoreRows = (scoreRowsRaw ?? []) as unknown as ScoreRow[];

  // Team names.
  const teamIds = [
    ...new Set(
      scoreRows.flatMap((r) => {
        const m = one(r.matches);
        return m ? [m.team_a_id, m.team_b_id] : [];
      }),
    ),
  ];
  const { data: teamsRaw } = teamIds.length
    ? await supabase.from('teams').select('id, short_name, name').in('id', teamIds)
    : { data: [] };
  const teamMap = new Map<number, string>(
    (teamsRaw ?? []).map((t) => [t.id, t.short_name || t.name]),
  );

  // Group rows by match day, newest first.
  type Group = { name: string; sequence: number; points: number; rows: ScoreRow[] };
  const groups = new Map<number, Group>();
  for (const r of scoreRows) {
    const md = one(r.match_days);
    if (!md) continue;
    const g =
      groups.get(r.match_day_id) ??
      groups.set(r.match_day_id, { name: md.name, sequence: md.sequence, points: 0, rows: [] }).get(r.match_day_id)!;
    g.points += r.final_total;
    g.rows.push(r);
  }
  const orderedGroups = [...groups.values()].sort((a, b) => b.sequence - a.sequence);
  for (const g of orderedGroups) {
    g.rows.sort((a, b) => {
      const ka = one(a.matches)?.kickoff_utc ?? '';
      const kb = one(b.matches)?.kickoff_utc ?? '';
      return ka.localeCompare(kb);
    });
  }

  const displayName = profile?.username?.trim() || profile?.email?.split('@')[0] || 'You';

  return (
    <section className="max-w-2xl">
      <h1 className="font-display text-3xl font-extrabold uppercase tracking-tight">Me</h1>

      {/* Identity + edit */}
      <div className="mt-6 flex items-center gap-4">
        <PlayerAvatar
          name={displayName}
          avatarUrl={profile?.avatar_url}
          className="size-16 text-xl"
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-lg font-semibold">{displayName}</p>
          <p className="truncate text-sm text-muted-foreground">{profile?.email}</p>
        </div>
        <ProfileEditor
          initialUsername={profile?.username ?? ''}
          initialAvatarUrl={profile?.avatar_url ?? null}
        />
      </div>

      {/* Stats */}
      <div className="mt-6 grid grid-cols-3 gap-3">
        <StatTile label="Points" value={String(profile?.total_points ?? 0)} />
        <StatTile label="Rank" value={rank ? `#${rank}${fieldSize ? ` / ${fieldSize}` : ''}` : '—'} />
        <StatTile label="Predictions" value={String(scoreRows.length)} />
      </div>

      {/* Past predictions */}
      <h2 className="mt-10 font-display text-xl font-bold uppercase tracking-tight">
        Past predictions
      </h2>

      {orderedGroups.length === 0 ? (
        <div className="mt-4 grid place-items-center rounded-xl border border-dashed border-border bg-card/50 py-14 text-center">
          <Trophy className="size-7 text-muted-foreground" />
          <p className="mt-3 font-medium">Nothing scored yet</p>
          <p className="text-sm text-muted-foreground">
            Your past picks and points appear once a match day is finalized.
          </p>
        </div>
      ) : (
        <div className="mt-4 space-y-6">
          {orderedGroups.map((g) => (
            <div key={g.name + g.sequence}>
              <div className="mb-2 flex items-baseline justify-between">
                <h3 className="font-semibold">{g.name}</h3>
                <span className="text-sm font-medium text-accent">
                  +{g.points} {g.points === 1 ? 'pt' : 'pts'}
                </span>
              </div>
              <ul className="overflow-hidden rounded-xl border border-border">
                {g.rows.map((r, i) => {
                  const m = one(r.matches);
                  const res = one(m?.match_results);
                  const pred = one(r.predictions);
                  const a = m ? teamMap.get(m.team_a_id) ?? '—' : '—';
                  const b = m ? teamMap.get(m.team_b_id) ?? '—' : '—';
                  return (
                    <li
                      key={m?.id ?? i}
                      className={`flex items-center gap-3 bg-card px-4 py-2.5 text-sm ${
                        i > 0 ? 'border-t border-border' : ''
                      }`}
                    >
                      <div className="flex min-w-0 flex-1 items-center gap-2">
                        <span className="font-medium">{a}</span>
                        <span className="font-display font-bold tabular-nums">
                          {res ? `${res.score_a}–${res.score_b}` : '–'}
                        </span>
                        <span className="font-medium">{b}</span>
                      </div>
                      <span className="text-muted-foreground">
                        your pick{' '}
                        <span className="font-medium text-foreground">
                          {pred && pred.score_a != null && pred.score_b != null
                            ? `${pred.score_a}–${pred.score_b}`
                            : '—'}
                        </span>
                      </span>
                      <span className="flex w-16 items-center justify-end gap-1 font-semibold tabular-nums">
                        {r.booster_applied && (
                          <span className="rounded bg-accent/15 px-1 text-[10px] font-bold text-accent">
                            ×2
                          </span>
                        )}
                        +{r.final_total}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
