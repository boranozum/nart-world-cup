'use client';

import { useState, useTransition } from 'react';
import { Pencil, Trash2, Check, X } from 'lucide-react';
import { TeamBadge } from '@/components/team-badge';
import { ConfirmActionButton } from '@/components/confirm-action-button';
import { updateTeam, deleteTeam } from './actions';

type Team = { id: number; name: string; shortName: string | null; badgeUrl: string | null };

const PAGE_SIZE = 24;
const inp = 'w-full rounded-lg border border-input bg-background px-2 py-1.5 text-sm outline-none focus:border-primary';

function TeamCard({ team }: { team: Team }) {
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    fd.set('id', String(team.id));
    startTransition(async () => {
      const res = await updateTeam(fd);
      if (res && 'error' in res) setError(res.error);
      else setEditing(false);
    });
  }

  if (editing) {
    return (
      <div className="flex flex-col gap-2 rounded-xl border border-primary bg-card p-3">
        <form onSubmit={onSubmit} className="flex flex-col gap-2">
          <input type="hidden" name="id" value={team.id} />
          <input name="name" required defaultValue={team.name} placeholder="Name" className={inp} />
          <input
            name="shortName"
            defaultValue={team.shortName ?? ''}
            placeholder="Short (e.g. BRA)"
            maxLength={5}
            className={`${inp} uppercase`}
          />
          <input
            name="badgeUrl"
            defaultValue={team.badgeUrl ?? ''}
            placeholder="Badge URL (optional)"
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
    <div className="flex flex-col items-center gap-2 rounded-xl border border-border bg-card p-4 text-center transition-colors hover:border-border/80">
      <TeamBadge name={team.name} shortName={team.shortName} badgeUrl={team.badgeUrl} className="size-14 rounded-lg" />
      <div className="min-w-0 w-full">
        <p className="truncate text-sm font-semibold">{team.name}</p>
        {team.shortName && <p className="text-xs text-muted-foreground">{team.shortName}</p>}
      </div>
      <div className="flex gap-1">
        <button
          onClick={() => setEditing(true)}
          aria-label={`Edit ${team.name}`}
          className="rounded-md p-1.5 text-muted-foreground transition hover:bg-primary/10 hover:text-primary"
        >
          <Pencil className="size-3.5" />
        </button>
        <ConfirmActionButton
          action={deleteTeam}
          fields={{ id: team.id }}
          title="Delete team"
          message={`Delete ${team.name}? This also removes its players. Teams used in a match can't be deleted.`}
          confirmLabel="Delete"
          busyLabel="Deleting…"
          ariaLabel={`Delete ${team.name}`}
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

export function TeamsGrid({ teams }: { teams: Team[] }) {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);

  const q = search.toLowerCase();
  const filtered = teams.filter(
    (t) => t.name.toLowerCase().includes(q) || (t.shortName?.toLowerCase().includes(q) ?? false),
  );
  const pageCount = Math.ceil(filtered.length / PAGE_SIZE);
  const slice = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  function onSearch(v: string) {
    setSearch(v);
    setPage(0);
  }

  return (
    <div className="mt-6">
      <div className="flex items-center gap-3">
        <input
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          placeholder="Search teams…"
          className="w-full max-w-xs rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary"
        />
        {search && (
          <span className="text-sm text-muted-foreground">
            {filtered.length} of {teams.length}
          </span>
        )}
      </div>

      {filtered.length === 0 ? (
        <p className="mt-8 text-center text-sm text-muted-foreground">No teams match.</p>
      ) : (
        <div className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
          {slice.map((t) => <TeamCard key={t.id} team={t} />)}
        </div>
      )}

      <Pagination page={page} pageCount={pageCount} onPage={setPage} />
    </div>
  );
}
