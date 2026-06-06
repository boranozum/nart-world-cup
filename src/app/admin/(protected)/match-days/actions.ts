'use server';

import { revalidatePath } from 'next/cache';
import { and, eq, isNotNull, ne, sql } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { requireAdmin } from '@/lib/admin/session';
import { GOAL_BUCKETS } from '@/lib/predictions';
import { getSportsAdapter } from '@/lib/api';
import type { FirstScoringTeam as CanonicalFST, GoalMinuteBucket } from '@/lib/api/types';

/** Pull WC fixtures for a date range and insert them into a match day. */
export async function importFixturesFromApi(formData: FormData): Promise<
  { imported: number; skipped: number } | { error: string }
> {
  await requireAdmin();
  const matchDayId = Number(formData.get('matchDayId'));
  const fromDate = String(formData.get('fromDate') ?? '').trim();
  const toDate = String(formData.get('toDate') ?? '').trim();
  if (!matchDayId || !fromDate || !toDate) return { error: 'Fill in both dates.' };

  try {
    const adapter = getSportsAdapter();
    const fixtures = await adapter.fetchMatches({ fromUtc: fromDate, toUtc: toDate });

    const allTeams = await db
      .select({ id: schema.teams.id, apiRef: schema.teams.apiRef })
      .from(schema.teams)
      .where(isNotNull(schema.teams.apiRef));
    const teamByRef = new Map(allTeams.map((t) => [t.apiRef!, t.id]));

    let imported = 0;
    let skipped = 0;
    const missing = new Set<string>();

    for (const f of fixtures) {
      const teamAId = teamByRef.get(f.homeTeamApiRef);
      const teamBId = teamByRef.get(f.awayTeamApiRef);
      if (!teamAId || !teamBId) {
        missing.add(f.homeTeamApiRef);
        missing.add(f.awayTeamApiRef);
        skipped++;
        continue;
      }

      // Skip duplicates (same apiRef already in any match day).
      const [dup] = await db
        .select({ id: schema.matches.id })
        .from(schema.matches)
        .where(eq(schema.matches.apiRef, f.apiRef))
        .limit(1);
      if (dup) { skipped++; continue; }

      await db.insert(schema.matches).values({
        matchDayId,
        teamAId,
        teamBId,
        kickoffUtc: new Date(f.kickoffUtc),
        apiRef: f.apiRef,
      });
      imported++;
    }

    revalidatePath(`/admin/match-days/${matchDayId}`);
    if (missing.size > 0) {
      return {
        error: `Imported ${imported}, skipped ${skipped}. Unknown API team refs (import teams first): ${[...missing].join(', ')}`,
      };
    }
    return { imported, skipped };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Import failed.' };
  }
}

/** Fetch a finished match result from the API so the admin can review before saving. */
export async function fetchMatchResultFromApi(matchId: number): Promise<
  | { scoreA: number; scoreB: number; firstScoringTeam: CanonicalFST; firstGoalBucket: GoalMinuteBucket }
  | { error: string }
> {
  await requireAdmin();
  const [match] = await db
    .select({ apiRef: schema.matches.apiRef })
    .from(schema.matches)
    .where(eq(schema.matches.id, matchId))
    .limit(1);

  if (!match?.apiRef) {
    return { error: 'This match has no API reference — import it via "Import fixtures" or set the ref manually.' };
  }

  try {
    const adapter = getSportsAdapter();
    const result = await adapter.fetchMatchResult(match.apiRef);
    if (!result) {
      return { error: 'Match result not available yet — the API may not have finalised it.' };
    }
    return {
      scoreA: result.scoreA,
      scoreB: result.scoreB,
      firstScoringTeam: result.firstScoringTeam,
      firstGoalBucket: result.firstGoalBucket as GoalBucket,
    };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'API fetch failed.' };
  }
}

export async function createMatchDay(formData: FormData) {
  await requireAdmin();
  const name = String(formData.get('name') ?? '').trim();
  const phase = String(formData.get('phase') ?? '') as (typeof schema.tournamentPhase.enumValues)[number];
  const sequence = Number(formData.get('sequence'));
  if (!name || !phase || !Number.isFinite(sequence)) return;

  await db.insert(schema.matchDays).values({ name, phase, sequence });
  revalidatePath('/admin/match-days');
}

export async function activateMatchDay(formData: FormData): Promise<{ error: string } | void> {
  await requireAdmin();
  const id = Number(formData.get('id'));
  if (!id) return;

  // Only one match day may be active at a time.
  const others = await db
    .select({ id: schema.matchDays.id })
    .from(schema.matchDays)
    .where(and(eq(schema.matchDays.status, 'active'), ne(schema.matchDays.id, id)));
  if (others.length > 0) {
    return { error: 'Another match day is already active. Finalize it first.' };
  }

  await db.update(schema.matchDays).set({ status: 'active' }).where(eq(schema.matchDays.id, id));
  revalidatePath('/admin/match-days');
  revalidatePath(`/admin/match-days/${id}`);
}

