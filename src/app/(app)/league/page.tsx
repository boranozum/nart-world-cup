import Link from 'next/link';
import { ArrowDown, ArrowUp, Minus, Trophy } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { PlayerAvatar } from '@/components/player-avatar';
import { LocalTime } from '@/components/local-time';

type SnapshotRow = {
  user_id: string;
  rank: number;
  points_this_day: number;
  total_points: number;
  rank_delta: number;
  profiles: { username: string | null; avatar_url: string | null; email: string } | null;
};

function displayName(p: SnapshotRow['profiles']): string {
  if (!p) return 'Player';
  return p.username?.trim() || p.email.split('@')[0];
}

function RankDelta({ delta }: { delta: number }) {
  if (delta > 0) {
    return (
      <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-success">
        <ArrowUp className="size-3" />
        {delta}
      </span>
    );
  }
  if (delta < 0) {
    return (
      <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-danger">
        <ArrowDown className="size-3" />
        {-delta}
      </span>
    );
  }
  return <Minus className="size-3 text-muted-foreground/60" aria-label="No change" />;
}

function rankBadgeCls(rank: number): string {
  if (rank === 1) return 'bg-accent text-accent-foreground';
  if (rank <= 3) return 'bg-accent/15 text-accent';
  return 'bg-muted text-muted-foreground';
}

export default async function LeaguePage({
  searchParams,
}: {
  searchParams: Promise<{ snapshot?: string }>;
}) {
  const { snapshot: snapshotParam } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: snapshots }, { data: settings }] = await Promise.all([
    supabase
      .from('standings_snapshots')
      .select('id, kind, created_at, match_day_id, match_days(name, sequence)')
      .order('created_at', { ascending: true }),
    supabase.from('league_settings').select('status').maybeSingle(),
  ]);

  const header = (
    <div>
      <h1 className="font-display text-3xl font-extrabold uppercase tracking-tight">League</h1>
      <p className="mt-1 text-muted-foreground">The company-wide standings.</p>
    </div>
  );

  if (!snapshots || snapshots.length === 0) {
    return (
      <section>
        {header}
        <div className="mt-8 grid place-items-center rounded-xl border border-dashed border-border bg-card/50 py-20 text-center">
          <Trophy className="size-8 text-muted-foreground" />
          <p className="mt-3 font-medium">No standings yet</p>
          <p className="text-sm text-muted-foreground">
            The table appears once the first match day is finalized.
          </p>
        </div>
      </section>
    );
  }

  // Default to the most recent snapshot; allow viewing any past one via ?snapshot=.
  const selected = snapshots.find((s) => s.id === snapshotParam) ?? snapshots[snapshots.length - 1];
  const leagueOver = settings?.status === 'finalized';

  const { data: rowsRaw } = await supabase
    .from('standings_snapshot_rows')
    .select('user_id, rank, points_this_day, total_points, rank_delta, profiles(username, avatar_url, email)')
    .eq('snapshot_id', selected.id)
    .order('rank', { ascending: true });
  const rows = (rowsRaw ?? []) as unknown as SnapshotRow[];

  const snapshotLabel = (s: (typeof snapshots)[number]) => {
    if (s.kind === 'league_final') return 'Final';
    const md = Array.isArray(s.match_days) ? s.match_days[0] : s.match_days;
    return md?.name ?? 'Match day';
  };

  return (
    <section>
      {header}

      {leagueOver && (
        <div className="mt-6 flex items-center gap-3 rounded-xl border border-accent/30 bg-accent/10 p-4">
          <Trophy className="size-5 shrink-0 text-accent" />
          <div>
            <p className="font-semibold">The league is over</p>
            <p className="text-sm text-muted-foreground">
              {rows[0] ? `${displayName(rows[0].profiles)} takes the crown.` : 'Final standings below.'}
            </p>
          </div>
        </div>
      )}

      {/* Match-day history selector */}
      {snapshots.length > 1 && (
        <div className="mt-6 -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
          {snapshots.map((s) => {
            const active = s.id === selected.id;
            return (
              <Link
                key={s.id}
                href={`/league?snapshot=${s.id}`}
                scroll={false}
                className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
                  active
                    ? 'bg-primary text-primary-foreground'
                    : 'border border-border text-muted-foreground hover:bg-muted'
                }`}
              >
                {snapshotLabel(s)}
              </Link>
            );
          })}
        </div>
      )}

      <p className="mt-4 text-xs text-muted-foreground">
        Standings after <span className="font-medium text-foreground">{snapshotLabel(selected)}</span> ·{' '}
        <LocalTime iso={new Date(selected.created_at).toISOString()} />
      </p>

      <ol className="mt-3 overflow-hidden rounded-xl border border-border">
        {rows.map((r) => {
          const isMe = r.user_id === user?.id;
          return (
            <li
              key={r.user_id}
              className={`flex items-center gap-3 px-3 py-2.5 sm:px-4 ${
                isMe ? 'bg-accent/5 ring-1 ring-inset ring-accent/30' : 'bg-card'
              } ${r.rank > 1 ? 'border-t border-border' : ''}`}
            >
              <span
                className={`grid size-7 shrink-0 place-items-center rounded-full font-display text-sm font-bold ${rankBadgeCls(
                  r.rank,
                )}`}
              >
                {r.rank}
              </span>
              <Link
                href={isMe ? '/me' : `/u/${r.user_id}`}
                className="group flex min-w-0 flex-1 items-center gap-3"
              >
                <PlayerAvatar
                  name={displayName(r.profiles)}
                  avatarUrl={r.profiles?.avatar_url}
                  className="size-8 text-xs"
                />
                <p className="truncate font-medium group-hover:underline">
                  {displayName(r.profiles)}
                  {isMe && <span className="ml-1.5 text-xs text-accent">You</span>}
                </p>
              </Link>
              {r.points_this_day > 0 && (
                <span className="hidden text-xs font-medium text-accent sm:inline">
                  +{r.points_this_day}
                </span>
              )}
              <RankDelta delta={r.rank_delta} />
              <span className="w-14 text-right font-display text-lg font-bold tabular-nums">
                {r.total_points}
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
