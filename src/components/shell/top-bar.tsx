import Image from 'next/image';
import Link from 'next/link';
import { Bell } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { ThemeToggle } from '@/components/theme-toggle';
import { DesktopNav } from './desktop-nav';

function initials(email?: string | null): string {
  if (!email) return '?';
  return email[0]?.toUpperCase() ?? '?';
}

export async function TopBar() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-card/85 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-5xl items-center gap-3 px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="grid size-9 place-items-center overflow-hidden rounded-lg bg-white shadow-sm ring-1 ring-black/5">
            <Image src="/technarts-logo.jpeg" alt="TechNarts" width={28} height={28} priority />
          </span>
          <span className="font-display text-lg font-bold leading-none tracking-wide">
            Nart <span className="text-accent">World Cup</span>
          </span>
        </Link>

        <DesktopNav className="ml-6 hidden md:flex" />

        <div className="ml-auto flex items-center gap-1.5">
          <button
            type="button"
            aria-label="Notifications"
            className="relative inline-flex size-9 items-center justify-center rounded-full border border-border text-foreground/70 transition-colors hover:bg-muted hover:text-foreground"
          >
            <Bell className="size-4" />
          </button>
          <ThemeToggle />
          <Link
            href="/me"
            aria-label="Your profile"
            className="grid size-9 place-items-center rounded-full bg-primary font-display text-sm font-bold text-primary-foreground"
          >
            {initials(user?.email)}
          </Link>
        </div>
      </div>
    </header>
  );
}
