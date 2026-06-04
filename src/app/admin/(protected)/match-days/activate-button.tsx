'use client';

import { useState, useTransition } from 'react';
import { activateMatchDay } from './actions';

export function ActivateButton({ id }: { id: number }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <span className="flex items-center gap-2">
      {error && <span className="text-[11px] text-danger">{error}</span>}
      <button
        disabled={pending}
        onClick={() => {
          setError(null);
          const fd = new FormData();
          fd.set('id', String(id));
          startTransition(async () => {
            const res = await activateMatchDay(fd);
            if (res?.error) setError(res.error);
          });
        }}
        className="rounded-full bg-success/15 px-3 py-1.5 text-xs font-semibold text-success transition hover:bg-success/25 disabled:opacity-60"
      >
        {pending ? 'Activating…' : 'Activate'}
      </button>
    </span>
  );
}
