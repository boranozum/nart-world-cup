'use server';

import { revalidatePath } from 'next/cache';
import { eq, isNotNull } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { requireAdmin } from '@/lib/admin/session';
import { getSportsAdapter } from '@/lib/api';

// A raw image URL never contains spaces; pasted ones often pick up stray
// whitespace that silently breaks the image. Strip it (mirrors team badges).
function cleanUrl(value: FormDataEntryValue | null): string | null {
  return String(value ?? '').replace(/\s+/g, '') || null;
}

export async function syncSquadsFromApi(): Promise<
  { imported: number; updated: number } | { error: string }
> {
  await requireAdmin();
  try {
    const teams = await db
      .select({ id: schema.teams.id, apiRef: schema.teams.apiRef })
      .from(schema.teams)
      .where(isNotNull(schema.teams.apiRef));

    if (teams.length === 0) {
      return { error: 'No teams with API references found. Import teams from the API first.' };
    }

    const adapter = getSportsAdapter();

    // 300 req/min ≈ 5 req/sec. Process in batches of 5 with a 1-second pause
    // between batches to respect the per-second burst limit.
    const BATCH = 5;
    const results: { team: (typeof teams)[number]; players: Awaited<ReturnType<typeof adapter.fetchPlayers>> }[] = [];
    for (let i = 0; i < teams.length; i += BATCH) {
      const batch = teams.slice(i, i + BATCH);
      const batchResults = await Promise.all(
        batch.map((team) => adapter.fetchPlayers(team.apiRef!).then((players) => ({ team, players }))),
      );
      results.push(...batchResults);
      if (i + BATCH < teams.length) await new Promise((r) => setTimeout(r, 1000));
    }

    const existingRows = await db
      .select({ apiRef: schema.players.apiRef })
      .from(schema.players)
      .where(isNotNull(schema.players.apiRef));
    const existingRefs = new Set(existingRows.map((r) => r.apiRef!));

    const allPlayers = results.flatMap(({ team, players }) =>
      players.map((p) => ({ name: p.name, teamId: team.id, apiRef: p.apiRef, faceUrl: p.faceUrl ?? null })),
    );

    const toInsert = allPlayers.filter((p) => !existingRefs.has(p.apiRef));
    const toUpdate = allPlayers.filter((p) => existingRefs.has(p.apiRef) && p.faceUrl);

    if (toInsert.length > 0) {
      await db.insert(schema.players).values(toInsert);
    }
    if (toUpdate.length > 0) {
      await Promise.all(
        toUpdate.map((p) =>
          db.update(schema.players).set({ faceUrl: p.faceUrl }).where(eq(schema.players.apiRef, p.apiRef)),
        ),
      );
    }

    revalidatePath('/admin/players');
    return { imported: toInsert.length, updated: toUpdate.length };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Sync failed.' };
  }
}

export async function createPlayer(formData: FormData) {
  await requireAdmin();
  const name = String(formData.get('name') ?? '').trim();
  const teamId = Number(formData.get('teamId'));
  if (!name || !teamId) return;
  const faceUrl = cleanUrl(formData.get('faceUrl'));

  await db.insert(schema.players).values({ name, teamId, faceUrl });
  revalidatePath('/admin/players');
}

export async function updatePlayer(formData: FormData): Promise<{ error: string } | void> {
  await requireAdmin();
  const id = Number(formData.get('id'));
  const name = String(formData.get('name') ?? '').trim();
  const teamId = Number(formData.get('teamId'));
  if (!id) return;
  if (!name || !teamId) return { error: 'Name and team are required.' };
  const faceUrl = cleanUrl(formData.get('faceUrl'));

  await db
    .update(schema.players)
    .set({ name, teamId, faceUrl })
    .where(eq(schema.players.id, id));
  revalidatePath('/admin/players');
}

export async function deletePlayer(formData: FormData): Promise<{ error: string } | void> {
  await requireAdmin();
  const id = Number(formData.get('id'));
  if (!id) return;

  // A player named man-of-the-match in any result or prediction can't be deleted
  // (those FKs have no cascade). Surface a friendly message instead of a 500.
  const [usedResult, usedPrediction] = await Promise.all([
    db
      .select({ matchId: schema.matchResults.matchId })
      .from(schema.matchResults)
      .where(eq(schema.matchResults.motmPlayerId, id))
      .limit(1),
    db
      .select({ id: schema.predictions.id })
      .from(schema.predictions)
      .where(eq(schema.predictions.motmPlayerId, id))
      .limit(1),
  ]);
  if (usedResult.length > 0 || usedPrediction.length > 0) {
    return {
      error: 'This player is used as man of the match in a result or prediction and can’t be deleted.',
    };
  }

  await db.delete(schema.players).where(eq(schema.players.id, id));
  revalidatePath('/admin/players');
}
