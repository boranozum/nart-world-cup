'use server';

import { revalidatePath } from 'next/cache';
import { eq } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { requireAdmin } from '@/lib/admin/session';

// A raw image URL never contains spaces; pasted ones often pick up stray
// whitespace that silently breaks the image. Strip it (mirrors team badges).
function cleanUrl(value: FormDataEntryValue | null): string | null {
  return String(value ?? '').replace(/\s+/g, '') || null;
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
