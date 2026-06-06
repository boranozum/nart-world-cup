'use client';

import { useEffect, useState, useTransition } from 'react';
import Link from 'next/link';
import { Check, Lock, MessageSquare, Zap } from 'lucide-react';
import { savePrediction } from '@/app/(app)/picks-actions';
import { LocalTime } from '@/components/local-time';
import { TeamBadge } from '@/components/team-badge';
import { PlayerSelect, type SelectablePlayer } from '@/components/picks/player-select';
import {
  GOAL_BUCKETS,
  goalBucketLabel,
  lockTimeMs,
  type FirstScoringTeam,
} from '@/lib/predictions';

export type CardTeam = { id: number; name: string; shortName: string | null; badgeUrl?: string | null };
export type CardPrediction = {
  scoreA: number | null;
  scoreB: number | null;
  firstScoringTeam: FirstScoringTeam | null;
  firstGoalBucket: string | null;
  motmPlayerId: number | null;
  boosterApplied: boolean;
};

function shortOf(t: CardTeam) {
  return t.shortName || t.name.slice(0, 3).toUpperCase();
}

export function MatchPredictionCard({
  matchId,
  kickoffUtc,
  teamA,
  teamB,
  players,
  initial,
  boostersRemaining,
}: {
  matchId: number;
  kickoffUtc: string;
  teamA: CardTeam;
  teamB: CardTeam;
  players: SelectablePlayer[];
  initial: CardPrediction | null;
  boostersRemaining: number;
}) {
  const [scoreA, setScoreA] = useState<string>(initial?.scoreA?.toString() ?? '');
  const [scoreB, setScoreB] = useState<string>(initial?.scoreB?.toString() ?? '');
  const [firstTeam, setFirstTeam] = useState<FirstScoringTeam | ''>(
    initial?.firstScoringTeam ?? '',
  );
  const [bucket, setBucket] = useState<string>(initial?.firstGoalBucket ?? '');
  const [motm, setMotm] = useState<number | null>(initial?.motmPlayerId ?? null);
  const [booster, setBooster] = useState<boolean>(initial?.boosterApplied ?? false);
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<'idle' | 'saved' | string>('idle');

  // Live lock state.
  const lockAt = lockTimeMs(kickoffUtc);
  const [now, setNow] = useState<number>(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);
  const locked = now >= lockAt;

  const canBoost = booster || boostersRemaining > 0;

  function save() {
    setStatus('idle');
    startTransition(async () => {
      const res = await savePrediction({
        matchId,
        scoreA: scoreA === '' ? null : Math.max(0, parseInt(scoreA, 10) || 0),
        scoreB: scoreB === '' ? null : Math.max(0, parseInt(scoreB, 10) || 0),
        firstScoringTeam: firstTeam === '' ? null : firstTeam,
        firstGoalBucket: bucket === '' ? null : bucket,
        motmPlayerId: motm,
        boosterApplied: booster,
      });
      setStatus('error' in res ? res.error : 'saved');
    });
  }

  const firstTeamOptions: { value: FirstScoringTeam; label: string }[] = [
    { value: 'A', label: shortOf(teamA) },
    { value: 'B', label: shortOf(teamB) },
    { value: 'none', label: 'No goal' },
  ];

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card">
      {/* header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-2.5 text-xs">
        <span className="text-muted-foreground">
          <LocalTime iso={kickoffUtc} />
        </span>
        {locked ? (
          <span className="flex items-center gap-1 font-semibold text-muted-foreground">
            <Lock className="size-3.5" /> Locked
          </span>
        ) : (
          <span className="font-medium text-success">Open</span>
        )}
      </div>

      {/* teams + score */}
      <div className="flex items-center justify-center gap-3 px-4 py-5">
        <span className="flex flex-1 items-center justify-end gap-2 font-display text-lg font-bold uppercase">
          {teamA.name}
          <TeamBadge name={teamA.name} shortName={teamA.shortName} badgeUrl={teamA.badgeUrl} className="size-7" />
        </span>
        <div className="flex items-center gap-2">
          <input
            inputMode="numeric"
            value={scoreA}
            disabled={locked}
            onChange={(e) => setScoreA(e.target.value.replace(/\D/g, '').slice(0, 2))}
            className="score size-12 rounded-lg border border-input bg-background text-center text-2xl outline-none focus:border-primary disabled:opacity-60"
          />
          <span className="text-muted-foreground">:</span>
          <input
            inputMode="numeric"
            value={scoreB}
            disabled={locked}
            onChange={(e) => setScoreB(e.target.value.replace(/\D/g, '').slice(0, 2))}
            className="score size-12 rounded-lg border border-input bg-background text-center text-2xl outline-none focus:border-primary disabled:opacity-60"
          />
        </div>
        <span className="flex flex-1 items-center justify-start gap-2 font-display text-lg font-bold uppercase">
          <TeamBadge name={teamB.name} shortName={teamB.shortName} badgeUrl={teamB.badgeUrl} className="size-7" />
          {teamB.name}
        </span>
      </div>

      {/* extras */}
      <div className="space-y-3 px-4 pb-4">
        <div>
          <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            First to score
          </p>
          <div className="grid grid-cols-3 gap-2">
            {firstTeamOptions.map((o) => (
              <button
                key={o.value}
                disabled={locked}
                onClick={() => setFirstTeam(firstTeam === o.value ? '' : o.value)}
                className={`rounded-lg border px-2 py-2 text-sm font-medium transition disabled:opacity-60 ${
                  firstTeam === o.value
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border hover:bg-muted'
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            First goal minute
          </p>
          <select
            value={bucket}
            disabled={locked}
            onChange={(e) => setBucket(e.target.value)}
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary disabled:opacity-60"
          >
            <option value="">—</option>
            {GOAL_BUCKETS.map((b) => (
              <option key={b} value={b}>
                {goalBucketLabel(b)}
              </option>
            ))}
          </select>
        </div>

        <div>
          <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Man of the match
          </p>
          {players.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border px-3 py-2 text-xs text-muted-foreground">
              No players listed for these teams yet.
            </p>
          ) : (
            <PlayerSelect players={players} value={motm} onChange={setMotm} disabled={locked} />
          )}
        </div>

        <div className="flex items-center justify-between gap-3 pt-1">
          <button
            disabled={locked || (!canBoost && !booster)}
            onClick={() => setBooster((v) => !v)}
            className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition disabled:opacity-40 ${
              booster
                ? 'border-accent bg-accent text-accent-foreground'
                : 'border-border text-muted-foreground hover:bg-muted'
            }`}
            title={canBoost ? 'Double your points on this match' : 'No boosters left'}
          >
            <Zap className="size-3.5" /> ×2 Booster
          </button>

          <div className="flex items-center gap-3">
            {status === 'saved' && (
              <span className="flex items-center gap-1 text-xs font-medium text-success">
                <Check className="size-3.5" /> Saved
              </span>
            )}
            {status !== 'idle' && status !== 'saved' && (
              <span className="text-xs text-danger">{status}</span>
            )}
            <button
              disabled={locked || pending}
              onClick={save}
              className="rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground transition hover:brightness-110 disabled:opacity-50"
            >
              {pending ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      </div>

      <Link
        href={`/match/${matchId}`}
        className="flex items-center justify-center gap-1.5 border-t border-border py-2.5 text-xs font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground"
      >
        <MessageSquare className="size-3.5" /> Details &amp; comments
      </Link>
    </div>
  );
}
