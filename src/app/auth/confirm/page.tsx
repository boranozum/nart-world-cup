'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

/**
 * Handles implicit-flow auth redirects (tokens in URL hash fragment).
 * /auth/callback cannot forward the hash via a server redirect, so it serves
 * a tiny script that does `window.location.replace('/auth/confirm' + hash)`.
 * This page then explicitly reads the hash and calls setSession().
 */
export default function ConfirmPage() {
  const router = useRouter();

  useEffect(() => {
    const hash = window.location.hash.slice(1);
    const params = new URLSearchParams(hash);
    const access_token = params.get('access_token');
    const refresh_token = params.get('refresh_token');

    if (!access_token || !refresh_token) {
      router.replace('/login?error=missing_code');
      return;
    }

    const supabase = createClient();

    supabase.auth.setSession({ access_token, refresh_token }).then(async ({ data: { session }, error }) => {
      if (error || !session) {
        router.replace('/login?error=auth');
        return;
      }

      if (session.user.app_metadata?.blocked) {
        await supabase.auth.signOut();
        router.replace('/login?error=blocked');
        return;
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('onboarded_at, blocked_at')
        .eq('id', session.user.id)
        .maybeSingle();

      if (profile?.blocked_at) {
        await supabase.auth.signOut();
        router.replace('/login?error=blocked');
        return;
      }

      router.replace(profile?.onboarded_at ? '/' : '/onboarding');
    });
  }, [router]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-primary-strong text-white">
      <div className="size-8 animate-spin rounded-full border-2 border-white/20 border-t-white/80" />
      <p className="text-sm text-white/60">Signing you in…</p>
    </div>
  );
}
