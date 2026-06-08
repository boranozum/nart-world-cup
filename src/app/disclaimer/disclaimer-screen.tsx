'use client';

import { useState, useTransition } from 'react';
import { motion } from 'framer-motion';
import { ShieldCheck } from 'lucide-react';
import { acceptDisclaimer } from './actions';

export function DisclaimerScreen() {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function accept() {
    setError(null);
    startTransition(async () => {
      const res = await acceptDisclaimer();
      if (res?.error) setError(res.error);
      // success redirects server-side
    });
  }

  return (
    <main className="relative flex min-h-screen flex-col overflow-hidden bg-primary-strong text-white">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(1100px 560px at 12% -10%, #3b4daf55, transparent 60%), radial-gradient(900px 500px at 112% 18%, #f3712333, transparent 55%)',
        }}
      />

      <div className="relative z-10 flex flex-1 items-center justify-center px-6 py-10">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="w-full max-w-sm text-center"
        >
          <div className="mx-auto grid size-20 place-items-center rounded-2xl bg-accent/15 ring-1 ring-accent/30">
            <ShieldCheck className="size-9 text-accent" />
          </div>
          <h1 className="mt-7 font-display text-4xl font-extrabold uppercase leading-[0.95] tracking-tight">
            Before you continue
          </h1>
          <p className="mt-4 text-balance text-white/70">
            Nart World Cup is a free, points-only prediction game for TechNarts
            colleagues — leaderboard glory and bragging rights are the only prizes on
            the line. No real money, prizes, or stakes are involved, and this app must
            never be used to organize, host, or place real-money bets or wagering pools
            among colleagues. Standard TechNarts workplace conduct policies apply.
          </p>

          {error && (
            <p className="mt-3 rounded-lg bg-danger/15 px-4 py-2 text-sm text-red-200 ring-1 ring-danger/30">
              {error}
            </p>
          )}

          <button
            onClick={accept}
            disabled={pending}
            className="mt-9 w-full rounded-full bg-accent px-7 py-3.5 font-semibold text-accent-foreground transition hover:brightness-110 active:scale-[0.99] disabled:opacity-60"
          >
            {pending ? 'Saving…' : 'I understand and agree'}
          </button>
        </motion.div>
      </div>
    </main>
  );
}
