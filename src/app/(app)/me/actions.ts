'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

const USERNAME_RE = /^[a-zA-Z0-9_]{3,20}$/;

/** Update the signed-in user's username and (optionally) avatar. */
export async function updateProfile(
  formData: FormData,
): Promise<{ error: string } | { ok: true }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Not signed in.' };

  const username = String(formData.get('username') ?? '').trim();
  if (!USERNAME_RE.test(username)) {
    return { error: 'Username must be 3–20 letters, numbers or underscores.' };
  }

  const update: { username: string; avatar_url?: string } = { username };

  const file = formData.get('avatar');
  if (file instanceof File && file.size > 0) {
    const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
    const path = `${user.id}/avatar.${ext}`;
    const admin = createAdminClient();
    const { error: upErr } = await admin.storage
      .from('avatars')
      .upload(path, file, { upsert: true, contentType: file.type });
    if (upErr) return { error: 'Avatar upload failed. Try a smaller image.' };
    const { data: pub } = admin.storage.from('avatars').getPublicUrl(path);
    update.avatar_url = `${pub.publicUrl}?v=${Date.now()}`;
  }

  const { error } = await supabase.from('profiles').update(update).eq('id', user.id);
  if (error) {
    if (error.code === '23505') return { error: 'That username is already taken.' };
    return { error: 'Could not save your profile. Please try again.' };
  }

  revalidatePath('/me');
  return { ok: true };
}
