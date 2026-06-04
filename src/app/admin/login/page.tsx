'use client';

import { useActionState } from 'react';
import { adminLogin } from '../auth-actions';

export default function AdminLoginPage() {
  const [state, action, pending] = useActionState(adminLogin, null);

  return (
    <main className="flex min-h-screen items-center justify-center bg-primary-strong p-6 text-white">
      <form
        action={action}
        className="w-full max-w-sm rounded-2xl border border-white/10 bg-white/5 p-7 backdrop-blur"
      >
        <div className="mb-6 text-center">
          <p className="font-display text-xs uppercase tracking-[0.25em] text-accent">Admin</p>
          <h1 className="font-display text-3xl font-extrabold uppercase tracking-tight">
            Nart World Cup
          </h1>
        </div>

        <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-white/60">
          Username
        </label>
        <input
          name="username"
          autoCapitalize="none"
          autoCorrect="off"
          className="mb-4 w-full rounded-xl border border-white/15 bg-white/5 px-4 py-3 outline-none transition focus:border-accent focus:bg-white/10"
        />

        <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-white/60">
          Password
        </label>
        <input
          name="password"
          type="password"
          className="w-full rounded-xl border border-white/15 bg-white/5 px-4 py-3 outline-none transition focus:border-accent focus:bg-white/10"
        />

        {state?.error && (
          <p className="mt-4 rounded-lg bg-danger/15 px-4 py-2 text-sm text-red-200 ring-1 ring-danger/30">
            {state.error}
          </p>
        )}

        <button
          disabled={pending}
          className="mt-6 w-full rounded-full bg-accent px-7 py-3.5 font-semibold text-accent-foreground transition hover:brightness-110 active:scale-[0.99] disabled:opacity-60"
        >
          {pending ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </main>
  );
}
