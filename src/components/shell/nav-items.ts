import { CalendarDays, Goal, Trophy, User, type LucideIcon } from 'lucide-react';

export type NavItem = { href: string; label: string; icon: LucideIcon };

/** Primary navigation, shared by the desktop top bar and mobile bottom tabs. */
export const NAV_ITEMS: NavItem[] = [
  { href: '/', label: 'Picks', icon: Goal },
  { href: '/league', label: 'League', icon: Trophy },
  { href: '/match-days', label: 'Match Days', icon: CalendarDays },
  { href: '/me', label: 'Me', icon: User },
];

export function isActive(pathname: string, href: string): boolean {
  return href === '/' ? pathname === '/' : pathname.startsWith(href);
}
