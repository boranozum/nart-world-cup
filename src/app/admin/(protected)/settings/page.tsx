import { db, schema } from '@/lib/db';
import { SettingsForm } from './settings-form';

export default async function SettingsPage() {
  // Singleton row (seeded in migration 0001); fall back to schema defaults defensively.
  const [settings] = await db.select().from(schema.leagueSettings).limit(1);

  return (
    <div className="max-w-2xl">
      <h1 className="font-display text-3xl font-extrabold uppercase tracking-tight">Settings</h1>
      <p className="mt-1 text-muted-foreground">
        League-wide configuration. Scoring changes apply the next time a match day is finalized —
        re-finalize an already-scored day to recompute it with the new weights.
      </p>

      <SettingsForm
        settings={{
          boosterTotal: settings?.boosterTotal ?? 5,
          outcomePts: settings?.outcomePts ?? 3,
          homeGoalsPts: settings?.homeGoalsPts ?? 2,
          awayGoalsPts: settings?.awayGoalsPts ?? 2,
          goalDiffPts: settings?.goalDiffPts ?? 3,
          firstTeamPts: settings?.firstTeamPts ?? 2,
          firstMinutePts: settings?.firstMinutePts ?? 8,
          motmPts: settings?.motmPts ?? 4,
        }}
      />
    </div>
  );
}
