'use server';

import { revalidatePath } from 'next/cache';
import { eq, or } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { requireAdmin } from '@/lib/admin/session';
import { getSportsAdapter } from '@/lib/api';

export async function updateTeam(formData: FormData): Promise<{ error: string } | void> {
  await requireAdmin();
  const id = Number(formData.get('id'));
  if (!id) return;
  const name = String(formData.get('name') ?? '').trim();
  if (!name) return { error: 'Name is required.' };
  const shortName = String(formData.get('shortName') ?? '').trim() || null;
  const badgeUrl = String(formData.get('badgeUrl') ?? '').replace(/\s+/g, '') || null;

  await db.update(schema.teams).set({ name, shortName, badgeUrl }).where(eq(schema.teams.id, id));
  revalidatePath('/admin/teams');
}

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

export async function importTeamsFromApi(): Promise<
  { imported: number; updated: number } | { error: string }
> {
  await requireAdmin();
  try {
    const adapter = getSportsAdapter();
    const teams = await adapter.fetchTeams();

    let imported = 0;
    let updated = 0;
    for (const t of teams) {
      const [existing] = await db
        .select({ id: schema.teams.id })
        .from(schema.teams)
        .where(eq(schema.teams.apiRef, t.apiRef))
        .limit(1);

      if (existing) {
        await db
          .update(schema.teams)
          .set({ name: t.name, shortName: t.shortName ?? null, badgeUrl: t.badgeUrl ?? null })
          .where(eq(schema.teams.id, existing.id));
        updated++;
      } else {
        await db.insert(schema.teams).values({
          name: t.name,
          shortName: t.shortName ?? null,
          badgeUrl: t.badgeUrl ?? null,
          apiRef: t.apiRef,
        });
        imported++;
      }
    }
    revalidatePath('/admin/teams');
    return { imported, updated };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Import failed.' };
  }
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
