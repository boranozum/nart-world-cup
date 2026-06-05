'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { LogOut, User } from 'lucide-react';
import { PlayerAvatar } from '@/components/player-avatar';

export function ProfileMenu({ name, avatarUrl }: { name: string; avatarUrl: string | null }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Your profile"
        aria-haspopup="menu"
        aria-expanded={open}
        className="block rounded-full outline-none ring-offset-2 ring-offset-card transition focus-visible:ring-2 focus-visible:ring-ring"
      >
        <PlayerAvatar name={name} avatarUrl={avatarUrl} className="size-9 text-sm" />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 mt-2 w-44 overflow-hidden rounded-xl border border-border bg-card p-1 shadow-lg"
        >
          <div className="truncate px-3 py-2 text-xs text-muted-foreground">{name}</div>
          <Link
            href="/me"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition hover:bg-muted"
          >
            <User className="size-4" /> Profile
          </Link>
          <form action="/auth/signout" method="post">
            <button
              role="menuitem"
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-danger transition hover:bg-danger/10"
            >
              <LogOut className="size-4" /> Sign out
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
