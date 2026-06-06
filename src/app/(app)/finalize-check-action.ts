'use server';

import { and, asc, desc, eq, inArray } from 'drizzle-orm';
import { createClient } from '@/lib/supabase/server';
import { db, schema } from '@/lib/db';
import type { LeagueRow, MatchScore } from '@/components/finalize-animation';

export type FinalizationData = {
  snapshotId: string;
  matchDayName: string;
  matchScores: MatchScore[];
  leagueRows: LeagueRow[];
  top3: Pick<LeagueRow, 'displayName' | 'avatarUrl' | 'pointsThisDay'>[];
  myUserId: string;
};

export async function getFinalizationData(): Promise<FinalizationData | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [latestSnapshot] = await db
    .select({ id: schema.standingsSnapshots.id, matchDayId: schema.standingsSnapshots.matchDayId })
    .from(schema.standingsSnapshots)
    .where(eq(schema.standingsSnapshots.kind, 'match_day'))
    .orderBy(desc(schema.standingsSnapshots.createdAt))
    .limit(1);

  if (!latestSnapshot) return null;

  const [[matchDay], snapshotRows] = await Promise.all([
    latestSnapshot.matchDayId
      ? db
          .select({ name: schema.matchDays.name })
          .from(schema.matchDays)
          .where(eq(schema.matchDays.id, latestSnapshot.matchDayId))
      : Promise.resolve([undefined]),

    db
      .select({
        userId: schema.standingsSnapshotRows.userId,
        rank: schema.standingsSnapshotRows.rank,
        pointsThisDay: schema.standingsSnapshotRows.pointsThisDay,
        totalPoints: schema.standingsSnapshotRows.totalPoints,
        rankDelta: schema.standingsSnapshotRows.rankDelta,
        username: schema.profiles.username,
        avatarUrl: schema.profiles.avatarUrl,
        email: schema.profiles.email,
      })
      .from(schema.standingsSnapshotRows)
      .innerJoin(schema.profiles, eq(schema.standingsSnapshotRows.userId, schema.profiles.id))
      .where(eq(schema.standingsSnapshotRows.snapshotId, latestSnapshot.id))
      .orderBy(asc(schema.standingsSnapshotRows.rank)),
  ]);

  const leagueRows: LeagueRow[] = snapshotRows.map((r) => ({
    userId: r.userId,
    rank: r.rank,
    pointsThisDay: r.pointsThisDay,
    totalPoints: r.totalPoints,
    rankDelta: r.rankDelta,
    displayName: r.username?.trim() || r.email.split('@')[0],
    avatarUrl: r.avatarUrl,
  }));

  const matchScores: MatchScore[] = [];
  if (latestSnapshot.matchDayId) {
    const scores = await db
      .select({
        matchId: schema.predictionScores.matchId,
        finalTotal: schema.predictionScores.finalTotal,
        boosterApplied: schema.predictionScores.boosterApplied,
        teamAId: schema.matches.teamAId,
        teamBId: schema.matches.teamBId,
        scoreA: schema.matchResults.scoreA,
        scoreB: schema.matchResults.scoreB,
      })
      .from(schema.predictionScores)
      .innerJoin(schema.matches, eq(schema.predictionScores.matchId, schema.matches.id))
      .leftJoin(schema.matchResults, eq(schema.matches.id, schema.matchResults.matchId))
      .where(
        and(
          eq(schema.predictionScores.matchDayId, latestSnapshot.matchDayId),
          eq(schema.predictionScores.userId, user.id),
        ),
      )
      .orderBy(asc(schema.matches.kickoffUtc));

    if (scores.length > 0) {
      const allTeamIds = [...new Set(scores.flatMap((s) => [s.teamAId, s.teamBId]))];
      const teamsData = await db
        .select({ id: schema.teams.id, name: schema.teams.name, shortName: schema.teams.shortName })
        .from(schema.teams)
        .where(inArray(schema.teams.id, allTeamIds));
      const teamMap = new Map(teamsData.map((t) => [t.id, t]));

      for (const s of scores) {
        const teamA = teamMap.get(s.teamAId);
        const teamB = teamMap.get(s.teamBId);
        matchScores.push({
          matchId: s.matchId,
          teamAName: teamA?.name ?? '?',
          teamAShort: teamA?.shortName ?? null,
          teamBName: teamB?.name ?? '?',
          teamBShort: teamB?.shortName ?? null,
          scoreA: s.scoreA ?? null,
          scoreB: s.scoreB ?? null,
          finalTotal: s.finalTotal,
          boosterApplied: s.boosterApplied,
        });
      }
    }
  }

  const top3 = [...leagueRows]
    .sort((a, b) => b.pointsThisDay - a.pointsThisDay)
    .slice(0, 3)
    .filter((r) => r.pointsThisDay > 0);

  return {
    snapshotId: latestSnapshot.id,
    matchDayName: matchDay?.name ?? 'Match Day',
    matchScores,
    leagueRows,
    top3,
    myUserId: user.id,
  };
}
