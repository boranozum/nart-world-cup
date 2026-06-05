'use client';

import { useState, useTransition } from 'react';
import { CheckCircle2, Pencil, X } from 'lucide-react';
import { GOAL_BUCKETS, goalBucketLabel, type GoalBucket } from '@/lib/predictions';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { concludeMatch, reopenMatch } from '../actions';

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

  // Collapsed view: a summary plus the trigger to edit (or just a read-only badge when locked).
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
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>{teamAName}</label>
          <input
            name="scoreA"
            type="number"
            min={0}
            required
            defaultValue={result?.scoreA ?? ''}
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
            defaultValue={result?.scoreB ?? ''}
            className={inputCls}
          />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className={labelCls}>First to score</label>
          <select name="firstScoringTeam" defaultValue={result?.firstScoringTeam ?? 'A'} className={inputCls}>
            <option value="A">{teamAName}</option>
            <option value="B">{teamBName}</option>
            <option value="none">No goals (0–0)</option>
          </select>
        </div>
        <div>
          <label className={labelCls}>First goal minute</label>
          <select name="firstGoalBucket" defaultValue={result?.firstGoalBucket ?? '0-10'} className={inputCls}>
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
        <select name="motmPlayerId" defaultValue={result?.motmPlayerId ?? ''} className={inputCls}>
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
