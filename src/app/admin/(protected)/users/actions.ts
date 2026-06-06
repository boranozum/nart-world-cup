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

/** Generate a one-time magic link for an email address.
 * Creates a Supabase auth user if one doesn't exist yet (first-time invite).
 * Returns the action link to be shared by the admin — no email is sent automatically. */
export async function generateMagicLink(
  fd: FormData,
): Promise<{ link: string } | { error: string }> {
  await requireAdmin();
  const email = (fd.get('email') as string | null)?.trim().toLowerCase();
  if (!email) return { error: 'Email is required.' };

  const adminClient = createAdminClient();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL!;

  const { data, error } = await adminClient.auth.admin.generateLink({
    type: 'magiclink',
    email,
    options: { redirectTo: `${siteUrl}/auth/callback` },
  });

  if (error || !data?.properties?.action_link) {
    return { error: error?.message ?? 'Failed to generate magic link.' };
  }

  return { link: data.properties.action_link };
}
