import Link from 'next/link';
import { asc, eq } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { type AdminPlayer } from './player-row';
import { createPlayer } from './actions';
import { SyncSquadsButton } from './sync-squads-button';
import { PlayersGrid } from './players-grid';

const inputCls =
  'w-full rounded-lg border border-input bg-background px-3 py-2 outline-none focus:border-primary';
const labelCls =
  'mb-1 block text-xs font-medium uppercase tracking-wide text-muted-foreground';

export default async function PlayersPage() {
  const [teams, players] = await Promise.all([
    db
      .select({ id: schema.teams.id, name: schema.teams.name })
      .from(schema.teams)
      .orderBy(asc(schema.teams.name)),
    db
      .select({
        id: schema.players.id,
        name: schema.players.name,
        teamId: schema.players.teamId,
        faceUrl: schema.players.faceUrl,
        teamName: schema.teams.name,
      })
      .from(schema.players)
      .innerJoin(schema.teams, eq(schema.players.teamId, schema.teams.id))
      .orderBy(asc(schema.teams.name), asc(schema.players.name)),
  ]);

  return (
    <div>
      <div className="flex max-w-3xl items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-extrabold uppercase tracking-tight">Players</h1>
          <p className="mt-1 text-muted-foreground">
            Add players manually or sync full squads from the API (requires teams to be imported first).
          </p>
        </div>
        <SyncSquadsButton />
      </div>

      {teams.length === 0 ? (
        <p className="mt-6 rounded-xl border border-dashed border-border bg-card/50 p-6 text-center text-sm text-muted-foreground">
          Add a team on the{' '}
          <Link href="/admin/teams" className="font-medium text-primary underline">
            Teams
          </Link>{' '}
          page before adding players.
        </p>
      ) : (
        <>
          <form
            action={createPlayer}
            className="mt-6 max-w-3xl grid gap-3 rounded-xl border border-border bg-card p-5 sm:grid-cols-[1fr_10rem_auto] sm:items-end"
          >
            <div>
              <label className={labelCls}>Name</label>
              <input name="name" required placeholder="Mauro Icardi" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Team</label>
              <select name="teamId" required defaultValue="" className={inputCls}>
                <option value="" disabled>
                  Select team…
                </option>
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
            <button className="rounded-lg bg-primary px-5 py-2 font-semibold text-primary-foreground transition hover:brightness-110">
              Add
            </button>
            <input
              name="faceUrl"
              placeholder="Face photo URL (optional)"
              className="rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary sm:col-span-3"
            />
          </form>

          {players.length === 0 ? (
            <p className="mt-6 rounded-xl border border-dashed border-border bg-card/50 p-6 text-center text-sm text-muted-foreground">
              No players yet.
            </p>
          ) : (
            <PlayersGrid players={players as AdminPlayer[]} teams={teams} />
          )}
        </>
      )}
    </div>
  );
}
