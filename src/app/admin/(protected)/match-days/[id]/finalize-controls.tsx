'use client';

import { useState, useTransition } from 'react';
import { Lock, Unlock } from 'lucide-react';
import { finalizeMatchDay, unfinalizeMatchDay } from '../actions';

type Props = {
  id: number;
  status: 'draft' | 'active' | 'finalized';
  /** True only when the day is active and every non-cancelled match has a result. */
  canFinalize: boolean;
};

export function FinalizeControls({ id, status, canFinalize }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function run(action: (fd: FormData) => Promise<{ error: string } | void>) {
    setError(null);
    const fd = new FormData();
    fd.set('id', String(id));
    startTransition(async () => {
      const res = await action(fd);
      if (res?.error) setError(res.error);
    });
  }

  if (status === 'draft') return null;

  return (
    <div className="flex flex-col items-end gap-1">
      {status === 'finalized' ? (
        <button
          disabled={pending}
          onClick={() => run(unfinalizeMatchDay)}
          className="inline-flex items-center gap-1.5 rounded-full border border-border px-3.5 py-1.5 text-xs font-semibold transition hover:bg-muted disabled:opacity-60"
        >
          <Unlock className="size-3.5" />
          {pending ? 'Un-finalizing…' : 'Un-finalize'}
        </button>
      ) : (
        <button
          disabled={pending || !canFinalize}
          onClick={() => run(finalizeMatchDay)}
          title={canFinalize ? undefined : 'Conclude every match first'}
          className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3.5 py-1.5 text-xs font-semibold text-primary-foreground transition hover:brightness-110 disabled:opacity-50"
        >
          <Lock className="size-3.5" />
          {pending ? 'Finalizing…' : 'Finalize & score'}
        </button>
      )}
      {error && <span className="max-w-xs text-right text-[11px] text-danger">{error}</span>}
    </div>
  );
}
