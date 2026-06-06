import Link from 'next/link';
import { notFound } from 'next/navigation';
import { asc, eq, inArray } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { ArrowLeft, ExternalLink, Trash2 } from 'lucide-react';
import { db, schema } from '@/lib/db';
import { PHASE_LABELS } from '@/lib/tournament';
import { LocalTime } from '@/components/local-time';
import { ConfirmActionButton } from '@/components/confirm-action-button';
import type { GoalBucket } from '@/lib/predictions';
import { AddMatchForm } from './add-match-form';
import { ConcludeMatchForm, type ExistingResult, type ResultPlayer } from './conclude-match-form';
import { FinalizeControls } from './finalize-controls';
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
        teamAId: schema.matches.teamAId,
        teamBId: schema.matches.teamBId,
        teamAName: teamA.name,
        teamBName: teamB.name,
      })
      .from(schema.matches)
      .innerJoin(teamA, eq(schema.matches.teamAId, teamA.id))
      .innerJoin(teamB, eq(schema.matches.teamBId, teamB.id))
      .where(eq(schema.matches.matchDayId, id))
      .orderBy(asc(schema.matches.kickoffUtc)),
  ]);

  // Load players (for MOTM) and existing results for the matches in this day.
  const matchIds = matches.map((m) => m.id);
  const teamIds = [...new Set(matches.flatMap((m) => [m.teamAId, m.teamBId]))];
  const [players, results] = await Promise.all([
    teamIds.length
      ? db
          .select({ id: schema.players.id, name: schema.players.name, teamId: schema.players.teamId })
          .from(schema.players)
          .where(inArray(schema.players.teamId, teamIds))
          .orderBy(asc(schema.players.name))
      : Promise.resolve([]),
    matchIds.length
      ? db.select().from(schema.matchResults).where(inArray(schema.matchResults.matchId, matchIds))
      : Promise.resolve([]),
  ]);

  const resultByMatch = new Map(results.map((r) => [r.matchId, r]));
  const concludable = matches.filter((m) => m.status !== 'cancelled');
  const canFinalize =
    matchDay.status === 'active' &&
    concludable.length > 0 &&
    concludable.every((m) => resultByMatch.has(m.id));

  return (
    <div className="max-w-3xl">
      <Link
        href="/admin/match-days"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Match days
      </Link>

      <div className="mt-3 flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="font-display text-3xl font-extrabold uppercase tracking-tight">
              {matchDay.name}
            </h1>
            <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold uppercase text-muted-foreground">
              {matchDay.status}
            </span>
          </div>
          <p className="mt-1 text-muted-foreground">{PHASE_LABELS[matchDay.phase]}</p>
        </div>
        <FinalizeControls id={id} status={matchDay.status} canFinalize={canFinalize} />
      </div>

      {matchDay.status !== 'finalized' && (
        <div className="mt-6">
          <AddMatchForm matchDayId={id} teams={teams} />
        </div>
      )}

      <div className="mt-6 overflow-hidden rounded-xl border border-border">
        {matches.length === 0 ? (
          <p className="bg-card p-6 text-center text-sm text-muted-foreground">
            No matches in this match day yet.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {matches.map((m) => {
              const r = resultByMatch.get(m.id);
              const result: ExistingResult | null = r
                ? {
                    scoreA: r.scoreA,
                    scoreB: r.scoreB,
                    firstScoringTeam: r.firstScoringTeam,
                    firstGoalBucket: r.firstGoalBucket as GoalBucket,
                    motmPlayerId: r.motmPlayerId,
                  }
                : null;
              const matchPlayers: ResultPlayer[] = players
                .filter((p) => p.teamId === m.teamAId || p.teamId === m.teamBId)
                .map((p) => ({ id: p.id, name: p.name, side: p.teamId === m.teamAId ? 'A' : 'B' }));

              return (
                <li key={m.id} className="bg-card px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">
                        {m.teamAName} <span className="text-muted-foreground">vs</span> {m.teamBName}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        <LocalTime iso={m.kickoffUtc.toISOString()} /> · {m.status}
                      </p>
                    </div>
                    <Link
                      href={`/admin/matches/${m.id}`}
                      className="flex items-center gap-1 rounded-md px-2 py-1.5 text-xs font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground"
                    >
                      <ExternalLink className="size-3.5" />
                      Moderate
                    </Link>
                    {matchDay.status !== 'finalized' && (
                      <ConfirmActionButton
                        action={deleteMatch}
                        fields={{ id: m.id, matchDayId: id }}
                        title="Delete match"
                        message={`Delete ${m.teamAName} vs ${m.teamBName}? This also removes its predictions and result.`}
                        confirmLabel="Delete"
                        busyLabel="Deleting…"
                        ariaLabel="Delete match"
                        className="rounded-md p-1.5 text-muted-foreground transition hover:bg-danger/10 hover:text-danger"
                      >
                        <Trash2 className="size-4" />
                      </ConfirmActionButton>
                    )}
                  </div>
                  <div className="mt-2">
                    <ConcludeMatchForm
                      matchId={m.id}
                      matchDayId={id}
                      teamAName={m.teamAName}
                      teamBName={m.teamBName}
                      players={matchPlayers}
                      result={result}
                      locked={matchDay.status === 'finalized'}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
