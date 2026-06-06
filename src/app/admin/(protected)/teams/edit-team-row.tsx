'use client';

import { useState, useTransition } from 'react';
import { Pencil, Check, X } from 'lucide-react';
import { TeamBadge } from '@/components/team-badge';
import { updateTeam } from './actions';

type Team = { id: number; name: string; shortName: string | null; badgeUrl: string | null };

export function EditTeamRow({ team, deleteButton }: { team: Team; deleteButton: React.ReactNode }) {
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, startTransition] = useTransition();

  function save(fd: FormData) {
    setError(null);
    startTransition(async () => {
      const res = await updateTeam(fd);
      if (res && 'error' in res) {
        setError(res.error);
        return;
      }
      setEditing(false);
    });
  }

  if (!editing) {
    return (
      <li className="flex items-center gap-3 bg-card px-4 py-3">
        <span className="w-6 text-sm text-muted-foreground">{team.id}</span>
        <TeamBadge name={team.name} shortName={team.shortName} badgeUrl={team.badgeUrl} className="size-8" />
        <span className="font-medium">{team.name}</span>
        {team.shortName && (
          <span className="rounded bg-muted px-1.5 py-0.5 text-xs font-medium text-muted-foreground">
            {team.shortName}
          </span>
        )}
        <span className="ml-auto flex items-center gap-1">
          <button
            type="button"
            aria-label={`Edit ${team.name}`}
            onClick={() => setEditing(true)}
            className="rounded-md p-1.5 text-muted-foreground transition hover:bg-primary/10 hover:text-primary"
          >
            <Pencil className="size-4" />
          </button>
          {deleteButton}
        </span>
      </li>
    );
  }

  return (
    <li className="bg-card px-4 py-3">
      <form action={save} className="flex flex-col gap-3">
        <input type="hidden" name="id" value={team.id} />
        <div className="grid gap-2 sm:grid-cols-[1fr_8rem]">
          <div>
            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Name
            </label>
            <input
              name="name"
              required
              defaultValue={team.name}
              className="w-full rounded-lg border border-input bg-background px-3 py-1.5 text-sm outline-none focus:border-primary"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Short
            </label>
            <input
              name="shortName"
              maxLength={5}
              defaultValue={team.shortName ?? ''}
              className="w-full rounded-lg border border-input bg-background px-3 py-1.5 text-sm uppercase outline-none focus:border-primary"
            />
          </div>
        </div>
        <input
          name="badgeUrl"
          defaultValue={team.badgeUrl ?? ''}
          placeholder="Badge image URL (optional)"
          className="rounded-lg border border-input bg-background px-3 py-1.5 text-sm outline-none focus:border-primary"
        />
        {error && <p className="text-xs text-danger">{error}</p>}
        <div className="flex items-center gap-2">
          <button
            type="submit"
            disabled={busy}
            className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-1.5 text-sm font-semibold text-primary-foreground transition hover:brightness-110 disabled:opacity-60"
          >
            <Check className="size-3.5" />
            {busy ? 'Saving…' : 'Save'}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => { setEditing(false); setError(null); }}
            className="flex items-center gap-1.5 rounded-lg border border-border px-4 py-1.5 text-sm font-medium transition hover:bg-muted disabled:opacity-60"
          >
            <X className="size-3.5" />
            Cancel
          </button>
        </div>
      </form>
    </li>
  );
}
