'use client';

import { useState, useTransition } from 'react';
import { Check } from 'lucide-react';
import { updateSettings } from './actions';

export type SettingsValues = {
  boosterTotal: number;
  outcomePts: number;
  homeGoalsPts: number;
  awayGoalsPts: number;
  goalDiffPts: number;
  firstTeamPts: number;
  firstMinutePts: number;
  motmPts: number;
};

/** Per-component scoring weights, in the order they appear on a prediction. */
const POINT_FIELDS: { name: keyof SettingsValues; label: string; hint: string }[] = [
  { name: 'outcomePts', label: 'Correct outcome', hint: 'Win / draw / loss direction' },
  { name: 'homeGoalsPts', label: 'Home-team goals', hint: 'Exact home score' },
  { name: 'awayGoalsPts', label: 'Away-team goals', hint: 'Exact away score' },
  { name: 'goalDiffPts', label: 'Goal difference', hint: 'Correct margin' },
  { name: 'firstTeamPts', label: 'First-scoring team', hint: 'Who scored first' },
  { name: 'firstMinutePts', label: 'First-goal minute', hint: 'Correct minute bucket' },
  { name: 'motmPts', label: 'Man of the match', hint: 'Correct MOTM player' },
];

function NumberField({
  name,
  label,
  hint,
  defaultValue,
}: {
  name: string;
  label: string;
  hint?: string;
  defaultValue: number;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <div>
        <label htmlFor={name} className="block text-sm font-medium">
          {label}
        </label>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </div>
      <input
        id={name}
        name={name}
        type="number"
        min={0}
        step={1}
        required
        defaultValue={defaultValue}
        className="w-20 rounded-lg border border-input bg-background px-3 py-2 text-right tabular-nums outline-none focus:border-primary"
      />
    </div>
  );
}

export function SettingsForm({ settings }: { settings: SettingsValues }) {
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const res = await updateSettings(fd);
      if ('error' in res) {
        setError(res.error);
        return;
      }
      setSaved(true);
    });
  }

  return (
    <form onSubmit={onSubmit} className="mt-6 space-y-6">
      <section className="rounded-xl border border-border bg-card p-5">
        <h2 className="font-display text-lg font-bold uppercase tracking-tight">Boosters</h2>
        <p className="mb-2 text-sm text-muted-foreground">x2 boosters each player gets for the tournament.</p>
        <NumberField name="boosterTotal" label="Boosters per player" defaultValue={settings.boosterTotal} />
      </section>

      <section className="rounded-xl border border-border bg-card p-5">
        <h2 className="font-display text-lg font-bold uppercase tracking-tight">Prediction points</h2>
        <p className="text-sm text-muted-foreground">
          Points awarded per correct component. They stack, so a perfect prediction earns the sum of all of them.
        </p>
        <div className="mt-2 divide-y divide-border">
          {POINT_FIELDS.map((f) => (
            <NumberField
              key={f.name}
              name={f.name}
              label={f.label}
              hint={f.hint}
              defaultValue={settings[f.name]}
            />
          ))}
        </div>
      </section>

      <div className="flex items-center gap-3">
        <button
          disabled={pending}
          className="rounded-lg bg-primary px-5 py-2 font-semibold text-primary-foreground transition hover:brightness-110 disabled:opacity-60"
        >
          {pending ? 'Saving…' : 'Save settings'}
        </button>
        {saved && !pending && (
          <span className="inline-flex items-center gap-1 text-sm font-medium text-success">
            <Check className="size-4" /> Saved
          </span>
        )}
        {error && <span className="text-sm text-danger">{error}</span>}
      </div>
    </form>
  );
}
