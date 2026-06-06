import type { SportsApiAdapter } from '../adapter';
import type {
  CanonicalMatch,
  CanonicalMatchResult,
  CanonicalPlayer,
  CanonicalTeam,
  GoalMinuteBucket,
} from '../types';

const BASE = 'https://v3.football.api-sports.io';
const WC_LEAGUE = 1;
// Override via API_FOOTBALL_SEASON for testing with a past season (e.g. 2022).
const WC_SEASON = Number(process.env.API_FOOTBALL_SEASON ?? 2026);

// API-Football fixture status short codes → canonical status.
const STATUS_MAP: Record<string, CanonicalMatch['status']> = {
  NS: 'scheduled',
  TBD: 'scheduled',
  PST: 'scheduled', // postponed → treat as still scheduled
  '1H': 'live',
  HT: 'live',
  '2H': 'live',
  ET: 'live',
  BT: 'live',
  P: 'live',
  SUSP: 'live',
  INT: 'live',
  FT: 'concluded',
  AET: 'concluded',
  PEN: 'concluded',
  CANC: 'cancelled',
  ABD: 'cancelled',
  WO: 'cancelled',
  AWD: 'cancelled',
};

function minuteToBucket(elapsed: number, extra: number | null): GoalMinuteBucket {
  const total = elapsed + (extra ?? 0);
  if (total <= 10) return '0-10';
  if (total <= 20) return '11-20';
  if (total <= 30) return '21-30';
  if (total <= 40) return '31-40';
  if (total <= 50) return '41-50';
  if (total <= 60) return '51-60';
  if (total <= 70) return '61-70';
  if (total <= 80) return '71-80';
  if (total <= 90) return '81-90';
  return '90+';
}

type ApfTeamRow = {
  team: { id: number; name: string; code: string | null; logo: string };
};

type ApfSquadRow = {
  team: { id: number };
  players: { id: number; name: string; photo: string }[];
};

type ApfFixtureRow = {
  fixture: { id: number; date: string; status: { short: string } };
  teams: { home: { id: number }; away: { id: number } };
  goals: { home: number | null; away: number | null };
};

type ApfEventRow = {
  time: { elapsed: number; extra: number | null };
  team: { id: number };
  type: string;
  detail: string;
};

export class ApiFootballAdapter implements SportsApiAdapter {
  constructor(private readonly apiKey: string) {}

  private async get<T>(path: string, params: Record<string, string | number>): Promise<T> {
    const url = new URL(`${BASE}${path}`);
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));

    const res = await fetch(url.toString(), {
      headers: { 'x-apisports-key': this.apiKey },
      cache: 'no-store',
    });
    if (!res.ok) throw new Error(`API-Football ${path}: HTTP ${res.status}`);

    const json = (await res.json()) as { response: T; errors: Record<string, string> };
    if (json.errors && Object.keys(json.errors).length > 0) {
      throw new Error(`API-Football error: ${JSON.stringify(json.errors)}`);
    }
    return json.response;
  }

  async fetchTeams(): Promise<CanonicalTeam[]> {
    const rows = await this.get<ApfTeamRow[]>('/teams', {
      league: WC_LEAGUE,
      season: WC_SEASON,
    });
    return rows.map(({ team }) => ({
      apiRef: String(team.id),
      name: team.name,
      shortName: team.code ?? undefined,
      badgeUrl: team.logo,
    }));
  }

  async fetchPlayers(teamApiRef: string): Promise<CanonicalPlayer[]> {
    const rows = await this.get<ApfSquadRow[]>('/players/squads', { team: teamApiRef });
    const entry = rows[0];
    if (!entry) return [];
    return entry.players.map((p) => ({
      apiRef: String(p.id),
      teamApiRef,
      name: p.name,
      faceUrl: p.photo || undefined,
    }));
  }

  async fetchMatches(range?: { fromUtc: string; toUtc: string }): Promise<CanonicalMatch[]> {
    const params: Record<string, string | number> = {
      league: WC_LEAGUE,
      season: WC_SEASON,
    };
    if (range) {
      // API expects YYYY-MM-DD; slice the ISO string.
      params.from = range.fromUtc.slice(0, 10);
      params.to = range.toUtc.slice(0, 10);
    }
    const rows = await this.get<ApfFixtureRow[]>('/fixtures', params);
    return rows.map(({ fixture, teams }) => ({
      apiRef: String(fixture.id),
      homeTeamApiRef: String(teams.home.id),
      awayTeamApiRef: String(teams.away.id),
      kickoffUtc: fixture.date,
      status: STATUS_MAP[fixture.status.short] ?? 'scheduled',
    }));
  }

  async fetchMatchResult(matchApiRef: string): Promise<CanonicalMatchResult | null> {
    const fixtures = await this.get<ApfFixtureRow[]>('/fixtures', { id: matchApiRef });
    const fixture = fixtures[0];
    if (!fixture) return null;

    const status = STATUS_MAP[fixture.fixture.status.short];
    if (status !== 'concluded') return null;

    const scoreA = fixture.goals.home ?? 0;
    const scoreB = fixture.goals.away ?? 0;
    const homeId = fixture.teams.home.id;
    const awayId = fixture.teams.away.id;

    const events = await this.get<ApfEventRow[]>('/fixtures/events', { fixture: matchApiRef });

    const goals = events
      .filter((e) => e.type === 'Goal')
      .sort((a, b) => {
        const ta = a.time.elapsed + (a.time.extra ?? 0);
        const tb = b.time.elapsed + (b.time.extra ?? 0);
        return ta - tb;
      });

    let firstScoringTeam: 'A' | 'B' | 'none' = 'none';
    let firstGoalBucket: GoalMinuteBucket = 'none';

    if (goals.length > 0 && (scoreA > 0 || scoreB > 0)) {
      const first = goals[0];
      // For own goals, the benefiting team is the opponent of the event's team.
      const isOwnGoal = first.detail === 'Own Goal';
      const benefitingId = isOwnGoal
        ? first.team.id === homeId ? awayId : homeId
        : first.team.id;
      firstScoringTeam = benefitingId === homeId ? 'A' : 'B';
      firstGoalBucket = minuteToBucket(first.time.elapsed, first.time.extra);
    }

    return {
      matchApiRef,
      scoreA,
      scoreB,
      firstScoringTeam,
      firstGoalBucket,
      motmPlayerApiRef: null,
    };
  }
}
