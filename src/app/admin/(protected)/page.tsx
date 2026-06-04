import Link from 'next/link';
import { count } from 'drizzle-orm';
import { db, schema } from '@/lib/db';

export default async function AdminDashboard() {
  const [[teams], [matchDays], [matches], [players]] = await Promise.all([
    db.select({ n: count() }).from(schema.teams),
    db.select({ n: count() }).from(schema.matchDays),
    db.select({ n: count() }).from(schema.matches),
    db.select({ n: count() }).from(schema.profiles),
  ]);

  const stats = [
    { label: 'Teams', value: teams.n, href: '/admin/teams' },
    { label: 'Match days', value: matchDays.n, href: '/admin/match-days' },
    { label: 'Matches', value: matches.n, href: '/admin/match-days' },
    { label: 'Players', value: players.n, href: undefined },
  ];

  return (
    <div>
      <h1 className="font-display text-3xl font-extrabold uppercase tracking-tight">Dashboard</h1>
      <p className="mt-1 text-muted-foreground">Set up and run the tournament.</p>

      <div className="mt-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map((s) => {
          const card = (
            <div className="rounded-xl border border-border bg-card p-5">
              <p className="score text-4xl text-primary">{s.value}</p>
              <p className="mt-1 text-sm text-muted-foreground">{s.label}</p>
            </div>
          );
          return s.href ? (
            <Link key={s.label} href={s.href} className="transition hover:opacity-80">
              {card}
            </Link>
          ) : (
            <div key={s.label}>{card}</div>
          );
        })}
      </div>

      <div className="mt-8 flex flex-wrap gap-3">
        <Link
          href="/admin/teams"
          className="rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition hover:brightness-110"
        >
          Manage teams
        </Link>
        <Link
          href="/admin/match-days"
          className="rounded-full border border-border px-5 py-2.5 text-sm font-medium transition hover:bg-muted"
        >
          Manage match days
        </Link>
      </div>
    </div>
  );
}
