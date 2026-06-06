'use server';

import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { db, schema } from '@/lib/db';
import { requireAdmin } from '@/lib/admin/session';
import { createAdminClient } from '@/lib/supabase/admin';

export async function blockUser(fd: FormData): Promise<{ error: string } | void> {
  await requireAdmin();
  const userId = fd.get('userId') as string;
  if (!userId) return { error: 'Missing userId' };

  await db
    .update(schema.profiles)
    .set({ blockedAt: new Date() })
    .where(eq(schema.profiles.id, userId));

  // Mark user as blocked in Supabase auth metadata so the proxy can check it
  // without a DB query, and prevent future token refreshes.
  const adminClient = createAdminClient();
  await adminClient.auth.admin.updateUserById(userId, {
    app_metadata: { blocked: true },
    ban_duration: '87600h',
  });

  revalidatePath('/admin/users');
}

export async function unblockUser(fd: FormData): Promise<{ error: string } | void> {
  await requireAdmin();
  const userId = fd.get('userId') as string;
  if (!userId) return { error: 'Missing userId' };

  await db
    .update(schema.profiles)
    .set({ blockedAt: null })
    .where(eq(schema.profiles.id, userId));

  const adminClient = createAdminClient();
  await adminClient.auth.admin.updateUserById(userId, {
    app_metadata: { blocked: false },
    ban_duration: 'none',
  });

  revalidatePath('/admin/users');
}
