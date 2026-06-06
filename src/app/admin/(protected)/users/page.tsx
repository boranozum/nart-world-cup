import { count, desc, eq } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { requireAdmin } from '@/lib/admin/session';
import { createAdminClient } from '@/lib/supabase/admin';
import { PlayerAvatar } from '@/components/player-avatar';
import { LocalTime } from '@/components/local-time';
import { UserActionsMenu } from './user-actions-menu';

function displayName(p: { username: string | null; email: string }) {
  return p.username?.trim() || p.email.split('@')[0];
}

export default async function AdminUsersPage() {
  await requireAdmin();

  const [profiles, predCounts, authResult] = await Promise.all([
    db
      .select({
        id: schema.profiles.id,
        email: schema.profiles.email,
        username: schema.profiles.username,
        avatarUrl: schema.profiles.avatarUrl,
        totalPoints: schema.profiles.totalPoints,
        joinedAt: schema.profiles.joinedAt,
        onboardedAt: schema.profiles.onboardedAt,
        blockedAt: schema.profiles.blockedAt,
      })
      .from(schema.profiles)
      .orderBy(desc(schema.profiles.totalPoints)),

    db
      .select({
        userId: schema.predictions.userId,
        predCount: count(),
      })
      .from(schema.predictions)
      .groupBy(schema.predictions.userId),

    createAdminClient()
      .auth.admin.listUsers({ perPage: 1000 })
      .then((r) => r.data?.users ?? []),
  ]);

  const predMap = new Map(predCounts.map((r) => [r.userId, r.predCount]));
  const lastLoginMap = new Map(
    authResult.map((u) => [u.id, u.last_sign_in_at ?? null]),
  );

  return (
    <div className="max-w-6xl">
      <h1 className="font-display text-3xl font-extrabold uppercase tracking-tight">Users</h1>
      <p className="mt-1 text-muted-foreground">
        {profiles.length} registered player{profiles.length !== 1 ? 's' : ''}.
      </p>

      <div className="mt-6 overflow-x-auto rounded-xl border border-border">
        {profiles.length === 0 ? (
          <p className="bg-card p-6 text-center text-sm text-muted-foreground">
            No users yet.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-2.5">Player</th>
                <th className="px-3 py-2.5 text-right">Points</th>
                <th className="px-3 py-2.5 text-right">Predictions</th>
                <th className="px-3 py-2.5">Last Login</th>
                <th className="px-3 py-2.5">Joined</th>
                <th className="px-3 py-2.5">Status</th>
                <th className="px-3 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border bg-card">
              {profiles.map((p) => {
                const name = displayName(p);
                const lastLogin = lastLoginMap.get(p.id);
                const predCount = predMap.get(p.id) ?? 0;
                const isBlocked = p.blockedAt !== null;

                return (
                  <tr key={p.id} className="transition hover:bg-muted/20">
                    {/* Player */}
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2.5">
                        <PlayerAvatar
                          name={name}
                          avatarUrl={p.avatarUrl}
                          className="size-8 text-xs"
                        />
                        <div className="min-w-0">
                          <p className="truncate font-medium leading-tight">{name}</p>
                          <p className="truncate text-xs text-muted-foreground">{p.email}</p>
                        </div>
                      </div>
                    </td>

                    {/* Points */}
                    <td className="px-3 py-2.5 text-right font-display font-bold tabular-nums">
                      {p.totalPoints}
                    </td>

                    {/* Predictions */}
                    <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">
                      {predCount}
                    </td>

                    {/* Last login */}
                    <td className="px-3 py-2.5 text-muted-foreground">
                      {lastLogin ? (
                        <LocalTime iso={new Date(lastLogin).toISOString()} />
                      ) : (
                        <span className="text-muted-foreground/50">—</span>
                      )}
                    </td>

                    {/* Joined */}
                    <td className="px-3 py-2.5 text-muted-foreground">
                      <LocalTime iso={p.joinedAt.toISOString()} />
                    </td>

                    {/* Status */}
                    <td className="px-3 py-2.5">
                      {isBlocked ? (
                        <span className="inline-flex items-center rounded-full bg-danger/10 px-2 py-0.5 text-xs font-semibold text-danger">
                          Blocked
                        </span>
                      ) : p.onboardedAt ? (
                        <span className="inline-flex items-center rounded-full bg-green-500/10 px-2 py-0.5 text-xs font-semibold text-green-600 dark:text-green-400">
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground">
                          Pending
                        </span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="px-3 py-2.5">
                      <UserActionsMenu
                        userId={p.id}
                        displayName={name}
                        isBlocked={isBlocked}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
