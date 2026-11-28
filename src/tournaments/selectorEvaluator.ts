export interface StandingTeamLike {
  id: string;
  name: string;
  alias?: string;
  group: string | null;
  isEliminated?: boolean;
  nationId?: string | null;
  clubId?: string | null;
  standing?: {
    points: number;
    goalDifference: number;
    goalsFor: number;
    goalsAgainst?: number;
    played?: number;
    won?: number;
    drawn?: number;
    lost?: number;
  } | null;
}

export interface KnockoutFixtureLike {
  matchNumber: number;
  homeTeamId: string;
  awayTeamId: string;
  homeScore: number | null;
  awayScore: number | null;
}

export function compareStandings(a: StandingTeamLike, b: StandingTeamLike): number {
  const pDiff = (b.standing?.points ?? 0) - (a.standing?.points ?? 0);
  if (pDiff !== 0) return pDiff;
  const gDiff = (b.standing?.goalDifference ?? 0) - (a.standing?.goalDifference ?? 0);
  if (gDiff !== 0) return gDiff;
  const gfDiff = (b.standing?.goalsFor ?? 0) - (a.standing?.goalsFor ?? 0);
  if (gfDiff !== 0) return gfDiff;
  return a.name.localeCompare(b.name);
}

function getGroupSortedTeams(teams: StandingTeamLike[], groupKey: string): StandingTeamLike[] {
  const upper = groupKey.trim().toUpperCase();
  if (upper === 'ALL') {
    return [...teams].sort(compareStandings);
  }
  const exact = teams.filter((t) => (t.group || 'A').toUpperCase() === upper);
  if (exact.length > 0) {
    return exact.sort(compareStandings);
  }
  // Allow short prefix matching (e.g. W -> WINNERS)
  const prefixMatch = teams.filter((t) => (t.group || '').toUpperCase().startsWith(upper));
  return prefixMatch.sort(compareStandings);
}

function resolveSlice(sorted: StandingTeamLike[], rangeStr: string, label: string): StandingTeamLike[] {
  const trimmed = rangeStr.trim().toUpperCase();
  if (trimmed === 'ALL') return sorted;

  const rangeMatch = trimmed.match(/^(\d+)\s*-\s*(\d+)$/);
  if (rangeMatch) {
    const start = Number.parseInt(rangeMatch[1], 10);
    const end = Number.parseInt(rangeMatch[2], 10);
    if (start < 1 || end < start || sorted.length < end) {
      throw new Error(`Selector "${label}:${trimmed}" requires at least ${end} team(s) in group "${label}" (found ${sorted.length}).`);
    }
    return sorted.slice(start - 1, end);
  }

  const single = Number.parseInt(trimmed, 10);
  if (!Number.isNaN(single) && single >= 1) {
    if (sorted.length < single) {
      throw new Error(`Selector "${label}:${trimmed}" requires rank #${single} in group "${label}" (found ${sorted.length}).`);
    }
    return [sorted[single - 1]];
  }

  throw new Error(`Invalid rank expression "${trimmed}" in selector "${label}:${trimmed}".`);
}

function getKnockoutOutcomeTeam(
  fix: KnockoutFixtureLike,
  teamsById: Map<string, StandingTeamLike>,
  wantWinner: boolean
): StandingTeamLike | null {
  const hs = fix.homeScore ?? 0;
  const as = fix.awayScore ?? 0;
  const homeWon = hs >= as;
  const targetId = wantWinner ? (homeWon ? fix.homeTeamId : fix.awayTeamId) : (homeWon ? fix.awayTeamId : fix.homeTeamId);
  return teamsById.get(targetId) || null;
}

/**
 * Evaluates a blueprint team selector expression (e.g. "A:1-3", "BEST(A:6,B:6)", "PREV_WIN:1", "REMAINING").
 */
export function evaluateSelector(
  rawExpr: string,
  activeTeams: StandingTeamLike[],
  prevKnockoutFixtures: KnockoutFixtureLike[] = [],
  claimedIds: Set<string> = new Set()
): StandingTeamLike[] {
  const expr = rawExpr.trim();
  const upper = expr.toUpperCase();

  if (upper === 'REMAINING' || upper === 'REST') {
    return activeTeams.filter((t) => !claimedIds.has(t.id)).sort(compareStandings);
  }

  // BEST(A:6,B:6) or BEST:2(A:3,B:3,C:3)
  const bestMatch = expr.match(/^BEST(?::(\d+))?\((.+)\)$/i);
  if (bestMatch) {
    const pickCount = bestMatch[1] ? Number.parseInt(bestMatch[1], 10) : 1;
    const innerExprs = bestMatch[2].split(',').map((s) => s.trim()).filter(Boolean);
    const pool: StandingTeamLike[] = [];
    const seen = new Set<string>();
    for (const inner of innerExprs) {
      for (const t of evaluateSelector(inner, activeTeams, prevKnockoutFixtures, claimedIds)) {
        if (!seen.has(t.id)) {
          seen.add(t.id);
          pool.push(t);
        }
      }
    }
    pool.sort(compareStandings);
    if (pool.length < pickCount) {
      throw new Error(`Selector "${expr}" needs at least ${pickCount} candidate team(s), found ${pool.length}.`);
    }
    return pool.slice(0, pickCount);
  }

  // PREV_WIN:ALL | PREV_WIN:1 | PREV_LOSE:ALL | PREV_LOSE:1
  const prevMatch = upper.match(/^PREV_(WIN|LOSE):(.+)$/);
  if (prevMatch) {
    const wantWinner = prevMatch[1] === 'WIN';
    const target = prevMatch[2].trim();
    const teamsById = new Map(activeTeams.map((t) => [t.id, t]));
    const ordered = [...prevKnockoutFixtures].sort((a, b) => a.matchNumber - b.matchNumber);
    if (target === 'ALL') {
      return ordered
        .map((f) => getKnockoutOutcomeTeam(f, teamsById, wantWinner))
        .filter((t): t is StandingTeamLike => Boolean(t));
    }
    const idx = Number.parseInt(target, 10);
    if (Number.isNaN(idx) || idx < 1 || !ordered[idx - 1]) {
      throw new Error(`Selector "${expr}" references match #${target}, which does not exist in previous stage.`);
    }
    const picked = getKnockoutOutcomeTeam(ordered[idx - 1], teamsById, wantWinner);
    if (!picked) {
      throw new Error(`Could not resolve team for "${expr}".`);
    }
    return [picked];
  }

  // GROUP:RANK or GROUP:START-END or ALL:1-4
  const colonIdx = expr.indexOf(':');
  if (colonIdx !== -1) {
    const groupKey = expr.slice(0, colonIdx).trim();
    const rankExpr = expr.slice(colonIdx + 1).trim();
    const sorted = getGroupSortedTeams(activeTeams, groupKey);
    return resolveSlice(sorted, rankExpr, groupKey);
  }

  throw new Error(`Unrecognized blueprint selector syntax: "${expr}". Use formats like A:1-3, BEST(A:6,B:6), or PREV_WIN:ALL.`);
}
