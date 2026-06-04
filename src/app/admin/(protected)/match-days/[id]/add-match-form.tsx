'use client';

import { useRef, useState, useTransition } from 'react';
import { createMatch } from '../actions';

type Team = { id: number; name: string };

export function AddMatchForm({ matchDayId, teams }: { matchDayId: number; teams: Team[] }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    const local = String(fd.get('kickoffLocal') ?? '');
    if (!local) {
      setError('Pick a kickoff time.');
      return;
    }
    // datetime-local is in the admin's local zone; store as UTC.
    fd.set('kickoffUtc', new Date(local).toISOString());
    fd.set('matchDayId', String(matchDayId));
    startTransition(async () => {
      const res = await createMatch(fd);
      if (res?.error) setError(res.error);
      else formRef.current?.reset();
    });
  }

  if (teams.length < 2) {
    return (
      <p className="rounded-xl border border-dashed border-border bg-card/50 p-4 text-sm text-muted-foreground">
        Add at least two teams before creating matches.
      </p>
    );
  }

  return (
    <form
      ref={formRef}
      onSubmit={onSubmit}
      className="grid gap-3 rounded-xl border border-border bg-card p-5 sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-end"
    >
      <div>
        <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Home
        </label>
        <select name="teamAId" required className="w-full rounded-lg border border-input bg-background px-3 py-2 outline-none focus:border-primary">
          <option value="">Team A</option>
          {teams.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Away
        </label>
        <select name="teamBId" required className="w-full rounded-lg border border-input bg-background px-3 py-2 outline-none focus:border-primary">
          <option value="">Team B</option>
          {teams.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Kickoff (your local time)
        </label>
        <input
          name="kickoffLocal"
          type="datetime-local"
          required
          className="w-full rounded-lg border border-input bg-background px-3 py-2 outline-none focus:border-primary"
        />
      </div>
      <button
        disabled={pending}
        className="rounded-lg bg-primary px-5 py-2 font-semibold text-primary-foreground transition hover:brightness-110 disabled:opacity-60"
      >
        {pending ? 'Adding…' : 'Add match'}
      </button>
      {error && <p className="text-sm text-danger sm:col-span-4">{error}</p>}
    </form>
  );
}
