import Image from 'next/image';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { ThemeToggle } from '@/components/theme-toggle';
import { DesktopNav } from './desktop-nav';
import { ProfileMenu } from './profile-menu';
import { NotificationsBell, type Notif } from './notifications-bell';

export async function TopBar() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: profile }, { data: notifs }] = await Promise.all([
    supabase.from('profiles').select('username, avatar_url').eq('id', user?.id ?? '').maybeSingle(),
    supabase
      .from('notifications')
      .select('id, type, payload, read_at, created_at')
      .eq('user_id', user?.id ?? '')
      .order('created_at', { ascending: false })
      .limit(20),
  ]);
  const name = profile?.username?.trim() || user?.email?.split('@')[0] || 'You';

  const notifications: Notif[] = (notifs ?? []).map((n) => ({
    id: n.id,
    type: n.type,
    createdAt: new Date(n.created_at).toISOString(),
    readAt: n.read_at ? new Date(n.read_at).toISOString() : null,
    payload: (n.payload ?? {}) as Notif['payload'],
  }));
  const unreadCount = notifications.filter((n) => !n.readAt).length;

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
          <NotificationsBell notifications={notifications} unreadCount={unreadCount} />
          <ThemeToggle />
          <ProfileMenu name={name} avatarUrl={profile?.avatar_url ?? null} />
        </div>
      </div>
    </header>
  );
}
