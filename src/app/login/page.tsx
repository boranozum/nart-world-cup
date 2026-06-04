'use client';

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { createClient } from '@/lib/supabase/client';
import { ALLOWED_DOMAIN } from '@/lib/auth/domain';
import { ThemeToggle } from '@/components/theme-toggle';

const ERROR_MESSAGES: Record<string, string> = {
  domain: `Only @${ALLOWED_DOMAIN} accounts can sign in.`,
  auth: 'Sign-in failed. Please try again.',
  missing_code: 'Sign-in was interrupted. Please try again.',
};

function LoginContent() {
  const [loading, setLoading] = useState(false);
  const errorCode = useSearchParams().get('error');
  const error = errorCode ? ERROR_MESSAGES[errorCode] : null;

  async function signIn() {
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        queryParams: { hd: ALLOWED_DOMAIN, prompt: 'select_account' },
      },
    });
    if (error) {
      setLoading(false);
      window.location.href = '/login?error=auth';
    }
  }

  return (
    <main className="relative flex min-h-screen flex-col overflow-hidden bg-primary-strong text-white">
      {/* Atmosphere: navy gradient mesh + faint pitch lines */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.9]"
        style={{
          background:
            'radial-gradient(1200px 600px at 15% -10%, #3b4daf55, transparent 60%), radial-gradient(900px 500px at 110% 20%, #f3712333, transparent 55%)',
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.06]"
        style={{
          backgroundImage:
            'linear-gradient(to right, #fff 1px, transparent 1px), linear-gradient(to bottom, #fff 1px, transparent 1px)',
          backgroundSize: '64px 64px',
        }}
      />

      <header className="relative z-10 flex items-center justify-between p-6">
        <span className="font-display text-lg font-bold tracking-wide text-white/80">
          Tech<span className="text-accent">Narts</span>
        </span>
        <ThemeToggle className="border-white/20 text-white/70 hover:bg-white/10 hover:text-white" />
      </header>

      <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-6 pb-20 text-center">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-1.5 text-xs font-medium uppercase tracking-[0.2em] text-white/70"
        >
          World Cup 2026
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: 'easeOut', delay: 0.05 }}
          className="font-display text-6xl font-extrabold uppercase leading-[0.9] tracking-tight sm:text-7xl"
        >
          Nart
          <br />
          <span className="text-accent">World Cup</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: 'easeOut', delay: 0.15 }}
          className="mt-5 max-w-sm text-balance text-white/70"
        >
          Predict every match. Climb the table. Win the office bragging rights.
        </motion.p>

        {error && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mt-6 rounded-lg bg-danger/15 px-4 py-2 text-sm text-red-200 ring-1 ring-danger/30"
          >
            {error}
          </motion.p>
        )}

        <motion.button
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: 'easeOut', delay: 0.25 }}
          onClick={signIn}
          disabled={loading}
          className="group mt-9 inline-flex items-center gap-3 rounded-full bg-accent px-7 py-3.5 font-semibold text-accent-foreground shadow-[0_8px_30px_-8px] shadow-accent/60 transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-70"
        >
          <GoogleGlyph />
          {loading ? 'Redirecting…' : 'Sign in with Google'}
        </motion.button>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="mt-5 text-xs text-white/40"
        >
          Restricted to @{ALLOWED_DOMAIN} accounts
        </motion.p>
      </div>
    </main>
  );
}

function GoogleGlyph() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden className="shrink-0">
      <path
        fill="#fff"
        d="M21.35 11.1H12v3.83h5.35c-.23 1.4-1.66 4.1-5.35 4.1-3.22 0-5.85-2.66-5.85-5.94S8.78 7.16 12 7.16c1.83 0 3.06.78 3.76 1.45l2.56-2.47C16.7 4.6 14.6 3.7 12 3.7 6.96 3.7 2.9 7.76 2.9 12.8s4.06 9.1 9.1 9.1c5.25 0 8.73-3.69 8.73-8.89 0-.6-.06-1.05-.15-1.5l.77-.41z"
      />
    </svg>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginContent />
    </Suspense>
  );
}
