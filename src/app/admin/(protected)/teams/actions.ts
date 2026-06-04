'use server';

import { revalidatePath } from 'next/cache';
import { eq } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { requireAdmin } from '@/lib/admin/session';

export async function createTeam(formData: FormData) {
  await requireAdmin();
  const name = String(formData.get('name') ?? '').trim();
  if (!name) return;
  const shortName = String(formData.get('shortName') ?? '').trim() || null;
  const badgeUrl = String(formData.get('badgeUrl') ?? '').trim() || null;

  await db.insert(schema.teams).values({ name, shortName, badgeUrl });
  revalidatePath('/admin/teams');
}

export async function deleteTeam(formData: FormData) {
  await requireAdmin();
  const id = Number(formData.get('id'));
  if (!id) return;
  await db.delete(schema.teams).where(eq(schema.teams.id, id));
  revalidatePath('/admin/teams');
}
