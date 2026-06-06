'use client';

import { useEffect, useState, useTransition } from 'react';
import Link from 'next/link';
import { Check, Info, Lock, MessageSquare, Zap } from 'lucide-react';
import { savePrediction } from '@/app/(app)/picks-actions';
import { LocalTime } from '@/components/local-time';
import { TeamBadge } from '@/components/team-badge';
import { PlayerSelect, type SelectablePlayer } from '@/components/picks/player-select';
import {
  GOAL_BUCKETS,
  goalBucketLabel,
  lockTimeMs,
  predictionConstraints,
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

function PtsRow({ label, pts }: { label: string; pts: number }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-popover-foreground/70">{label}</span>
      <span className="shrink-0 font-semibold text-accent">+{pts}</span>
    </div>
  );
}

function InfoTooltip({
  children,
  position = 'above',
}: {
  children: React.ReactNode;
  position?: 'above' | 'below';
}) {
  const pop = position === 'above' ? 'bottom-full mb-2' : 'top-full mt-2';
  return (
    <span className="group/tip relative inline-flex items-center">
      <span tabIndex={0} className="cursor-default rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-primary">
        <Info className="size-3 text-muted-foreground/50 transition group-hover/tip:text-muted-foreground group-focus-within/tip:text-muted-foreground" />
      </span>
      <span className={`pointer-events-none absolute left-0 z-20 w-48 rounded-xl border border-border bg-popover px-3 py-2.5 text-xs leading-relaxed opacity-0 shadow-lg transition-opacity duration-150 group-hover/tip:opacity-100 group-focus-within/tip:opacity-100 ${pop}`}>
        {children}
      </span>
    </span>
  );
}

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

  // Logical enforcement: the predicted score constrains which first-scoring-team
  // and first-goal-minute options are possible (0-0 ⇒ "No goal" everywhere; a
  // team that scored zero can't be first; etc.). See predictionConstraints.
  const a = scoreA === '' ? null : parseInt(scoreA, 10);
  const b = scoreB === '' ? null : parseInt(scoreB, 10);
  const constraints = predictionConstraints(a, b);

  // Reconcile selections against a new score so a pick can never contradict the
  // score: force the value the score determines, or clear an impossible one.
  // Done in the change handler (not an effect) since the score is the sole driver.
  function reconcileToScore(nextA: string, nextB: string) {
    const c = predictionConstraints(
      nextA === '' ? null : parseInt(nextA, 10),
      nextB === '' ? null : parseInt(nextB, 10),
    );
    setFirstTeam((prev) =>
      c.forcedFirstTeam ?? (prev && c.firstTeamDisabled[prev] ? '' : prev),
    );
    setBucket((prev) =>
      c.forcedBucket ?? (prev === 'none' && c.bucketNoneDisabled ? '' : prev),
    );
  }

  function changeScoreA(v: string) {
    const next = v.replace(/\D/g, '').slice(0, 2);
    setScoreA(next);
    reconcileToScore(next, scoreB);
  }

  function changeScoreB(v: string) {
    const next = v.replace(/\D/g, '').slice(0, 2);
    setScoreB(next);
    reconcileToScore(scoreA, next);
  }

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
    <div className="rounded-2xl border border-border bg-card">
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
      <div className="px-4 pb-3 pt-4">
        <p className="mb-3 flex items-center gap-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Score
          <InfoTooltip position="below">
            <PtsRow label="Outcome (W/D/L)" pts={3} />
            <PtsRow label="Home goals exact" pts={2} />
            <PtsRow label="Away goals exact" pts={2} />
            <PtsRow label="Goal difference" pts={3} />
            <div className="mt-1.5 border-t border-border/60 pt-1.5">
              <PtsRow label="Max from score" pts={10} />
            </div>
          </InfoTooltip>
        </p>
        <div className="flex items-center justify-center gap-3">
          <span className="flex flex-1 items-center justify-end gap-2 font-display text-lg font-bold uppercase">
            {teamA.name}
            <TeamBadge name={teamA.name} shortName={teamA.shortName} badgeUrl={teamA.badgeUrl} className="size-7" />
          </span>
          <div className="flex items-center gap-2">
            <input
              inputMode="numeric"
              value={scoreA}
              disabled={locked}
              onChange={(e) => changeScoreA(e.target.value)}
              className="score size-12 rounded-lg border border-input bg-background text-center text-2xl outline-none focus:border-primary disabled:opacity-60"
            />
            <span className="text-muted-foreground">:</span>
            <input
              inputMode="numeric"
              value={scoreB}
              disabled={locked}
              onChange={(e) => changeScoreB(e.target.value)}
              className="score size-12 rounded-lg border border-input bg-background text-center text-2xl outline-none focus:border-primary disabled:opacity-60"
            />
          </div>
          <span className="flex flex-1 items-center justify-start gap-2 font-display text-lg font-bold uppercase">
            <TeamBadge name={teamB.name} shortName={teamB.shortName} badgeUrl={teamB.badgeUrl} className="size-7" />
            {teamB.name}
          </span>
        </div>
      </div>

      {/* extras */}
      <div className="space-y-3 px-4 pb-4">
        <div>
          <p className="mb-1.5 flex items-center gap-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            First to score
            <InfoTooltip>
              <PtsRow label="Correct team / No goal" pts={2} />
            </InfoTooltip>
          </p>
          <div className="grid grid-cols-3 gap-2">
            {firstTeamOptions.map((o) => (
              <button
                key={o.value}
                disabled={locked || constraints.firstTeamDisabled[o.value]}
                onClick={() => setFirstTeam(firstTeam === o.value ? '' : o.value)}
                className={`rounded-lg border px-2 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-40 ${
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
          <p className="mb-1.5 flex items-center gap-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            First goal minute
            <InfoTooltip>
              <PtsRow label="Correct 10-min bucket" pts={8} />
              <p className="mt-1.5 border-t border-border/60 pt-1.5 text-popover-foreground/60">
                e.g. "21–30'" means the first goal fell in that window.
              </p>
            </InfoTooltip>
          </p>
          <select
            value={bucket}
            disabled={locked}
            onChange={(e) => setBucket(e.target.value)}
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary disabled:opacity-60"
          >
            <option value="">—</option>
            {GOAL_BUCKETS.map((b) => (
              <option
                key={b}
                value={b}
                disabled={b === 'none' ? constraints.bucketNoneDisabled : constraints.bucketTimeDisabled}
              >
                {goalBucketLabel(b)}
              </option>
            ))}
          </select>
        </div>

        <div>
          <p className="mb-1.5 flex items-center gap-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Man of the match
            <InfoTooltip>
              <PtsRow label="Correct player" pts={4} />
            </InfoTooltip>
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
          <span className="group/tip relative inline-flex items-center">
            <button
              disabled={locked || (!canBoost && !booster)}
              onClick={() => setBooster((v) => !v)}
              className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition disabled:opacity-40 ${
                booster
                  ? 'border-accent bg-accent text-accent-foreground'
                  : 'border-border text-muted-foreground hover:bg-muted'
              }`}
            >
              <Zap className="size-3.5" /> ×2 Booster
            </button>
            <span className="pointer-events-none absolute bottom-full left-0 z-20 mb-2 w-52 rounded-xl border border-border bg-popover px-3 py-2.5 text-xs leading-relaxed opacity-0 shadow-lg transition-opacity duration-150 group-hover/tip:opacity-100">
              <span className="font-semibold text-popover-foreground">Doubles all points</span>{' '}
              <span className="text-popover-foreground/70">earned on this match.</span>
              <br />
              <span className="text-popover-foreground/60">
                {boostersRemaining} booster{boostersRemaining !== 1 ? 's' : ''} remaining.
                Refunded if the match is cancelled.
              </span>
            </span>
          </span>

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
        className="flex items-center justify-center gap-1.5 overflow-hidden rounded-b-2xl border-t border-border py-2.5 text-xs font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground"
      >
        <MessageSquare className="size-3.5" /> Details &amp; comments
      </Link>
    </div>
  );
}
