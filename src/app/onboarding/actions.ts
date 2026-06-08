'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

const USERNAME_RE = /^[a-zA-Z0-9_]{3,20}$/;

export async function checkUsername(username: string): Promise<{ available: boolean }> {
  const name = username.trim();
  if (!USERNAME_RE.test(name)) return { available: false };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data } = await supabase
    .from('profiles')
    .select('id')
    .ilike('username', name)
    .maybeSingle();

  return { available: !data || data.id === user?.id };
}

export async function completeOnboarding(
  formData: FormData,
): Promise<{ error: string } | void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const username = String(formData.get('username') ?? '').trim();
  if (!USERNAME_RE.test(username)) {
    return { error: 'Username must be 3–20 letters, numbers or underscores.' };
  }

  // Keep an existing avatar URL (e.g. from Google) unless a new file was chosen.
  let avatarUrl = (formData.get('avatarUrl') as string) || null;
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
    avatarUrl = `${pub.publicUrl}?v=${Date.now()}`;
  }

  const now = new Date().toISOString();
  const { error } = await supabase
    .from('profiles')
    .update({
      username,
      avatar_url: avatarUrl,
      onboarded_at: now,
      disclaimer_accepted_at: now,
    })
    .eq('id', user.id);

  if (error) {
    if (error.code === '23505') return { error: 'That username is already taken.' };
    return { error: 'Could not save your profile. Please try again.' };
  }

  // Mirrors the `blocked` flag: stored in auth metadata so the proxy can
  // gate every request for the no-real-money disclaimer without a DB query.
  const admin = createAdminClient();
  await admin.auth.admin.updateUserById(user.id, {
    app_metadata: { disclaimer_accepted: true },
  });

  redirect('/');
}
