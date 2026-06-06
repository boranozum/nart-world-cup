import Link from 'next/link';
import { notFound } from 'next/navigation';
import { asc, desc, eq, inArray } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { ArrowLeft, Trash2 } from 'lucide-react';
import { db, schema } from '@/lib/db';
import { requireAdmin } from '@/lib/admin/session';
import { goalBucketLabel, type GoalBucket } from '@/lib/predictions';
import { LocalTime } from '@/components/local-time';
import { PlayerAvatar } from '@/components/player-avatar';
import { ConfirmActionButton } from '@/components/confirm-action-button';
import { adminDeleteComment } from './actions';

function displayName(p: { username: string | null; email: string }) {
  return p.username?.trim() || p.email.split('@')[0];
}

function Cell({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-3 py-2.5 ${className}`}>{children}</td>;
}

function Dash() {
  return <span className="text-muted-foreground">–</span>;
}

export default async function AdminMatchPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id: idParam } = await params;
  const id = Number(idParam);
  if (!Number.isFinite(id)) notFound();

  const teamA = alias(schema.teams, 'team_a');
  const teamB = alias(schema.teams, 'team_b');

  const [match] = await db
    .select({
      id: schema.matches.id,
      kickoffUtc: schema.matches.kickoffUtc,
      status: schema.matches.status,
      matchDayId: schema.matches.matchDayId,
      teamAId: schema.matches.teamAId,
      teamBId: schema.matches.teamBId,
      teamAName: teamA.name,
      teamBName: teamB.name,
    })
    .from(schema.matches)
    .innerJoin(teamA, eq(schema.matches.teamAId, teamA.id))
    .innerJoin(teamB, eq(schema.matches.teamBId, teamB.id))
    .where(eq(schema.matches.id, id))
    .limit(1);

  if (!match) notFound();

  const [result, matchDay, predictions, comments] = await Promise.all([
    db
      .select()
      .from(schema.matchResults)
      .where(eq(schema.matchResults.matchId, id))
      .limit(1)
      .then((r) => r[0] ?? null),

    db
      .select({ status: schema.matchDays.status })
      .from(schema.matchDays)
      .where(eq(schema.matchDays.id, match.matchDayId))
      .limit(1)
      .then((r) => r[0] ?? null),

    db
      .select({
        userId: schema.predictions.userId,
        scoreA: schema.predictions.scoreA,
        scoreB: schema.predictions.scoreB,
        firstScoringTeam: schema.predictions.firstScoringTeam,
        firstGoalBucket: schema.predictions.firstGoalBucket,
        motmPlayerId: schema.predictions.motmPlayerId,
        boosterApplied: schema.predictions.boosterApplied,
        username: schema.profiles.username,
        email: schema.profiles.email,
        avatarUrl: schema.profiles.avatarUrl,
        finalTotal: schema.predictionScores.finalTotal,
      })
      .from(schema.predictions)
      .innerJoin(schema.profiles, eq(schema.predictions.userId, schema.profiles.id))
      .leftJoin(
        schema.predictionScores,
        eq(schema.predictions.id, schema.predictionScores.predictionId),
      )
      .where(eq(schema.predictions.matchId, id))
      .orderBy(desc(schema.predictionScores.finalTotal), asc(schema.profiles.username)),

    db
      .select({
        id: schema.comments.id,
        parentId: schema.comments.parentId,
        body: schema.comments.body,
        createdAt: schema.comments.createdAt,
        deletedAt: schema.comments.deletedAt,
        userId: schema.comments.userId,
        username: schema.profiles.username,
        email: schema.profiles.email,
        avatarUrl: schema.profiles.avatarUrl,
      })
      .from(schema.comments)
      .innerJoin(schema.profiles, eq(schema.comments.userId, schema.profiles.id))
      .where(eq(schema.comments.matchId, id))
      .orderBy(asc(schema.comments.createdAt)),
  ]);

  // Player names for MOTM column
  const motmIds = [
    ...new Set(
      [
        ...predictions.map((p) => p.motmPlayerId),
        result?.motmPlayerId ?? null,
      ].filter((x): x is number => x != null),
    ),
  ];
  const players = motmIds.length
    ? await db
        .select({ id: schema.players.id, name: schema.players.name })
        .from(schema.players)
        .where(inArray(schema.players.id, motmIds))
    : [];
  const playerMap = new Map(players.map((p) => [p.id, p.name]));

  const isFinalized = matchDay?.status === 'finalized';
  const activeComments = comments.filter((c) => !c.deletedAt);

  return (
    <div className="max-w-5xl space-y-10">
      {/* Back + title */}
      <div>
        <Link
          href={`/admin/match-days/${match.matchDayId}`}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> Match day
        </Link>
        <div className="mt-3">
          <h1 className="font-display text-3xl font-extrabold uppercase tracking-tight">
            {match.teamAName} <span className="text-muted-foreground">vs</span> {match.teamBName}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            <LocalTime iso={match.kickoffUtc.toISOString()} />
            {' · '}
            <span className="capitalize">{match.status}</span>
            {result && (
              <span className="ml-2 font-semibold text-foreground">
                {result.scoreA} – {result.scoreB}
              </span>
            )}
            {result?.motmPlayerId && (
              <span className="ml-2 text-muted-foreground">
                MOTM: {playerMap.get(result.motmPlayerId) ?? '?'}
              </span>
            )}
          </p>
        </div>
      </div>

      {/* Predictions */}
      <section>
        <h2 className="font-display text-xl font-bold uppercase tracking-tight">
          Predictions{' '}
          <span className="text-base font-normal text-muted-foreground">
            ({predictions.length})
          </span>
        </h2>
        <div className="mt-3 overflow-x-auto rounded-xl border border-border">
          {predictions.length === 0 ? (
            <p className="bg-card p-6 text-center text-sm text-muted-foreground">
              No predictions yet.
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-2.5">Player</th>
                  <th className="px-3 py-2.5">Score</th>
                  <th className="px-3 py-2.5">1st Team</th>
                  <th className="px-3 py-2.5">Minute</th>
                  <th className="px-3 py-2.5">MOTM</th>
                  {isFinalized && (
                    <th className="px-3 py-2.5 text-right">Pts</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-border bg-card">
                {predictions.map((p) => {
                  const name = displayName(p);
                  return (
                    <tr key={p.userId} className="transition hover:bg-muted/20">
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          <PlayerAvatar
                            name={name}
                            avatarUrl={p.avatarUrl}
                            className="size-7 text-[10px]"
                          />
                          <span className="font-medium">{name}</span>
                          {p.boosterApplied && (
                            <span className="rounded bg-accent/15 px-1 py-0.5 text-[10px] font-bold text-accent">
                              ×2
                            </span>
                          )}
                        </div>
                      </td>
                      <Cell className="tabular-nums">
                        {p.scoreA !== null && p.scoreB !== null ? (
                          `${p.scoreA} – ${p.scoreB}`
                        ) : (
                          <Dash />
                        )}
                      </Cell>
                      <Cell>
                        {p.firstScoringTeam === 'A' ? (
                          match.teamAName.split(' ')[0]
                        ) : p.firstScoringTeam === 'B' ? (
                          match.teamBName.split(' ')[0]
                        ) : p.firstScoringTeam === 'none' ? (
                          'None'
                        ) : (
                          <Dash />
                        )}
                      </Cell>
                      <Cell>
                        {p.firstGoalBucket ? (
                          goalBucketLabel(p.firstGoalBucket as GoalBucket)
                        ) : (
                          <Dash />
                        )}
                      </Cell>
                      <Cell>
                        {p.motmPlayerId ? (
                          playerMap.get(p.motmPlayerId) ?? '?'
                        ) : (
                          <Dash />
                        )}
                      </Cell>
                      {isFinalized && (
                        <Cell className="text-right font-display font-bold tabular-nums">
                          {p.finalTotal ?? 0}
                        </Cell>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </section>

      {/* Comments */}
      <section>
        <h2 className="font-display text-xl font-bold uppercase tracking-tight">
          Comments{' '}
          <span className="text-base font-normal text-muted-foreground">
            ({activeComments.length})
          </span>
        </h2>
        <div className="mt-3 space-y-2">
          {comments.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              No comments yet.
            </p>
          ) : (
            comments.map((c) => {
              const name = displayName(c);
              const isReply = c.parentId !== null;
              return (
                <div
                  key={c.id}
                  className={`flex gap-3 rounded-xl border bg-card p-3.5 ${
                    c.deletedAt
                      ? 'border-border/50 opacity-50'
                      : 'border-border'
                  } ${isReply ? 'ml-10' : ''}`}
                >
                  <PlayerAvatar
                    name={name}
                    avatarUrl={c.avatarUrl}
                    className="size-8 shrink-0 text-xs"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                      <span className="text-sm font-semibold">{name}</span>
                      {isReply && (
                        <span className="text-xs text-muted-foreground">· reply</span>
                      )}
                      <span className="text-xs text-muted-foreground">
                        <LocalTime iso={c.createdAt.toISOString()} />
                      </span>
                      {c.deletedAt && (
                        <span className="text-xs text-danger">deleted</span>
                      )}
                    </div>
                    {c.deletedAt ? (
                      <p className="mt-1 text-sm italic text-muted-foreground">
                        [This comment was deleted]
                      </p>
                    ) : (
                      <p className="mt-1 whitespace-pre-wrap break-words text-sm">{c.body}</p>
                    )}
                  </div>
                  {!c.deletedAt && (
                    <ConfirmActionButton
                      action={adminDeleteComment}
                      fields={{ id: c.id, matchId: id }}
                      title="Delete comment"
                      message={`Delete ${name}'s comment? Players will see "[deleted]" in its place.`}
                      confirmLabel="Delete"
                      busyLabel="Deleting…"
                      className="shrink-0 self-start rounded-md p-1.5 text-muted-foreground transition hover:bg-danger/10 hover:text-danger"
                      ariaLabel="Delete comment"
                    >
                      <Trash2 className="size-4" />
                    </ConfirmActionButton>
                  )}
                </div>
              );
            })
          )}
        </div>
      </section>
    </div>
  );
}
