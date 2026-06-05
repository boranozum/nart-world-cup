'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Bell } from 'lucide-react';
import { PlayerAvatar } from '@/components/player-avatar';
import { LocalTime } from '@/components/local-time';
import { markNotificationsRead } from './notifications-actions';

export type Notif = {
  id: string;
  type: string;
  createdAt: string;
  readAt: string | null;
  payload: {
    comment_id?: string;
    match_id?: number;
    actor_name?: string;
    actor_avatar?: string | null;
    snippet?: string;
  };
};

function href(n: Notif): string {
  const p = n.payload;
  if (!p.match_id) return '#';
  return `/match/${p.match_id}${p.comment_id ? `#comment-${p.comment_id}` : ''}`;
}

export function NotificationsBell({
  notifications,
  unreadCount,
}: {
  notifications: Notif[];
  unreadCount: number;
}) {
  const router = useRouter();
  const ref = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [, startTransition] = useTransition();

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

  function markAll() {
    startTransition(async () => {
      await markNotificationsRead();
      router.refresh();
    });
  }

  function openItem(n: Notif) {
    setOpen(false);
    if (!n.readAt) {
      startTransition(async () => {
        await markNotificationsRead([n.id]);
        router.refresh();
      });
    }
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Notifications"
        className="relative inline-flex size-9 items-center justify-center rounded-full border border-border text-foreground/70 transition-colors hover:bg-muted hover:text-foreground"
      >
        <Bell className="size-4" />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 grid min-w-4 place-items-center rounded-full bg-accent px-1 text-[10px] font-bold leading-4 text-accent-foreground">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-border bg-card shadow-lg">
          <div className="flex items-center justify-between border-b border-border px-3 py-2">
            <span className="text-sm font-semibold">Notifications</span>
            {unreadCount > 0 && (
              <button onClick={markAll} className="text-xs font-medium text-accent hover:underline">
                Mark all read
              </button>
            )}
          </div>

          {notifications.length === 0 ? (
            <p className="px-3 py-8 text-center text-sm text-muted-foreground">No notifications yet.</p>
          ) : (
            <ul className="max-h-96 overflow-y-auto">
              {notifications.map((n) => (
                <li key={n.id}>
                  <Link
                    href={href(n)}
                    onClick={() => openItem(n)}
                    className={`flex gap-2.5 px-3 py-2.5 transition hover:bg-muted ${
                      n.readAt ? '' : 'bg-accent/5'
                    }`}
                  >
                    <PlayerAvatar
                      name={n.payload.actor_name ?? '?'}
                      avatarUrl={n.payload.actor_avatar ?? null}
                      className="size-8 shrink-0 text-xs"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm">
                        <span className="font-semibold">{n.payload.actor_name ?? 'Someone'}</span>{' '}
                        mentioned you
                      </p>
                      {n.payload.snippet && (
                        <p className="truncate text-xs text-muted-foreground">{n.payload.snippet}</p>
                      )}
                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                        <LocalTime iso={n.createdAt} />
                      </p>
                    </div>
                    {!n.readAt && <span className="mt-1 size-2 shrink-0 rounded-full bg-accent" />}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
