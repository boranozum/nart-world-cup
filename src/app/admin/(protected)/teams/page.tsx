import { asc } from 'drizzle-orm';
import { Trash2 } from 'lucide-react';
import { db, schema } from '@/lib/db';
import { ConfirmActionButton } from '@/components/confirm-action-button';
import { TeamBadge } from '@/components/team-badge';
import { createTeam, deleteTeam } from './actions';

export default async function TeamsPage() {
  const teams = await db.select().from(schema.teams).orderBy(asc(schema.teams.id));

  return (
    <div className="max-w-3xl">
      <h1 className="font-display text-3xl font-extrabold uppercase tracking-tight">Teams</h1>
      <p className="mt-1 text-muted-foreground">Add teams as the tournament needs them.</p>

      <form
        action={createTeam}
        className="mt-6 grid gap-3 rounded-xl border border-border bg-card p-5 sm:grid-cols-[1fr_8rem_auto] sm:items-end"
      >
        <div>
          <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Name
          </label>
          <input
            name="name"
            required
            placeholder="Galatasaray"
            className="w-full rounded-lg border border-input bg-background px-3 py-2 outline-none focus:border-primary"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Short
          </label>
          <input
            name="shortName"
            placeholder="GAL"
            maxLength={5}
            className="w-full rounded-lg border border-input bg-background px-3 py-2 uppercase outline-none focus:border-primary"
          />
        </div>
        <button className="rounded-lg bg-primary px-5 py-2 font-semibold text-primary-foreground transition hover:brightness-110">
          Add
        </button>
        <input
          name="badgeUrl"
          placeholder="Badge image URL (optional)"
          className="rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary sm:col-span-3"
        />
      </form>

      <div className="mt-6 overflow-hidden rounded-xl border border-border">
        {teams.length === 0 ? (
          <p className="bg-card p-6 text-center text-sm text-muted-foreground">No teams yet.</p>
        ) : (
          <ul className="divide-y divide-border">
            {teams.map((t) => (
              <li key={t.id} className="flex items-center gap-3 bg-card px-4 py-3">
                <span className="w-6 text-sm text-muted-foreground">{t.id}</span>
                <TeamBadge name={t.name} shortName={t.shortName} badgeUrl={t.badgeUrl} className="size-8" />
                <span className="font-medium">{t.name}</span>
                {t.shortName && (
                  <span className="rounded bg-muted px-1.5 py-0.5 text-xs font-medium text-muted-foreground">
                    {t.shortName}
                  </span>
                )}
                <span className="ml-auto">
                  <ConfirmActionButton
                    action={deleteTeam}
                    fields={{ id: t.id }}
                    title="Delete team"
                    message={`Delete ${t.name}? This also removes its players. Teams used in a match can’t be deleted.`}
                    confirmLabel="Delete"
                    busyLabel="Deleting…"
                    ariaLabel={`Delete ${t.name}`}
                    className="rounded-md p-1.5 text-muted-foreground transition hover:bg-danger/10 hover:text-danger"
                  >
                    <Trash2 className="size-4" />
                  </ConfirmActionButton>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
