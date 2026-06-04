import { Trophy } from 'lucide-react';

export default function LeaguePage() {
  return (
    <section>
      <h1 className="font-display text-3xl font-extrabold uppercase tracking-tight">League</h1>
      <p className="mt-1 text-muted-foreground">The company-wide standings will live here.</p>

      <div className="mt-8 grid place-items-center rounded-xl border border-dashed border-border bg-card/50 py-20 text-center">
        <Trophy className="size-8 text-muted-foreground" />
        <p className="mt-3 font-medium">Standings coming soon</p>
        <p className="text-sm text-muted-foreground">Ranks update after each match day is finalized.</p>
      </div>
    </section>
  );
}
