'use server';

import { revalidatePath } from 'next/cache';
import { eq } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { requireAdmin } from '@/lib/admin/session';

export async function adminDeleteComment(
  formData: FormData,
): Promise<{ error: string } | void> {
  await requireAdmin();
  const id = String(formData.get('id') ?? '');
  const matchId = Number(formData.get('matchId'));
  if (!id || !matchId) return { error: 'Missing fields.' };

  await db
    .update(schema.comments)
    .set({ deletedAt: new Date() })
    .where(eq(schema.comments.id, id));

  revalidatePath(`/admin/matches/${matchId}`);
  revalidatePath(`/match/${matchId}`);
}
