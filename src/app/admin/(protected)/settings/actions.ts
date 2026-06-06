'use server';

import { revalidatePath } from 'next/cache';
import { sql } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { requireAdmin } from '@/lib/admin/session';

/** Scoring-weight fields editable from the settings page (all non-negative ints). */
const POINT_FIELDS = [
  'outcomePts',
  'homeGoalsPts',
  'awayGoalsPts',
  'goalDiffPts',
  'firstTeamPts',
  'firstMinutePts',
  'motmPts',
] as const;

function readInt(formData: FormData, name: string): number | null {
  const raw = String(formData.get(name) ?? '').trim();
  if (raw === '') return null;
  const n = Number(raw);
  return Number.isInteger(n) && n >= 0 ? n : null;
}

/**
 * Update the singleton league_settings row: booster allotment and the per-component
 * scoring weights. New values take effect the next time a match day is finalized
 * (re-finalize an already-scored day to apply them retroactively).
 */
export async function updateSettings(formData: FormData): Promise<{ error: string } | { ok: true }> {
  await requireAdmin();

  const boosterTotal = readInt(formData, 'boosterTotal');
  if (boosterTotal === null) return { error: 'Booster total must be a non-negative whole number.' };

  const values: Record<string, number> = { boosterTotal };
  for (const field of POINT_FIELDS) {
    const v = readInt(formData, field);
    if (v === null) return { error: 'Point values must be non-negative whole numbers.' };
    values[field] = v;
  }

  await db.update(schema.leagueSettings).set(values).where(sql`${schema.leagueSettings.id}`);

  revalidatePath('/admin/settings');
  return { ok: true };
}
