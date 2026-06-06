'use client';

import { useState, useTransition } from 'react';
import { Pencil, Trash2, Check, X } from 'lucide-react';
import { PlayerFace } from '@/components/player-face';
import { ConfirmActionButton } from '@/components/confirm-action-button';
import { updatePlayer, deletePlayer } from './actions';
import type { AdminPlayer } from './player-row';

type TeamOption = { id: number; name: string };

const PAGE_SIZE = 30;
const inp = 'w-full rounded-lg border border-input bg-background px-2 py-1.5 text-sm outline-none focus:border-primary';

function PlayerCard({ player, teams }: { player: AdminPlayer; teams: TeamOption[] }) {
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    fd.set('id', String(player.id));
    startTransition(async () => {
      const res = await updatePlayer(fd);
      if (res && 'error' in res) setError(res.error);
      else setEditing(false);
    });
  }

  if (editing) {
    return (
      <div className="flex flex-col gap-2 rounded-xl border border-primary bg-card p-3">
        <form onSubmit={onSubmit} className="flex flex-col gap-2">
          <input type="hidden" name="id" value={player.id} />
          <input name="name" required defaultValue={player.name} placeholder="Name" className={inp} />
          <select name="teamId" defaultValue={player.teamId} className={inp}>
            {teams.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
          <input
            name="faceUrl"
            defaultValue={player.faceUrl ?? ''}
            placeholder="Face URL (optional)"
            className={`${inp} text-xs`}
          />
          {error && <p className="text-xs text-danger">{error}</p>}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={busy}
              className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-primary px-2 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-60"
            >
              <Check className="size-3" /> {busy ? 'Saving…' : 'Save'}
            </button>
            <button
              type="button"
              onClick={() => { setEditing(false); setError(null); }}
              className="flex flex-1 items-center justify-center gap-1 rounded-lg border border-border px-2 py-1.5 text-xs font-medium hover:bg-muted"
            >
              <X className="size-3" /> Cancel
            </button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-border bg-card p-3 text-center transition-colors hover:border-border/80">
      <PlayerFace name={player.name} faceUrl={player.faceUrl} className="size-12" />
      <div className="min-w-0 w-full">
        <p className="truncate text-sm font-semibold">{player.name}</p>
        <p className="truncate text-xs text-muted-foreground">{player.teamName}</p>
      </div>
      <div className="flex gap-1">
        <button
          onClick={() => setEditing(true)}
          aria-label={`Edit ${player.name}`}
          className="rounded-md p-1.5 text-muted-foreground transition hover:bg-primary/10 hover:text-primary"
        >
          <Pencil className="size-3.5" />
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
          <Trash2 className="size-3.5" />
        </ConfirmActionButton>
      </div>
    </div>
  );
}

function Pagination({ page, pageCount, onPage }: { page: number; pageCount: number; onPage: (n: number) => void }) {
  if (pageCount <= 1) return null;

  const slots: (number | 'gap')[] = [];
  for (let i = 0; i < pageCount; i++) {
    if (i === 0 || i === pageCount - 1 || (i >= page - 2 && i <= page + 2)) {
      slots.push(i);
    } else if (slots[slots.length - 1] !== 'gap') {
      slots.push('gap');
    }
  }

  const btn = 'size-8 rounded-lg text-sm font-medium transition border border-border hover:bg-muted disabled:opacity-40';
  return (
    <div className="mt-6 flex items-center justify-center gap-1">
      <button disabled={page === 0} onClick={() => onPage(page - 1)} className={btn}>←</button>
      {slots.map((s, i) =>
        s === 'gap' ? (
          <span key={`g${i}`} className="px-1 text-muted-foreground">…</span>
        ) : (
          <button
            key={s}
            onClick={() => onPage(s as number)}
            className={`size-8 rounded-lg text-sm font-medium transition ${
              s === page ? 'bg-primary text-primary-foreground' : 'border border-border hover:bg-muted'
            }`}
          >
            {(s as number) + 1}
          </button>
        )
      )}
      <button disabled={page === pageCount - 1} onClick={() => onPage(page + 1)} className={btn}>→</button>
    </div>
  );
}

export function PlayersGrid({ players, teams }: { players: AdminPlayer[]; teams: TeamOption[] }) {
  const [search, setSearch] = useState('');
  const [teamFilter, setTeamFilter] = useState('');
  const [page, setPage] = useState(0);

  const q = search.toLowerCase();
  const filtered = players.filter((p) => {
    const matchesSearch = p.name.toLowerCase().includes(q);
    const matchesTeam = !teamFilter || p.teamId === Number(teamFilter);
    return matchesSearch && matchesTeam;
  });
  const pageCount = Math.ceil(filtered.length / PAGE_SIZE);
  const slice = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  function onSearch(v: string) {
    setSearch(v);
    setPage(0);
  }

  function onTeamFilter(v: string) {
    setTeamFilter(v);
    setPage(0);
  }

  return (
    <div className="mt-6">
      <div className="flex flex-wrap items-center gap-3">
        <input
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          placeholder="Search players…"
          className="w-full max-w-xs rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary"
        />
        <select
          value={teamFilter}
          onChange={(e) => onTeamFilter(e.target.value)}
          className="rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary"
        >
          <option value="">All teams</option>
          {teams.map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
        {(search || teamFilter) && (
          <span className="text-sm text-muted-foreground">
            {filtered.length} player{filtered.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {filtered.length === 0 ? (
        <p className="mt-8 text-center text-sm text-muted-foreground">No players match.</p>
      ) : (
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {slice.map((p) => <PlayerCard key={p.id} player={p} teams={teams} />)}
        </div>
      )}

      <Pagination page={page} pageCount={pageCount} onPage={setPage} />
    </div>
  );
}
