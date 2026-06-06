'use client';

import { useState, useTransition } from 'react';
import { Download } from 'lucide-react';
import { importTeamsFromApi } from './actions';

export function ImportTeamsButton() {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<string | null>(null);

  function run() {
    setResult(null);
    startTransition(async () => {
      const res = await importTeamsFromApi();
      if ('error' in res) {
        setResult(`Error: ${res.error}`);
      } else {
        setResult(`Done — ${res.imported} imported, ${res.updated} updated.`);
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
        <Download className="size-4" />
        {pending ? 'Importing…' : 'Import from API'}
      </button>
      {result && (
        <span className={`text-sm ${result.startsWith('Error') ? 'text-danger' : 'text-success'}`}>
          {result}
        </span>
      )}
    </div>
  );
}
