'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, Search, X } from 'lucide-react';
import { PlayerFace } from '@/components/player-face';

export type SelectablePlayer = {
  id: number;
  name: string;
  faceUrl?: string | null;
  side: 'A' | 'B';
  teamName: string;
};

type Props = {
  players: SelectablePlayer[];
  value: number | null;
  onChange: (id: number | null) => void;
  disabled?: boolean;
  placeholder?: string;
};

/**
 * Searchable player picker showing face photos. Players are passed already
 * scoped to the relevant teams (e.g. the two teams in a match) — this component
 * only filters by the typed query.
 */
export function PlayerSelect({
  players,
  value,
  onChange,
  disabled,
  placeholder = 'Search players…',
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selected = useMemo(() => players.find((p) => p.id === value) ?? null, [players, value]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return players;
    return players.filter(
      (p) => p.name.toLowerCase().includes(q) || p.teamName.toLowerCase().includes(q),
    );
  }, [players, query]);

  // Close on outside click or Escape.
  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
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

  // Focus the search field when the menu opens (DOM is an external system).
  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  function toggle() {
    setQuery('');
    setOpen((v) => !v);
  }

  function pick(id: number | null) {
    onChange(id);
    setOpen(false);
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={toggle}
        className="flex w-full items-center gap-2 rounded-lg border border-input bg-background px-3 py-2 text-left text-sm outline-none transition focus:border-primary disabled:opacity-60"
      >
        {selected ? (
          <>
            <PlayerFace name={selected.name} faceUrl={selected.faceUrl} className="size-6" />
            <span className="min-w-0 flex-1 truncate">
              {selected.name}
              <span className="text-muted-foreground"> · {selected.teamName}</span>
            </span>
          </>
        ) : (
          <span className="flex-1 text-muted-foreground">— none —</span>
        )}
        {selected && !disabled ? (
          <span
            role="button"
            tabIndex={-1}
            aria-label="Clear man of the match"
            onClick={(e) => {
              e.stopPropagation();
              pick(null);
            }}
            className="rounded p-0.5 text-muted-foreground transition hover:bg-muted hover:text-foreground"
          >
            <X className="size-3.5" />
          </span>
        ) : (
          <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
        )}
      </button>

      {open && (
        <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-lg border border-border bg-card shadow-lg">
          <div className="flex items-center gap-2 border-b border-border px-3 py-2">
            <Search className="size-3.5 shrink-0 text-muted-foreground" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={placeholder}
              className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>
          <ul className="max-h-56 overflow-y-auto py-1">
            <li>
              <button
                type="button"
                onClick={() => pick(null)}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-muted-foreground transition hover:bg-muted"
              >
                <span className="grid size-6 shrink-0 place-items-center rounded-full border border-dashed border-border">
                  <X className="size-3" />
                </span>
                <span className="flex-1">— none —</span>
                {value === null && <Check className="size-4 text-primary" />}
              </button>
            </li>
            {filtered.length === 0 ? (
              <li className="px-3 py-3 text-center text-xs text-muted-foreground">No players found.</li>
            ) : (
              filtered.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => pick(p.id)}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition hover:bg-muted"
                  >
                    <PlayerFace name={p.name} faceUrl={p.faceUrl} className="size-6" />
                    <span className="min-w-0 flex-1 truncate">
                      {p.name}
                      <span className="text-muted-foreground"> · {p.teamName}</span>
                    </span>
                    {value === p.id && <Check className="size-4 shrink-0 text-primary" />}
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
