import type { schema } from '@/lib/db';

export type TournamentPhase = (typeof schema.tournamentPhase.enumValues)[number];

export const PHASE_LABELS: Record<TournamentPhase, string> = {
  group: 'Group stage',
  round_of_32: 'Round of 32',
  round_of_16: 'Round of 16',
  quarter_final: 'Quarter-final',
  semi_final: 'Semi-final',
  third_place: 'Third place',
  final: 'Final',
};

export const PHASE_ORDER: TournamentPhase[] = [
  'group',
  'round_of_32',
  'round_of_16',
  'quarter_final',
  'semi_final',
  'third_place',
  'final',
];
