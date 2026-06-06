'use client';

import { useRef, useState, useTransition } from 'react';
import { Download } from 'lucide-react';
import { importFixturesFromApi } from '../actions';

export function ImportFixturesForm({ matchDayId }: { matchDayId: number }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<string | null>(null);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setResult(null);
    const fd = new FormData(e.currentTarget);
    fd.set('matchDayId', String(matchDayId));
    startTransition(async () => {
      const res = await importFixturesFromApi(fd);
      if ('error' in res) {
        setResult(`Error: ${res.error}`);
      } else {
        setResult(`Done — ${res.imported} imported, ${res.skipped} skipped.`);
        if (res.imported > 0) formRef.current?.reset();
      }
    });
  }

  return (
    <form
      ref={formRef}
      onSubmit={onSubmit}
      className="grid gap-3 rounded-xl border border-border bg-card p-5 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
    >
      <div>
        <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
          From date
        </label>
        <input
          name="fromDate"
          type="date"
          required
          className="w-full rounded-lg border border-input bg-background px-3 py-2 outline-none focus:border-primary"
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
          To date
        </label>
        <input
          name="toDate"
          type="date"
          required
          className="w-full rounded-lg border border-input bg-background px-3 py-2 outline-none focus:border-primary"
        />
      </div>
      <button
        disabled={pending}
        className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-border px-4 py-2 text-sm font-medium transition hover:bg-muted disabled:opacity-60"
      >
        <Download className="size-4" />
        {pending ? 'Importing…' : 'Import fixtures'}
      </button>
      {result && (
        <p className={`text-sm sm:col-span-3 ${result.startsWith('Error') ? 'text-danger' : 'text-success'}`}>
          {result}
        </p>
      )}
    </form>
  );
}