export async function createMatch(formData: FormData): Promise<{ error: string } | void> {
  await requireAdmin();
  const matchDayId = Number(formData.get('matchDayId'));
  const teamAId = Number(formData.get('teamAId'));
  const teamBId = Number(formData.get('teamBId'));
  const kickoffIso = String(formData.get('kickoffUtc') ?? '');
  if (!matchDayId || !teamAId || !teamBId || !kickoffIso) return { error: 'Fill in all fields.' };
  if (teamAId === teamBId) return { error: 'Pick two different teams.' };

  await db.insert(schema.matches).values({
    matchDayId,
    teamAId,
    teamBId,
    kickoffUtc: new Date(kickoffIso),
  });
  revalidatePath(`/admin/match-days/${matchDayId}`);
}

export async function deleteMatch(formData: FormData) {
  await requireAdmin();
  const id = Number(formData.get('id'));
  const matchDayId = Number(formData.get('matchDayId'));
  if (!id) return;
  await db.delete(schema.matches).where(eq(schema.matches.id, id));
  revalidatePath(`/admin/match-days/${matchDayId}`);
}

type FirstScoringTeam = (typeof schema.firstScoringTeam.enumValues)[number];
type GoalBucket = (typeof schema.goalMinuteBucket.enumValues)[number];

/** Record (or correct) a match result; marks the match concluded. */
export async function concludeMatch(formData: FormData): Promise<{ error: string } | void> {
  const { adminId } = await requireAdmin();
  const matchId = Number(formData.get('matchId'));
  const matchDayId = Number(formData.get('matchDayId'));
  const scoreA = Number(formData.get('scoreA'));
  const scoreB = Number(formData.get('scoreB'));
  const firstScoringTeam = String(formData.get('firstScoringTeam') ?? '') as FirstScoringTeam;
  const firstGoalBucket = String(formData.get('firstGoalBucket') ?? '') as GoalBucket;
  const motmRaw = String(formData.get('motmPlayerId') ?? '');
  const motmPlayerId = motmRaw ? Number(motmRaw) : null;

  if (!matchId) return { error: 'Missing match.' };
  if (!Number.isInteger(scoreA) || !Number.isInteger(scoreB) || scoreA < 0 || scoreB < 0) {
    return { error: 'Enter valid non-negative scores.' };
  }
  if (!schema.firstScoringTeam.enumValues.includes(firstScoringTeam)) {
    return { error: 'Pick the first scoring team.' };
  }
  if (!GOAL_BUCKETS.includes(firstGoalBucket)) {
    return { error: 'Pick the first-goal minute.' };
  }
  // Consistency: a 0-0 result has no scorer; a scored game must name a side.
  const goalless = scoreA === 0 && scoreB === 0;
  if (goalless && (firstScoringTeam !== 'none' || firstGoalBucket !== 'none')) {
    return { error: 'A 0-0 result has no first scorer or first-goal minute.' };
  }
  if (!goalless && (firstScoringTeam === 'none' || firstGoalBucket === 'none')) {
    return { error: 'A scored match needs a first scoring team and minute.' };
  }

  const values = {
    matchId,
    scoreA,
    scoreB,
    firstScoringTeam,
    firstGoalBucket,
    motmPlayerId,
    source: 'admin' as const,
    concludedBy: adminId,
    concludedAt: new Date(),
  };
  await db
    .insert(schema.matchResults)
    .values(values)
    .onConflictDoUpdate({ target: schema.matchResults.matchId, set: values });
  await db.update(schema.matches).set({ status: 'concluded' }).where(eq(schema.matches.id, matchId));

  revalidatePath(`/admin/match-days/${matchDayId}`);
}

/** Undo a conclusion (clear the result) so it can be re-entered. */
export async function reopenMatch(formData: FormData): Promise<{ error: string } | void> {
  await requireAdmin();
  const matchId = Number(formData.get('matchId'));
  const matchDayId = Number(formData.get('matchDayId'));
  if (!matchId) return { error: 'Missing match.' };
  await db.delete(schema.matchResults).where(eq(schema.matchResults.matchId, matchId));
  await db.update(schema.matches).set({ status: 'scheduled' }).where(eq(schema.matches.id, matchId));
  revalidatePath(`/admin/match-days/${matchDayId}`);
}

/** Run the scoring engine: compute points and snapshot the standings. */
export async function finalizeMatchDay(formData: FormData): Promise<{ error: string } | void> {
  await requireAdmin();
  const id = Number(formData.get('id'));
  if (!id) return { error: 'Missing match day.' };
  try {
    await db.execute(sql`select public.finalize_match_day(${id})`);
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Finalize failed.' };
  }
  revalidatePath('/admin/match-days');
  revalidatePath(`/admin/match-days/${id}`);
}

/** Reverse the most recent finalize. */
export async function unfinalizeMatchDay(formData: FormData): Promise<{ error: string } | void> {
  await requireAdmin();
  const id = Number(formData.get('id'));
  if (!id) return { error: 'Missing match day.' };
  try {
    await db.execute(sql`select public.unfinalize_match_day(${id})`);
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Un-finalize failed.' };
  }
  revalidatePath('/admin/match-days');
  revalidatePath(`/admin/match-days/${id}`);
}
