import { asc } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { createTeam } from './actions';
import { ImportTeamsButton } from './import-teams-button';
import { TeamsGrid } from './teams-grid';

export default async function TeamsPage() {
  const teams = await db
    .select({ id: schema.teams.id, name: schema.teams.name, shortName: schema.teams.shortName, badgeUrl: schema.teams.badgeUrl })
    .from(schema.teams)
    .orderBy(asc(schema.teams.name));

  return (
    <div>
      <div className="flex max-w-3xl items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-extrabold uppercase tracking-tight">Teams</h1>
          <p className="mt-1 text-muted-foreground">Add teams manually or import all WC 2026 teams from the API.</p>
        </div>
        <ImportTeamsButton />
      </div>

      <form
        action={createTeam}
        className="mt-6 max-w-3xl grid gap-3 rounded-xl border border-border bg-card p-5 sm:grid-cols-[1fr_8rem_auto] sm:items-end"
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

      {teams.length === 0 ? (
        <p className="mt-6 rounded-xl border border-dashed border-border bg-card/50 p-6 text-center text-sm text-muted-foreground">
          No teams yet.
        </p>
      ) : (
        <TeamsGrid teams={teams} />
      )}
    </div>
  );
}
