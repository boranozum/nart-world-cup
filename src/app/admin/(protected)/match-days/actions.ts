'use server';

import { revalidatePath } from 'next/cache';
import { and, eq, ne } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { requireAdmin } from '@/lib/admin/session';

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
