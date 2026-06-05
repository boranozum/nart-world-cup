'use client';

import { useState, useTransition } from 'react';
import { Lock, Unlock } from 'lucide-react';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { finalizeMatchDay, unfinalizeMatchDay } from '../actions';

type Props = {
  id: number;
  status: 'draft' | 'active' | 'finalized';
  /** True only when the day is active and every non-cancelled match has a result. */
  canFinalize: boolean;
};

export function FinalizeControls({ id, status, canFinalize }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<'finalize' | 'unfinalize' | null>(null);
  const [pending, startTransition] = useTransition();

  function run(action: (fd: FormData) => Promise<{ error: string } | void>) {
    setError(null);
    const fd = new FormData();
    fd.set('id', String(id));
    startTransition(async () => {
      const res = await action(fd);
      if (res?.error) {
        setError(res.error);
        return;
      }
      setConfirming(null);
    });
  }

  if (status === 'draft') return null;

  return (
    <div className="flex flex-col items-end gap-1">
      {status === 'finalized' ? (
        <button
          disabled={pending}
          onClick={() => setConfirming('unfinalize')}
          className="inline-flex items-center gap-1.5 rounded-full border border-border px-3.5 py-1.5 text-xs font-semibold transition hover:bg-muted disabled:opacity-60"
        >
          <Unlock className="size-3.5" /> Un-finalize
        </button>
      ) : (
        <button
          disabled={!canFinalize}
          onClick={() => setConfirming('finalize')}
          title={canFinalize ? undefined : 'Conclude every match first'}
          className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3.5 py-1.5 text-xs font-semibold text-primary-foreground transition hover:brightness-110 disabled:opacity-50"
        >
          <Lock className="size-3.5" /> Finalize &amp; score
        </button>
      )}
      {error && <span className="max-w-xs text-right text-[11px] text-danger">{error}</span>}

      <ConfirmDialog
        open={confirming === 'finalize'}
        title="Finalize match day"
        message={error ?? 'This computes points for the whole league and snapshots the standings. You can un-finalize to correct it.'}
        confirmLabel="Finalize & score"
        busyLabel="Finalizing…"
        destructive={false}
        busy={pending}
        onConfirm={() => run(finalizeMatchDay)}
        onCancel={() => {
          setConfirming(null);
          setError(null);
        }}
      />
      <ConfirmDialog
        open={confirming === 'unfinalize'}
        title="Un-finalize match day"
        message={error ?? 'This removes this day’s points and standings snapshot and reopens it for edits.'}
        confirmLabel="Un-finalize"
        busyLabel="Un-finalizing…"
        busy={pending}
        onConfirm={() => run(unfinalizeMatchDay)}
        onCancel={() => {
          setConfirming(null);
          setError(null);
        }}
      />
    </div>
  );
}
