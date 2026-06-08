import Link from 'next/link';
import { asc } from 'drizzle-orm';
import { ChevronRight, Trash2 } from 'lucide-react';
import { db, schema } from '@/lib/db';
import { PHASE_LABELS, PHASE_ORDER, type TournamentPhase } from '@/lib/tournament';
import { ConfirmActionButton } from '@/components/confirm-action-button';
import { createMatchDay, deleteMatchDay } from './actions';
import { ActivateButton } from './activate-button';

const STATUS_STYLES: Record<string, string> = {
  draft: 'bg-muted text-muted-foreground',
  active: 'bg-success/15 text-success',
  finalized: 'bg-primary/15 text-primary',
};

export default async function MatchDaysPage() {
  const matchDays = await db
    .select()
    .from(schema.matchDays)
    .orderBy(asc(schema.matchDays.sequence), asc(schema.matchDays.id));

  return (
    <div className="max-w-3xl">
      <h1 className="font-display text-3xl font-extrabold uppercase tracking-tight">Match Days</h1>
      <p className="mt-1 text-muted-foreground">
        A match day holds one or more matches. Only one can be active at a time.
      </p>

      <form
        action={createMatchDay}
        className="mt-6 grid gap-3 rounded-xl border border-border bg-card p-5 sm:grid-cols-[1fr_1fr_6rem_auto] sm:items-end"
      >
        <div>
          <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Name
          </label>
          <input
            name="name"
            required
            placeholder="Matchday 1"
            className="w-full rounded-lg border border-input bg-background px-3 py-2 outline-none focus:border-primary"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Phase
          </label>
          <select
            name="phase"
            required
            defaultValue="group"
            className="w-full rounded-lg border border-input bg-background px-3 py-2 outline-none focus:border-primary"
          >
            {PHASE_ORDER.map((p: TournamentPhase) => (
              <option key={p} value={p}>
                {PHASE_LABELS[p]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Order
          </label>
          <input
            name="sequence"
            type="number"
            required
            defaultValue={matchDays.length + 1}
            className="w-full rounded-lg border border-input bg-background px-3 py-2 outline-none focus:border-primary"
          />
        </div>
        <button className="rounded-lg bg-primary px-5 py-2 font-semibold text-primary-foreground transition hover:brightness-110">
          Add
        </button>
      </form>

      <div className="mt-6 space-y-2">
        {matchDays.length === 0 ? (
          <p className="rounded-xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">
            No match days yet.
          </p>
        ) : (
          matchDays.map((md) => (
            <div
              key={md.id}
              className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{md.name}</span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase ${STATUS_STYLES[md.status]}`}
                  >
                    {md.status}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">{PHASE_LABELS[md.phase]}</p>
              </div>

              <div className="ml-auto flex items-center gap-2">
                {md.status === 'draft' && <ActivateButton id={md.id} />}
                {md.status === 'draft' && (
                  <ConfirmActionButton
                    action={deleteMatchDay}
                    fields={{ id: md.id }}
                    title="Delete match day"
                    message={`Delete "${md.name}"? This also removes its matches.`}
                    confirmLabel="Delete"
                    busyLabel="Deleting…"
                    ariaLabel="Delete match day"
                    className="rounded-md p-1.5 text-muted-foreground transition hover:bg-danger/10 hover:text-danger"
                  >
                    <Trash2 className="size-4" />
                  </ConfirmActionButton>
                )}
                <Link
                  href={`/admin/match-days/${md.id}`}
                  className="flex items-center gap-1 rounded-full border border-border px-3 py-1.5 text-xs font-medium transition hover:bg-muted"
                >
                  Matches <ChevronRight className="size-3.5" />
                </Link>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
