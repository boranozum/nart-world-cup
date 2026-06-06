'use client';

import { useState, useTransition } from 'react';
import { CheckCircle2, Download, Pencil, X } from 'lucide-react';
import { GOAL_BUCKETS, goalBucketLabel, type GoalBucket } from '@/lib/predictions';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { concludeMatch, fetchMatchResultFromApi, reopenMatch } from '../actions';

export type ResultPlayer = { id: number; name: string; side: 'A' | 'B' };

export type ExistingResult = {
  scoreA: number;
  scoreB: number;
  firstScoringTeam: 'A' | 'B' | 'none';
  firstGoalBucket: GoalBucket;
  motmPlayerId: number | null;
};

type Props = {
  matchId: number;
  matchDayId: number;
  teamAName: string;
  teamBName: string;
  players: ResultPlayer[];
  result: ExistingResult | null;
  /** When the match day is finalized, results are read-only until it's un-finalized. */
  locked: boolean;
};

const inputCls =
  'w-full rounded-lg border border-input bg-background px-3 py-2 outline-none focus:border-primary';
const labelCls =
  'mb-1 block text-xs font-medium uppercase tracking-wide text-muted-foreground';

export function ConcludeMatchForm({
  matchId,
  matchDayId,
  teamAName,
  teamBName,
  players,
  result,
  locked,
}: Props) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmingClear, setConfirmingClear] = useState(false);
  const [pending, startTransition] = useTransition();
  const [pulling, startPullTransition] = useTransition();
  const [pullError, setPullError] = useState<string | null>(null);

  // Controlled state for all result fields so the API pull can pre-fill them.
  const [scoreA, setScoreA] = useState(result?.scoreA?.toString() ?? '');
  const [scoreB, setScoreB] = useState(result?.scoreB?.toString() ?? '');
  const [firstScoringTeam, setFirstScoringTeam] = useState<'A' | 'B' | 'none'>(
    result?.firstScoringTeam ?? 'A',
  );
  const [firstGoalBucket, setFirstGoalBucket] = useState<GoalBucket>(
    result?.firstGoalBucket ?? '0-10',
  );
  const [motmPlayerId, setMotmPlayerId] = useState<string>(
    result?.motmPlayerId?.toString() ?? '',
  );

  function pullFromApi() {
    setPullError(null);
    startPullTransition(async () => {
      const res = await fetchMatchResultFromApi(matchId);
      if ('error' in res) {
        setPullError(res.error);
        return;
      }
      setScoreA(String(res.scoreA));
      setScoreB(String(res.scoreB));
      setFirstScoringTeam(res.firstScoringTeam);
      setFirstGoalBucket(res.firstGoalBucket);
    });
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    fd.set('matchId', String(matchId));
    fd.set('matchDayId', String(matchDayId));
    startTransition(async () => {
      const res = await concludeMatch(fd);
      if (res?.error) setError(res.error);
      else setOpen(false);
    });
  }

  function onReopen() {
    setError(null);
    const fd = new FormData();
    fd.set('matchId', String(matchId));
    fd.set('matchDayId', String(matchDayId));
    startTransition(async () => {
      const res = await reopenMatch(fd);
      if (res?.error) setError(res.error);
      else setConfirmingClear(false);
    });
  }

  if (!open) {
    return (
      <div className="flex items-center gap-2">
        {result ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-success/15 px-2.5 py-1 text-xs font-semibold text-success">
            <CheckCircle2 className="size-3.5" />
            {result.scoreA}–{result.scoreB}
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">No result</span>
        )}
        {!locked && (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-xs font-medium transition hover:bg-muted"
          >
            <Pencil className="size-3" />
            {result ? 'Edit result' : 'Conclude'}
          </button>
        )}
        {error && <span className="text-[11px] text-danger">{error}</span>}
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="mt-2 grid gap-3 rounded-lg border border-border bg-background/60 p-4">
      {/* Pull from API */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          disabled={pulling}
          onClick={pullFromApi}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium transition hover:bg-muted disabled:opacity-60"
        >
          <Download className="size-3.5" />
          {pulling ? 'Pulling…' : 'Pull from API'}
        </button>
        {pullError && <span className="text-xs text-danger">{pullError}</span>}
        {!pullError && !pulling && (
          <span className="text-xs text-muted-foreground">
            Pre-fills score, first scorer &amp; minute. MOTM must be entered manually.
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>{teamAName}</label>
          <input
            name="scoreA"
            type="number"
            min={0}
            required
            value={scoreA}
            onChange={(e) => setScoreA(e.target.value)}
            className={inputCls}
          />
        </div>
        <div>
          <label className={labelCls}>{teamBName}</label>
          <input
            name="scoreB"
            type="number"
            min={0}
            required
            value={scoreB}
            onChange={(e) => setScoreB(e.target.value)}
            className={inputCls}
          />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className={labelCls}>First to score</label>
          <select
            name="firstScoringTeam"
            value={firstScoringTeam}
            onChange={(e) => setFirstScoringTeam(e.target.value as 'A' | 'B' | 'none')}
            className={inputCls}
          >
            <option value="A">{teamAName}</option>
            <option value="B">{teamBName}</option>
            <option value="none">No goals (0–0)</option>
          </select>
        </div>
        <div>
          <label className={labelCls}>First goal minute</label>
          <select
            name="firstGoalBucket"
            value={firstGoalBucket}
            onChange={(e) => setFirstGoalBucket(e.target.value as GoalBucket)}
            className={inputCls}
          >
            {GOAL_BUCKETS.map((b) => (
              <option key={b} value={b}>
                {goalBucketLabel(b)}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className={labelCls}>Man of the match (optional)</label>
        <select
          name="motmPlayerId"
          value={motmPlayerId}
          onChange={(e) => setMotmPlayerId(e.target.value)}
          className={inputCls}
        >
          <option value="">— none —</option>
          {players.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} ({p.side === 'A' ? teamAName : teamBName})
            </option>
          ))}
        </select>
        {players.length === 0 && (
          <p className="mt-1 text-[11px] text-muted-foreground">
            No players recorded for these teams yet.
          </p>
        )}
      </div>

      {error && <p className="text-sm text-danger">{error}</p>}

      <div className="flex items-center gap-2">
        <button
          disabled={pending}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:brightness-110 disabled:opacity-60"
        >
          {pending ? 'Saving…' : 'Save result'}
        </button>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setError(null);
          }}
          className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-2 text-sm font-medium transition hover:bg-muted"
        >
          <X className="size-3.5" /> Cancel
        </button>
        {result && (
          <button
            type="button"
            disabled={pending}
            onClick={() => setConfirmingClear(true)}
            className="ml-auto rounded-lg px-3 py-2 text-sm font-medium text-danger transition hover:bg-danger/10 disabled:opacity-60"
          >
            Clear result
          </button>
        )}
      </div>

      <ConfirmDialog
        open={confirmingClear}
        title="Clear result"
        message="Remove the recorded result and reopen this match? Any computed points rely on it being concluded."
        confirmLabel="Clear result"
        busyLabel="Clearing…"
        busy={pending}
        onConfirm={onReopen}
        onCancel={() => setConfirmingClear(false)}
      />
    </form>
  );
}
