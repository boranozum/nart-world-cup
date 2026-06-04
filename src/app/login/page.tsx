'use client';

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { ALLOWED_DOMAIN } from '@/lib/auth/domain';

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
        // Nudge Google's picker to the company domain (Workspace enforces it too).
        queryParams: { hd: ALLOWED_DOMAIN, prompt: 'select_account' },
      },
    });
    if (error) {
      setLoading(false);
      window.location.href = '/login?error=auth';
    }
    // On success the browser is redirected to Google.
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 p-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold tracking-tight">Nart World Cup</h1>
        <p className="mt-2 text-zinc-500">Predict. Compete. Win the office bragging rights.</p>
      </div>

      {error && (
        <p className="rounded-md bg-red-50 px-4 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </p>
      )}

      <button
        onClick={signIn}
        disabled={loading}
        className="flex h-12 items-center gap-3 rounded-full border border-zinc-300 bg-white px-6 font-medium text-zinc-800 transition-colors hover:bg-zinc-50 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
      >
        {loading ? 'Redirecting…' : 'Sign in with Google'}
      </button>

      <p className="text-xs text-zinc-400">Restricted to @{ALLOWED_DOMAIN} accounts.</p>
    </div>
  );
}

export default function LoginPage() {
  // useSearchParams requires a Suspense boundary during prerender.
  return (
    <Suspense>
      <LoginContent />
    </Suspense>
  );
}
