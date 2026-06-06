'use client';

import { useState, useTransition } from 'react';
import { RefreshCw } from 'lucide-react';
import { syncSquadsFromApi } from './actions';

export function SyncSquadsButton() {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<string | null>(null);

  function run() {
    setResult(null);
    startTransition(async () => {
      const res = await syncSquadsFromApi();
      if ('error' in res) {
        setResult(`Error: ${res.error}`);
      } else {
        setResult(`Done — ${res.imported} players imported.`);
      }
    });
  }

  return (
    <div className="flex items-center gap-3">
      <button
        disabled={pending}
        onClick={run}
        className="inline-flex items-center gap-1.5 rounded-lg border border-border px-4 py-2 text-sm font-medium transition hover:bg-muted disabled:opacity-60"
      >
        <RefreshCw className={`size-4 ${pending ? 'animate-spin' : ''}`} />
        {pending ? 'Syncing squads…' : 'Sync squads from API'}
      </button>
      {result && (
        <span className={`text-sm ${result.startsWith('Error') ? 'text-danger' : 'text-success'}`}>
          {result}
        </span>
      )}
    </div>
  );
}
