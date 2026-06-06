'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

/**
 * Handles implicit-flow auth redirects (tokens in URL hash fragment).
 * Supabase uses implicit flow for admin-generated magic links.
 * The browser client auto-detects and processes #access_token when getSession() is called.
 */
export default function ConfirmPage() {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) {
        router.replace('/login?error=missing_code');
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
