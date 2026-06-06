'use client';

import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowDown, ArrowUp, Check, Minus, Trophy, X, Zap } from 'lucide-react';
import { PlayerAvatar } from '@/components/player-avatar';

export type MatchScore = {
  matchId: number;
  teamAName: string;
  teamAShort: string | null;
  teamBName: string;
  teamBShort: string | null;
  scoreA: number | null;
  scoreB: number | null;
  finalTotal: number;
  boosterApplied: boolean;
};

export type LeagueRow = {
  userId: string;
  rank: number;
  pointsThisDay: number;
  totalPoints: number;
  rankDelta: number;
  displayName: string;
  avatarUrl: string | null;
};

type Props = {
  snapshotId: string;
  matchDayName: string;
  matchScores: MatchScore[];
  leagueRows: LeagueRow[];
  top3: Pick<LeagueRow, 'displayName' | 'avatarUrl' | 'pointsThisDay'>[];
  myUserId: string;
};

const SPRING = { type: 'spring', stiffness: 320, damping: 32 } as const;
const STORAGE_KEY = (id: string) => `seen_md_${id}`;

export function FinalizeAnimation({
  snapshotId,
  matchDayName,
  matchScores,
  leagueRows,
  top3,
  myUserId,
}: Props) {
  const hasMatches = matchScores.length > 0;
  const firstPhase = hasMatches ? 0 : 1;

  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);
  const [phase, setPhase] = useState(firstPhase);
  const myRowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
    if (!localStorage.getItem(STORAGE_KEY(snapshotId))) {
      setPhase(firstPhase);
      setVisible(true);
    }
  }, [snapshotId, firstPhase]);

  useEffect(() => {
    if (phase === 1) myRowRef.current?.scrollIntoView({ block: 'nearest' });
  }, [phase]);

  if (!mounted || !visible) return null;

  const phaseList = hasMatches ? [0, 1, 2] : [1, 2];
  const lastPhase = 2;

  const dismiss = () => {
    localStorage.setItem(STORAGE_KEY(snapshotId), '1');
    setVisible(false);
  };

  const next = () => {
    if (phase < lastPhase) setPhase((p) => p + 1);
    else dismiss();
  };

  const phaseTitle =
    phase === 0 ? 'Your Score' : phase === 1 ? 'Standings' : 'Top Scorers';

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="finalize-overlay"
          className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={dismiss}
          />

          {/* Panel */}
          <motion.div
            className="relative z-10 flex max-h-[80vh] w-full max-w-sm flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl"
            initial={{ y: 80, opacity: 0, scale: 0.96 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 80, opacity: 0, scale: 0.96 }}
            transition={SPRING}
          >
            {/* Header */}
            <div className="flex shrink-0 items-start justify-between px-5 pt-5 pb-2">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-accent">
                  {matchDayName} · Finalized
                </p>
                <h2 className="font-display text-2xl font-extrabold uppercase tracking-tight">
                  {phaseTitle}
                </h2>
              </div>
              <button
                type="button"
                onClick={dismiss}
                className="ml-3 mt-0.5 shrink-0 rounded-full p-1.5 text-muted-foreground transition hover:bg-muted"
                aria-label="Close"
              >
                <X className="size-4" />
              </button>
            </div>

            {/* Phase indicator dots */}
            <div className="flex shrink-0 justify-center gap-1.5 pb-3">
              {phaseList.map((p) => (
                <div
                  key={p}
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    p === phase ? 'w-5 bg-accent' : 'w-1.5 bg-muted-foreground/25'
                  }`}
                />
              ))}
            </div>

            {/* Scrollable phase content */}
            <div className="relative min-h-0 flex-1 overflow-hidden">
              <AnimatePresence mode="wait">
                <motion.div
                  key={phase}
                  className="h-full overflow-y-auto px-5 pb-2"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.16 }}
                >
                  {/* Phase 0: per-match score reveal */}
                  {phase === 0 && (
                    <div className="space-y-2.5 pb-1">
                      {matchScores.map((s, i) => (
                        <motion.div
                          key={s.matchId}
                          className="flex items-center gap-3 rounded-xl border border-border bg-background px-3.5 py-3"
                          initial={{ opacity: 0, y: 28 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: i * 0.1, ...SPRING }}
                        >
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold">
                              {s.teamAShort ?? s.teamAName}
                              <span className="mx-1.5 font-normal text-muted-foreground">
                                {s.scoreA ?? '?'} – {s.scoreB ?? '?'}
                              </span>
                              {s.teamBShort ?? s.teamBName}
                            </p>
                          </div>
                          <div className="flex shrink-0 items-center gap-1.5">
                            {s.boosterApplied && (
                              <span className="flex items-center gap-0.5 rounded bg-accent/15 px-1.5 py-0.5 text-xs font-bold text-accent">
                                <Zap className="size-3" />
                                ×2
                              </span>
                            )}
                            <motion.span
                              className={`rounded-lg px-2.5 py-1.5 font-display text-base font-extrabold tabular-nums ${
                                s.finalTotal > 0
                                  ? 'bg-success/15 text-success'
                                  : 'bg-muted text-muted-foreground'
                              }`}
                              initial={{ scale: 0.6, opacity: 0 }}
                              animate={{ scale: 1, opacity: 1 }}
                              transition={{ delay: i * 0.1 + 0.18, ...SPRING }}
                            >
                              +{s.finalTotal}
                            </motion.span>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  )}

                  {/* Phase 1: league table */}
                  {phase === 1 && (
                    <div className="space-y-1 pb-1">
                      {leagueRows.map((r, i) => {
                        const isMe = r.userId === myUserId;
                        return (
                          <motion.div
                            key={r.userId}
                            ref={isMe ? myRowRef : undefined}
                            className={`flex items-center gap-2 rounded-lg px-2 py-2 ${
                              isMe
                                ? 'bg-accent/10 ring-1 ring-inset ring-accent/30'
                                : 'bg-background'
                            }`}
                            initial={{ opacity: 0, x: -24 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: i * 0.04, ...SPRING }}
                          >
                            <span
                              className={`w-5 shrink-0 text-center font-display text-xs font-bold ${
                                r.rank === 1 ? 'text-accent' : 'text-muted-foreground'
                              }`}
                            >
                              {r.rank}
                            </span>
                            <PlayerAvatar
                              name={r.displayName}
                              avatarUrl={r.avatarUrl}
                              className="size-6 text-[9px]"
                            />
                            <span className="flex-1 truncate text-sm font-medium">
                              {r.displayName}
                              {isMe && (
                                <span className="ml-1 text-xs font-normal text-accent">
                                  You
                                </span>
                              )}
                            </span>
                            {r.rankDelta > 0 ? (
                              <span className="flex shrink-0 items-center gap-0.5 text-xs font-semibold text-success">
                                <ArrowUp className="size-3" />
                                {r.rankDelta}
                              </span>
                            ) : r.rankDelta < 0 ? (
                              <span className="flex shrink-0 items-center gap-0.5 text-xs font-semibold text-danger">
                                <ArrowDown className="size-3" />
                                {-r.rankDelta}
                              </span>
                            ) : (
                              <Minus className="size-3 shrink-0 text-muted-foreground/40" />
                            )}
                            {r.pointsThisDay > 0 && (
                              <span className="shrink-0 text-xs font-semibold text-accent">
                                +{r.pointsThisDay}
                              </span>
                            )}
                            <span className="w-9 shrink-0 text-right font-display text-sm font-bold tabular-nums">
                              {r.totalPoints}
                            </span>
                          </motion.div>
                        );
                      })}
                    </div>
                  )}

                  {/* Phase 2: top 3 scorers */}
                  {phase === 2 && (
                    <div className="space-y-3 py-1">
                      {top3.length === 0 ? (
                        <p className="py-8 text-center text-sm text-muted-foreground">
                          No predictions scored this match day.
                        </p>
                      ) : (
                        top3.map((p, i) => (
                          <motion.div
                            key={p.displayName + i}
                            className={`flex items-center gap-3 rounded-xl p-4 ${
                              i === 0
                                ? 'border border-accent/30 bg-accent/10'
                                : 'border border-border bg-background'
                            }`}
                            initial={{ opacity: 0, scale: 0.88 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: i * 0.15, ...SPRING }}
                          >
                            <div
                              className={`flex w-8 shrink-0 items-center justify-center font-display text-lg font-extrabold ${
                                i === 0 ? 'text-accent' : 'text-muted-foreground'
                              }`}
                            >
                              {i === 0 ? <Trophy className="size-5" /> : `#${i + 1}`}
                            </div>
                            <PlayerAvatar
                              name={p.displayName}
                              avatarUrl={p.avatarUrl}
                              className={i === 0 ? 'size-10 text-sm' : 'size-8 text-xs'}
                            />
                            <div className="min-w-0 flex-1">
                              <p className="truncate font-semibold">{p.displayName}</p>
                              <p className="text-xs text-muted-foreground">
                                +{p.pointsThisDay} pts this match day
                              </p>
                            </div>
                          </motion.div>
                        ))
                      )}
                    </div>
                  )}
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Footer CTA */}
            <div className="shrink-0 border-t border-border px-5 py-4">
              <button
                type="button"
                onClick={next}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-2.5 font-semibold text-primary-foreground transition hover:brightness-110 active:brightness-95"
              >
                {phase < lastPhase ? (
                  'Next'
                ) : (
                  <>
                    <Check className="size-4" />
                    Done
                  </>
                )}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
