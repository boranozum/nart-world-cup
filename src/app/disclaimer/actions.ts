'use server';

import { redirect } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function acceptDisclaimer(): Promise<{ error: string } | void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  await db
    .update(schema.profiles)
    .set({ disclaimerAcceptedAt: new Date() })
    .where(eq(schema.profiles.id, user.id));

  // Mirrors the `blocked` flag: stored in auth metadata so the proxy can
  // gate every request without a DB round-trip.
  const adminClient = createAdminClient();
  const { error } = await adminClient.auth.admin.updateUserById(user.id, {
    app_metadata: { disclaimer_accepted: true },
  });
  if (error) return { error: 'Could not save your acknowledgement. Please try again.' };

  redirect('/');
}
