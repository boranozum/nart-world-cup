import { Goal } from 'lucide-react';

export default function PicksPage() {
  return (
    <section>
      <h1 className="font-display text-3xl font-extrabold uppercase tracking-tight">Picks</h1>
      <p className="mt-1 text-muted-foreground">The active match day&apos;s fixtures will live here.</p>

      <div className="mt-8 grid place-items-center rounded-xl border border-dashed border-border bg-card/50 py-20 text-center">
        <Goal className="size-8 text-muted-foreground" />
        <p className="mt-3 font-medium">No active match day yet</p>
        <p className="text-sm text-muted-foreground">Predictions open once an admin starts a match day.</p>
      </div>
    </section>
  );
}
