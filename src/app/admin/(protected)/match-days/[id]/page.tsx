import Link from 'next/link';
import { notFound } from 'next/navigation';
import { asc, eq } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { ArrowLeft, Trash2 } from 'lucide-react';
import { db, schema } from '@/lib/db';
import { PHASE_LABELS } from '@/lib/tournament';
import { LocalTime } from '@/components/local-time';
import { AddMatchForm } from './add-match-form';
import { deleteMatch } from '../actions';

export default async function MatchDayDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: idParam } = await params;
  const id = Number(idParam);
  if (!Number.isFinite(id)) notFound();

  const [matchDay] = await db
    .select()
    .from(schema.matchDays)
    .where(eq(schema.matchDays.id, id))
    .limit(1);
  if (!matchDay) notFound();

  const teamA = alias(schema.teams, 'team_a');
  const teamB = alias(schema.teams, 'team_b');

  const [teams, matches] = await Promise.all([
    db
      .select({ id: schema.teams.id, name: schema.teams.name })
      .from(schema.teams)
      .orderBy(asc(schema.teams.name)),
    db
      .select({
        id: schema.matches.id,
        kickoffUtc: schema.matches.kickoffUtc,
        status: schema.matches.status,
        teamAName: teamA.name,
        teamBName: teamB.name,
      })
      .from(schema.matches)
      .innerJoin(teamA, eq(schema.matches.teamAId, teamA.id))
      .innerJoin(teamB, eq(schema.matches.teamBId, teamB.id))
      .where(eq(schema.matches.matchDayId, id))
      .orderBy(asc(schema.matches.kickoffUtc)),
  ]);

  return (
    <div className="max-w-3xl">
      <Link
        href="/admin/match-days"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Match days
      </Link>

      <div className="mt-3 flex items-center gap-3">
        <h1 className="font-display text-3xl font-extrabold uppercase tracking-tight">
          {matchDay.name}
        </h1>
        <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold uppercase text-muted-foreground">
          {matchDay.status}
        </span>
      </div>
      <p className="mt-1 text-muted-foreground">{PHASE_LABELS[matchDay.phase]}</p>

      <div className="mt-6">
        <AddMatchForm matchDayId={id} teams={teams} />
      </div>

      <div className="mt-6 overflow-hidden rounded-xl border border-border">
        {matches.length === 0 ? (
          <p className="bg-card p-6 text-center text-sm text-muted-foreground">
            No matches in this match day yet.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {matches.map((m) => (
              <li key={m.id} className="flex items-center gap-3 bg-card px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">
                    {m.teamAName} <span className="text-muted-foreground">vs</span> {m.teamBName}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    <LocalTime iso={m.kickoffUtc.toISOString()} /> · {m.status}
                  </p>
                </div>
                <form action={deleteMatch}>
                  <input type="hidden" name="id" value={m.id} />
                  <input type="hidden" name="matchDayId" value={id} />
                  <button
                    aria-label="Delete match"
                    className="rounded-md p-1.5 text-muted-foreground transition hover:bg-danger/10 hover:text-danger"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
