import Link from 'next/link';
import { redirect } from 'next/navigation';
import { CalendarDays } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { TeamBadge } from '@/components/team-badge';
import { LocalTime } from '@/components/local-time';
import { PHASE_LABELS, type TournamentPhase } from '@/lib/tournament';

const MATCH_STATUS_LABEL: Record<string, string> = {
  scheduled: 'Upcoming',
  locked: 'Locked',
  live: 'Live',
  concluded: 'Final',
  cancelled: 'Cancelled',
};

const MATCH_STATUS_CLS: Record<string, string> = {
  live: 'text-success font-semibold',
  concluded: 'text-muted-foreground',
  cancelled: 'text-muted-foreground/60 line-through',
  locked: 'text-accent',
  scheduled: 'text-muted-foreground',
};

export default async function MatchDaysPage({
  searchParams,
}: {
  searchParams: Promise<{ day?: string }>;
}) {
  const { day: dayParam } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: matchDays } = await supabase
    .from('match_days')
    .select('id, name, phase, status, sequence')
    .in('status', ['active', 'finalized'])
    .order('sequence', { ascending: true });

  const header = (
    <div>
      <h1 className="font-display text-3xl font-extrabold uppercase tracking-tight">Match Days</h1>
      <p className="mt-1 text-muted-foreground">Browse every match day, results, and predictions.</p>
    </div>
  );

  if (!matchDays || matchDays.length === 0) {
    return (
      <section>
        {header}
        <div className="mt-8 grid place-items-center rounded-xl border border-dashed border-border bg-card/50 py-20 text-center">
          <CalendarDays className="size-8 text-muted-foreground" />
          <p className="mt-3 font-medium">No match days yet</p>
          <p className="text-sm text-muted-foreground">
            Match days appear here once an admin activates them.
          </p>
        </div>
      </section>
    );
  }

  const activeDay = matchDays.find((d) => d.status === 'active');
  const selectedId = dayParam
    ? Number(dayParam)
    : (activeDay?.id ?? matchDays[matchDays.length - 1].id);
  const selected =
    matchDays.find((d) => d.id === selectedId) ?? matchDays[matchDays.length - 1];

  const { data: matches } = await supabase
    .from('matches')
    .select('id, team_a_id, team_b_id, kickoff_utc, status')
    .eq('match_day_id', selected.id)
    .order('kickoff_utc', { ascending: true });

  const teamIds = [...new Set((matches ?? []).flatMap((m) => [m.team_a_id, m.team_b_id]))];
  const matchIds = (matches ?? []).map((m) => m.id);

  const [{ data: teams }, { data: results }] = await Promise.all([
    teamIds.length
      ? supabase.from('teams').select('id, name, short_name, badge_url').in('id', teamIds)
      : { data: [] as { id: number; name: string; short_name: string | null; badge_url: string | null }[] },
    matchIds.length
      ? supabase
          .from('match_results')
          .select('match_id, score_a, score_b')
          .in('match_id', matchIds)
      : { data: [] as { match_id: number; score_a: number; score_b: number }[] },
  ]);

  const teamMap = new Map((teams ?? []).map((t) => [t.id, t]));
  const resultMap = new Map((results ?? []).map((r) => [r.match_id, r]));

  return (
    <section>
      {header}

      {/* Match day selector */}
      <div className="-mx-4 mt-6 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
        {matchDays.map((d) => {
          const isSel = d.id === selected.id;
          return (
            <Link
              key={d.id}
              href={`/match-days?day=${d.id}`}
              scroll={false}
              className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
                isSel
                  ? 'bg-primary text-primary-foreground'
                  : 'border border-border text-muted-foreground hover:bg-muted'
              }`}
            >
              {d.name}
              {d.status === 'active' && (
                <span className="ml-1.5 inline-block size-1.5 translate-y-[-1px] rounded-full bg-success align-middle" />
              )}
            </Link>
          );
        })}
      </div>

      <p className="mt-3 text-xs text-muted-foreground">
        {PHASE_LABELS[selected.phase as TournamentPhase]}
        {' · '}
        {selected.status === 'active' ? (
          <span className="font-medium text-success">In progress</span>
        ) : (
          <span className="font-medium text-foreground">Finalized</span>
        )}
      </p>

      {!matches || matches.length === 0 ? (
        <p className="mt-6 text-sm text-muted-foreground">No matches scheduled for this match day.</p>
      ) : (
        <div className="mt-4 space-y-2">
          {matches.map((m) => {
            const teamA = teamMap.get(m.team_a_id);
            const teamB = teamMap.get(m.team_b_id);
            const result = resultMap.get(m.id);
            return (
              <Link
                key={m.id}
                href={`/match/${m.id}`}
                className="group flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-3 transition hover:border-primary/30 hover:bg-muted/40 sm:gap-4"
              >
                {/* Team A */}
                <span className="flex flex-1 items-center justify-end gap-2 overflow-hidden">
                  <span className="truncate font-display text-sm font-bold uppercase sm:text-base">
                    {teamA?.short_name || teamA?.name}
                  </span>
                  <TeamBadge
                    name={teamA?.name ?? ''}
                    shortName={teamA?.short_name}
                    badgeUrl={teamA?.badge_url}
                    className="size-8 shrink-0"
                  />
                </span>

                {/* Score / vs */}
                <span className="w-14 shrink-0 text-center font-display text-xl font-extrabold tabular-nums">
                  {result != null ? `${result.score_a}:${result.score_b}` : 'vs'}
                </span>

                {/* Team B */}
                <span className="flex flex-1 items-center justify-start gap-2 overflow-hidden">
                  <TeamBadge
                    name={teamB?.name ?? ''}
                    shortName={teamB?.short_name}
                    badgeUrl={teamB?.badge_url}
                    className="size-8 shrink-0"
                  />
                  <span className="truncate font-display text-sm font-bold uppercase sm:text-base">
                    {teamB?.short_name || teamB?.name}
                  </span>
                </span>

                {/* Status + kickoff (hidden on smallest screens) */}
                <div className="hidden shrink-0 text-right sm:block">
                  <p className={`text-xs ${MATCH_STATUS_CLS[m.status] ?? 'text-muted-foreground'}`}>
                    {MATCH_STATUS_LABEL[m.status] ?? m.status}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    <LocalTime iso={new Date(m.kickoff_utc).toISOString()} />
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      <p className="mt-5 text-center text-xs text-muted-foreground">
        Tap a match to see predictions and comments.
      </p>
    </section>
  );
}
