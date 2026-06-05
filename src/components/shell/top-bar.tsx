import Image from 'next/image';
import Link from 'next/link';
import { Bell } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { ThemeToggle } from '@/components/theme-toggle';
import { DesktopNav } from './desktop-nav';
import { ProfileMenu } from './profile-menu';

export async function TopBar() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from('profiles')
    .select('username, avatar_url')
    .eq('id', user?.id ?? '')
    .maybeSingle();
  const name = profile?.username?.trim() || user?.email?.split('@')[0] || 'You';

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
          <ProfileMenu name={name} avatarUrl={profile?.avatar_url ?? null} />
        </div>
      </div>
    </header>
  );
}
