'use client';

import { useState, useTransition } from 'react';
import { Pencil, Trash2, X } from 'lucide-react';
import { PlayerFace } from '@/components/player-face';
import { ConfirmActionButton } from '@/components/confirm-action-button';
import { deletePlayer, updatePlayer } from './actions';

export type AdminPlayer = {
  id: number;
  name: string;
  teamId: number;
  faceUrl: string | null;
  teamName: string;
};

const inputCls =
  'w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary';

export function PlayerRow({
  player,
  teams,
}: {
  player: AdminPlayer;
  teams: { id: number; name: string }[];
}) {
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    fd.set('id', String(player.id));
    startTransition(async () => {
      const res = await updatePlayer(fd);
      if (res?.error) setError(res.error);
      else setEditing(false);
    });
  }

  if (editing) {
    return (
      <li className="bg-card px-4 py-3">
        <form
          onSubmit={onSubmit}
          className="grid gap-3 sm:grid-cols-[1fr_10rem_auto] sm:items-end"
        >
          <div>
            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Name
            </label>
            <input name="name" required defaultValue={player.name} className={inputCls} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Team
            </label>
            <select name="teamId" defaultValue={player.teamId} className={inputCls}>
              {teams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex gap-2">
            <button
              disabled={pending}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:brightness-110 disabled:opacity-60"
            >
              {pending ? 'Saving…' : 'Save'}
            </button>
            <button
              type="button"
              onClick={() => {
                setEditing(false);
                setError(null);
              }}
              className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-2 text-sm font-medium transition hover:bg-muted"
            >
              <X className="size-3.5" /> Cancel
            </button>
          </div>
          <input
            name="faceUrl"
            defaultValue={player.faceUrl ?? ''}
            placeholder="Face photo URL (optional)"
            className={`${inputCls} sm:col-span-3`}
          />
          {error && <p className="text-sm text-danger sm:col-span-3">{error}</p>}
        </form>
      </li>
    );
  }

  return (
    <li className="flex items-center gap-3 bg-card px-4 py-3">
      <span className="w-6 text-sm text-muted-foreground">{player.id}</span>
      <PlayerFace name={player.name} faceUrl={player.faceUrl} className="size-9" />
      <span className="font-medium">{player.name}</span>
      <span className="rounded bg-muted px-1.5 py-0.5 text-xs font-medium text-muted-foreground">
        {player.teamName}
      </span>
      <span className="ml-auto flex items-center gap-1">
        <button
          type="button"
          onClick={() => setEditing(true)}
          aria-label={`Edit ${player.name}`}
          className="rounded-md p-1.5 text-muted-foreground transition hover:bg-muted hover:text-foreground"
        >
          <Pencil className="size-4" />
        </button>
        <ConfirmActionButton
          action={deletePlayer}
          fields={{ id: player.id }}
          title="Delete player"
          message={`Delete ${player.name}?`}
          confirmLabel="Delete"
          busyLabel="Deleting…"
          ariaLabel={`Delete ${player.name}`}
          className="rounded-md p-1.5 text-muted-foreground transition hover:bg-danger/10 hover:text-danger"
        >
          <Trash2 className="size-4" />
        </ConfirmActionButton>
      </span>
    </li>
  );
}
