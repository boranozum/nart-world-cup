'use server';

import { createClient } from '@/lib/supabase/server';

/** Mark notifications read (all unread, or a specific set). */
export async function markNotificationsRead(ids?: string[]): Promise<{ error: string } | { ok: true }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Not signed in.' };

  let q = supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('user_id', user.id)
    .is('read_at', null);
  if (ids?.length) q = q.in('id', ids);
  await q;
  return { ok: true };
}
