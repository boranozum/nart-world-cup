'use server';

import { revalidatePath } from 'next/cache';
import { eq, or } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { requireAdmin } from '@/lib/admin/session';

export async function createTeam(formData: FormData) {
  await requireAdmin();
  const name = String(formData.get('name') ?? '').trim();
  if (!name) return;
  const shortName = String(formData.get('shortName') ?? '').trim() || null;
  // Strip all whitespace — a raw URL never contains spaces, and pasted URLs
  // often pick up stray ones (which silently break the image).
  const badgeUrl = String(formData.get('badgeUrl') ?? '').replace(/\s+/g, '') || null;

  await db.insert(schema.teams).values({ name, shortName, badgeUrl });
  revalidatePath('/admin/teams');
}

export async function deleteTeam(formData: FormData): Promise<{ error: string } | void> {
  await requireAdmin();
  const id = Number(formData.get('id'));
  if (!id) return;

  // A team referenced by any match can't be deleted (the FK has no cascade, and
  // cascading would silently destroy matches/predictions/results).
  const used = await db
    .select({ id: schema.matches.id })
    .from(schema.matches)
    .where(or(eq(schema.matches.teamAId, id), eq(schema.matches.teamBId, id)))
    .limit(1);
  if (used.length > 0) {
    return { error: 'This team is used in one or more matches. Delete those matches first.' };
  }

  // Players cascade-delete with the team.
  await db.delete(schema.teams).where(eq(schema.teams.id, id));
  revalidatePath('/admin/teams');
}
