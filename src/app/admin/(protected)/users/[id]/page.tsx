import Link from 'next/link';
import { notFound } from 'next/navigation';
import { asc, eq, inArray } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { ArrowLeft } from 'lucide-react';
import { db, schema } from '@/lib/db';
import { requireAdmin } from '@/lib/admin/session';
import { PlayerAvatar } from '@/components/player-avatar';
import { LocalTime } from '@/components/local-time';

function displayName(p: { username: string | null; email: string }) {
  return p.username?.trim() || p.email.split('@')[0];
}

const FIRST_TEAM_LABELS: Record<string, string> = { A: 'Home', B: 'Away', none: 'None' };
const BUCKET_LABELS: Record<string, string> = {
  '0-10': "0–10'",
  '11-20': "11–20'",
  '21-30': "21–30'",
  '31-40': "31–40'",
  '41-50': "41–50'",
  '51-60': "51–60'",
  '61-70': "61–70'",
  '71-80': "71–80'",
  '81-90': "81–90'",
  '90+': "90+'",
  none: 'None',
};

export default async function AdminUserDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id: userId } = await params;

  const [profile] = await db
    .select()
    .from(schema.profiles)
    .where(eq(schema.profiles.id, userId))
    .limit(1);
  if (!profile) notFound();

  const teamA = alias(schema.teams, 'team_a');
  const teamB = alias(schema.teams, 'team_b');

  const preds = await db
    .select({
      id: schema.predictions.id,
      matchId: schema.predictions.matchId,
      scoreA: schema.predictions.scoreA,
      scoreB: schema.predictions.scoreB,
      firstScoringTeam: schema.predictions.firstScoringTeam,
      firstGoalBucket: schema.predictions.firstGoalBucket,
      boosterApplied: schema.predictions.boosterApplied,
      motmPlayerId: schema.predictions.motmPlayerId,
      kickoffUtc: schema.matches.kickoffUtc,
      matchStatus: schema.matches.status,
      matchDayId: schema.matches.matchDayId,
      matchDayName: schema.matchDays.name,
      matchDayStatus: schema.matchDays.status,
      matchDaySequence: schema.matchDays.sequence,
      teamAName: teamA.name,
      teamBName: teamB.name,
    })
    .from(schema.predictions)
    .innerJoin(schema.matches, eq(schema.predictions.matchId, schema.matches.id))
    .innerJoin(schema.matchDays, eq(schema.matches.matchDayId, schema.matchDays.id))
    .innerJoin(teamA, eq(schema.matches.teamAId, teamA.id))
    .innerJoin(teamB, eq(schema.matches.teamBId, teamB.id))
    .where(eq(schema.predictions.userId, userId))
    .orderBy(asc(schema.matchDays.sequence), asc(schema.matches.kickoffUtc));

  const predIds = preds.map((p) => p.id);
  const motmPlayerIds = [
    ...new Set(
      preds.map((p) => p.motmPlayerId).filter((id): id is number => id !== null),
    ),
  ];

  const [scores, motmPlayers] = await Promise.all([
    predIds.length
      ? db
          .select()
          .from(schema.predictionScores)
          .where(inArray(schema.predictionScores.predictionId, predIds))
      : Promise.resolve([]),
    motmPlayerIds.length
      ? db
          .select({ id: schema.players.id, name: schema.players.name })
          .from(schema.players)
          .where(inArray(schema.players.id, motmPlayerIds))
      : Promise.resolve([]),
  ]);

  const scoreMap = new Map(scores.map((s) => [s.predictionId, s]));
  const motmMap = new Map(motmPlayers.map((p) => [p.id, p.name]));

  type MatchDayGroup = {
    id: number;
    name: string;
    status: (typeof preds)[0]['matchDayStatus'];
    sequence: number;
    preds: typeof preds;
  };

  const matchDayGroupMap = new Map<number, MatchDayGroup>();
  for (const pred of preds) {
    if (!matchDayGroupMap.has(pred.matchDayId)) {
      matchDayGroupMap.set(pred.matchDayId, {
        id: pred.matchDayId,
        name: pred.matchDayName,
        status: pred.matchDayStatus,
        sequence: pred.matchDaySequence,
        preds: [],
      });
    }
    matchDayGroupMap.get(pred.matchDayId)!.preds.push(pred);
  }
  const matchDayGroups = [...matchDayGroupMap.values()].sort(
    (a, b) => a.sequence - b.sequence,
  );

  const name = displayName(profile);
  const isBlocked = profile.blockedAt !== null;

  return (
    <div className="max-w-5xl">
      <Link
        href="/admin/users"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Users
      </Link>

      {/* Profile header */}
      <div className="mt-4 flex items-center gap-4">
        <PlayerAvatar name={name} avatarUrl={profile.avatarUrl} className="size-14 text-xl" />
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="font-display text-3xl font-extrabold uppercase tracking-tight">
              {name}
            </h1>
            {isBlocked ? (
              <span className="inline-flex items-center rounded-full bg-danger/10 px-2 py-0.5 text-xs font-semibold text-danger">
                Blocked
              </span>
            ) : profile.onboardedAt ? (
              <span className="inline-flex items-center rounded-full bg-green-500/10 px-2 py-0.5 text-xs font-semibold text-green-600 dark:text-green-400">
                Active
              </span>
            ) : (
              <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground">
                Pending
              </span>
            )}
          </div>
          <p className="text-sm text-muted-foreground">{profile.email}</p>
        </div>
      </div>

      {/* Stats row */}
      <div className="mt-5 flex gap-8">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Total Points
          </p>
          <p className="font-display text-2xl font-bold tabular-nums">{profile.totalPoints}</p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Predictions
          </p>
          <p className="font-display text-2xl font-bold tabular-nums">{preds.length}</p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Joined
          </p>
          <p className="mt-0.5 text-sm text-muted-foreground">
            <LocalTime iso={profile.joinedAt.toISOString()} />
          </p>
        </div>
      </div>

      {/* Predictions by match day */}
      <div className="mt-8 space-y-8">
        <h2 className="font-display text-xl font-bold uppercase tracking-tight">Predictions</h2>

        {matchDayGroups.length === 0 ? (
          <p className="rounded-xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">
            No predictions yet.
          </p>
        ) : (
          matchDayGroups.map((md) => {
            const isActive = md.status === 'active';
            const isFinalized = md.status === 'finalized';

            return (
              <div key={md.id}>
                <div className="mb-2.5 flex items-center gap-2.5">
                  <h3 className="font-display text-base font-bold uppercase tracking-tight">
                    {md.name}
                  </h3>
                  {isActive && (
                    <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
                      Active
                    </span>
                  )}
                  {isFinalized && (
                    <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground">
                      Finalized
                    </span>
                  )}
                  {md.status === 'draft' && (
                    <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground">
                      Draft
                    </span>
                  )}
                </div>

                <div className="overflow-x-auto rounded-xl border border-border">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-muted/40 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        <th className="px-4 py-2.5">Match</th>
                        <th className="px-3 py-2.5">Kickoff</th>
                        <th className="px-3 py-2.5 text-center">Score</th>
                        <th className="px-3 py-2.5 text-center">1st Team</th>
                        <th className="px-3 py-2.5 text-center">1st Goal</th>
                        <th className="px-3 py-2.5">MOTM</th>
                        <th className="px-3 py-2.5 text-center">Boost</th>
                        {isFinalized && (
                          <th className="px-3 py-2.5 text-right">Pts</th>
                        )}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border bg-card">
                      {md.preds.map((pred) => {
                        const score = scoreMap.get(pred.id);
                        return (
                          <tr key={pred.id} className="transition hover:bg-muted/20">
                            <td className="px-4 py-2.5 font-medium">
                              {pred.teamAName}{' '}
                              <span className="text-muted-foreground">vs</span>{' '}
                              {pred.teamBName}
                            </td>
                            <td className="whitespace-nowrap px-3 py-2.5 text-muted-foreground">
                              <LocalTime iso={pred.kickoffUtc.toISOString()} />
                            </td>
                            <td className="px-3 py-2.5 text-center">
                              {pred.scoreA !== null && pred.scoreB !== null ? (
                                <span className="font-display font-bold tabular-nums">
                                  {pred.scoreA}–{pred.scoreB}
                                </span>
                              ) : (
                                <span className="text-muted-foreground/40">—</span>
                              )}
                            </td>
                            <td className="px-3 py-2.5 text-center text-muted-foreground">
                              {pred.firstScoringTeam ? (
                                FIRST_TEAM_LABELS[pred.firstScoringTeam]
                              ) : (
                                <span className="text-muted-foreground/40">—</span>
                              )}
                            </td>
                            <td className="px-3 py-2.5 text-center text-muted-foreground">
                              {pred.firstGoalBucket ? (
                                BUCKET_LABELS[pred.firstGoalBucket] ?? pred.firstGoalBucket
                              ) : (
                                <span className="text-muted-foreground/40">—</span>
                              )}
                            </td>
                            <td className="px-3 py-2.5 text-muted-foreground">
                              {pred.motmPlayerId ? (
                                motmMap.get(pred.motmPlayerId) ?? '—'
                              ) : (
                                <span className="text-muted-foreground/40">—</span>
                              )}
                            </td>
                            <td className="px-3 py-2.5 text-center">
                              {pred.boosterApplied ? (
                                <span className="inline-flex items-center rounded-full bg-accent/15 px-1.5 py-0.5 text-xs font-bold text-accent">
                                  2×
                                </span>
                              ) : (
                                <span className="text-muted-foreground/40">—</span>
                              )}
                            </td>
                            {isFinalized && (
                              <td className="px-3 py-2.5 text-right">
                                {score ? (
                                  <span className="font-display font-bold tabular-nums">
                                    {score.finalTotal}
                                  </span>
                                ) : (
                                  <span className="text-muted-foreground/40">—</span>
                                )}
                              </td>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
