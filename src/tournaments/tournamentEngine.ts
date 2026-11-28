import { EmbedBuilder } from 'discord.js';
import { prisma } from '../database/prisma.js';
import {
  BlueprintDefinitionSchema,
  BlueprintStage,
  RoundTag,
  formatBlueprintStagesLines,
} from './blueprintTypes.js';
import { getBlueprintBySlugOrName } from './blueprintStoreService.js';
import { StandingTeamLike, compareStandings, evaluateSelector, KnockoutFixtureLike } from './selectorEvaluator.js';
import { logger } from '../utils/logger.js';

export function roundTagToPhase(tag: RoundTag): string {
  if (tag === 'PLAY_IN') return 'PLAY_INS';
  if (tag === 'QUARTER_FINAL') return 'QUARTER_FINALS';
  if (tag === 'SEMI_FINAL') return 'SEMI_FINALS';
  if (tag === 'FINAL') return 'FINAL';
  return 'KNOCKOUT';
}

function shuffleCopy<T>(items: T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function buildGroupRoundRobinFixtures(params: {
  tournamentId: string;
  teams: Array<{ id: string; name: string; group: string | null }>;
  legs: number;
  startMatchday: number;
  preferredGroupOrder?: string[];
}) {
  const activeGroupsSet = new Set(params.teams.map((t) => (t.group || 'A').toUpperCase()));
  const orderedGroups = params.preferredGroupOrder?.length
    ? params.preferredGroupOrder.map((g) => g.toUpperCase()).filter((g) => activeGroupsSet.has(g))
    : Array.from(activeGroupsSet).sort();

  for (const g of activeGroupsSet) {
    if (!orderedGroups.includes(g)) orderedGroups.push(g);
  }

  const fixturesToCreate: any[] = [];
  let overallMatchNum = 1;

  for (const grp of orderedGroups) {
    const grpTeams = params.teams.filter((t) => (t.group || 'A').toUpperCase() === grp);
    if (grpTeams.length < 2) continue;

    const list: Array<{ id: string; name: string }> = [...grpTeams];
    if (list.length % 2 !== 0) {
      list.push({ id: 'BYE', name: 'BYE' });
    }

    const n = list.length;
    const days = n - 1;
    const half = n / 2;
    const leg1ForGroup: any[] = [];

    for (let day = 0; day < days; day++) {
      const matchday = params.startMatchday + day;
      for (let i = 0; i < half; i++) {
        let home = list[i];
        let away = list[n - 1 - i];

        // Alternate home and away across matchdays to prevent fixed anchor playing only at home
        if (day % 2 === 1) {
          const tmp = home;
          home = away;
          away = tmp;
        }

        if (home.id === 'BYE' || away.id === 'BYE') continue;
        const row = {
          tournamentId: params.tournamentId,
          matchday,
          matchNumber: overallMatchNum++,
          stage: 'GROUP',
          group: grp,
          leg: 1,
          homeTeamId: home.id,
          awayTeamId: away.id,
          status: 'SCHEDULED',
        };
        fixturesToCreate.push(row);
        leg1ForGroup.push(row);
      }

      // Rotate round robin pool
      const fixed = list[0];
      const rest = list.slice(1);
      rest.unshift(rest.pop()!);
      list.splice(0, list.length, fixed, ...rest);
    }

    // Optional 2-leg reverse fixtures
    if (params.legs === 2) {
      for (const f of leg1ForGroup) {
        fixturesToCreate.push({
          tournamentId: params.tournamentId,
          matchday: f.matchday + days,
          matchNumber: overallMatchNum++,
          stage: 'GROUP',
          group: grp,
          leg: 2,
          homeTeamId: f.awayTeamId,
          awayTeamId: f.homeTeamId,
          status: 'SCHEDULED',
        });
      }
    }
  }

  fixturesToCreate.sort((a, b) => a.matchday - b.matchday || (a.group || '').localeCompare(b.group || ''));
  fixturesToCreate.forEach((f, idx) => {
    f.matchNumber = idx + 1;
  });

  return fixturesToCreate;
}

export async function createTournament(params: {
  name: string;
  type?: 'NATION' | 'CLUB';
  blueprintSlug?: string;
  stagesJson?: any;
}) {
  const type = (params.type || 'NATION').toUpperCase() as 'NATION' | 'CLUB';
  let blueprintStages = params.stagesJson;
  let bpSlug = params.blueprintSlug;

  if (bpSlug && !blueprintStages) {
    const bp = await prisma.tournamentBlueprint.findUnique({ where: { slug: bpSlug } });
    if (!bp) {
      throw new Error(`Blueprint with slug "${bpSlug}" not found in database.`);
    }
    blueprintStages = bp.stagesJson;
  }

  const tourney = await prisma.tournament.create({
    data: {
      name: params.name,
      type,
      status: 'REGISTRATION',
      blueprintId: bpSlug || null,
      blueprintStages: blueprintStages ? (typeof blueprintStages === 'string' ? blueprintStages : JSON.stringify(blueprintStages)) : null,
      currentStageIdx: 0,
      currentPhase: 'STAGE_1',
    },
  });

  return tourney;
}

export async function enrollTeamToTournament(tournamentId: string, teamIdentifier: string) {
  const tourney = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    include: { teams: true, fixtures: true },
  });
  if (!tourney) throw new Error('Tournament not found.');

  const played = tourney.fixtures.filter((f) => f.status === 'PLAYED').length;
  if (played > 0) {
    throw new Error('Cannot add new teams to a tournament once matches have been played.');
  }

  const search = teamIdentifier.trim().toLowerCase();

  if (tourney.type === 'NATION') {
    const nation = await prisma.nationalTeam.findFirst({
      where: {
        OR: [
          { alias: { equals: search, mode: 'insensitive' } },
          { name: { equals: search, mode: 'insensitive' } },
        ],
      },
    });
    if (!nation) {
      throw new Error(`National team "${teamIdentifier}" not found. Check \`-roster\` or country alias.`);
    }

    const existing = tourney.teams.find((t) => t.nationId === nation.id || t.alias.toLowerCase() === nation.alias.toLowerCase());
    if (existing) {
      throw new Error(`Team ${nation.name} is already enrolled in this tournament.`);
    }

    const team = await prisma.tournamentTeam.create({
      data: {
        tournamentId: tourney.id,
        name: nation.name,
        alias: nation.alias.toUpperCase(),
        nationId: nation.id,
      },
    });
    return { team, tourneyName: tourney.name };
  } else {
    const club = await prisma.footballClub.findFirst({
      where: {
        OR: [
          { alias: { equals: search, mode: 'insensitive' } },
          { name: { equals: search, mode: 'insensitive' } },
        ],
      },
    });
    if (!club) {
      throw new Error(`Football club "${teamIdentifier}" not found.`);
    }

    const existing = tourney.teams.find((t) => t.clubId === club.id || t.alias.toLowerCase() === club.alias.toLowerCase());
    if (existing) {
      throw new Error(`Club ${club.name} is already enrolled in this tournament.`);
    }

    const team = await prisma.tournamentTeam.create({
      data: {
        tournamentId: tourney.id,
        name: club.name,
        alias: club.alias.toUpperCase(),
        clubId: club.id,
      },
    });
    return { team, tourneyName: tourney.name };
  }
}

export async function enrollAllTeamsToTournament(tournamentId: string) {
  const tourney = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    include: { teams: true },
  });
  if (!tourney) throw new Error('Tournament not found.');

  const enrolledCount = tourney.teams.length;
  let added = 0;

  if (tourney.type === 'NATION') {
    const nations = await prisma.nationalTeam.findMany({ orderBy: { name: 'asc' } });
    for (const n of nations) {
      const exists = tourney.teams.some((t) => t.nationId === n.id || t.alias.toLowerCase() === n.alias.toLowerCase());
      if (!exists) {
        await prisma.tournamentTeam.create({
          data: {
            tournamentId: tourney.id,
            name: n.name,
            alias: n.alias.toUpperCase(),
            nationId: n.id,
          },
        });
        added++;
      }
    }
  } else {
    const clubs = await prisma.footballClub.findMany({ orderBy: { name: 'asc' } });
    for (const c of clubs) {
      const exists = tourney.teams.some((t) => t.clubId === c.id || t.alias.toLowerCase() === c.alias.toLowerCase());
      if (!exists) {
        await prisma.tournamentTeam.create({
          data: {
            tournamentId: tourney.id,
            name: c.name,
            alias: c.alias.toUpperCase(),
            clubId: c.id,
          },
        });
        added++;
      }
    }
  }

  return { added, total: enrolledCount + added, type: tourney.type };
}

export async function applyBlueprintToTournament(tournamentId: string, blueprintSlug: string) {
  const tourney = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    include: { teams: { orderBy: { name: 'asc' } }, fixtures: true },
  });
  if (!tourney) throw new Error('Tournament not found.');

  const played = tourney.fixtures.filter((f) => f.status === 'PLAYED').length;
  if (played > 0) {
    throw new Error(`Cannot change blueprint: ${played} match(es) have already been played.`);
  }

  const bp = await getBlueprintBySlugOrName(blueprintSlug);
  if (!bp) {
    throw new Error(`Blueprint "${blueprintSlug}" not found. Check \`-blueprint list\` or create one with \`-blueprint create\`.`);
  }

  const stages = bp.stages;
  const stage0 = stages[0];

  if (tourney.fixtures.length > 0) {
    await prisma.tournamentFixture.deleteMany({ where: { tournamentId: tourney.id } });
  }

  const targetGroups =
    stage0.kind === 'GROUPS'
      ? (stage0.groups?.length ? stage0.groups.map((g) => g.toUpperCase()) : ['A', 'B'])
      : ['ALL'];

  for (let i = 0; i < tourney.teams.length; i++) {
    const team = tourney.teams[i];
    const grp = targetGroups[i % targetGroups.length];
    await prisma.tournamentTeam.update({
      where: { id: team.id },
      data: {
        group: grp,
        isEliminated: false,
        played: 0,
        won: 0,
        drawn: 0,
        lost: 0,
        goalsFor: 0,
        goalsAgainst: 0,
        goalDifference: 0,
        points: 0,
      },
    });
  }

  const initialPhase = stage0.kind === 'KNOCKOUT' ? roundTagToPhase(stage0.roundTag) : 'STAGE_1';

  const updated = await prisma.tournament.update({
    where: { id: tourney.id },
    data: {
      status: 'ACTIVE',
      blueprintId: bp.slug,
      blueprintStages: JSON.stringify(stages),
      currentStageIdx: 0,
      currentPhase: initialPhase,
      stageHistory: JSON.stringify([]),
    },
  });

  return { success: true, blueprint: bp, stages, tourney: updated };
}

export async function generateTournamentStageFixtures(tournamentId: string) {
  const tourney = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    include: { teams: true, fixtures: true },
  });
  if (!tourney) throw new Error('Tournament not found.');
  if (!tourney.blueprintStages) throw new Error('Tournament has no blueprint applied. Run `-tourney blueprint <name> <slug>` first.');

  const stages: BlueprintStage[] = BlueprintDefinitionSchema.shape.stages.parse(
    typeof tourney.blueprintStages === 'string' ? JSON.parse(tourney.blueprintStages) : tourney.blueprintStages
  );
  const stageIdx = tourney.currentStageIdx || 0;
  const stage = stages[stageIdx];
  if (!stage) throw new Error('Invalid blueprint stage configuration.');

  const activeTeams = tourney.teams.filter((t) => !t.isEliminated);
  if (activeTeams.length < 2) {
    throw new Error('At least 2 active teams are required to generate fixtures.');
  }

  const maxDay = tourney.fixtures.reduce((m, f) => Math.max(m, f.matchday), 0);
  const startDay = stageIdx === 0 ? 1 : maxDay + 1;

  let fixturesToCreate: any[] = [];

  if (stage.kind === 'GROUPS') {
    fixturesToCreate = buildGroupRoundRobinFixtures({
      tournamentId: tourney.id,
      teams: activeTeams,
      legs: stage.legs || 1,
      startMatchday: startDay,
      preferredGroupOrder: stage.groups,
    });
  } else {
    // Knockout Stage
    const pairingMode = stage.pairingMode || 'SEEDED';
    const pairs: Array<{ home: any; away: any; label: string }> = [];

    if (stage.matchups && stage.matchups.length > 0) {
      for (const [i, m] of stage.matchups.entries()) {
        const hList = evaluateSelector(m.homeSelector, activeTeams);
        const aList = evaluateSelector(m.awaySelector, activeTeams);
        if (hList[0] && aList[0]) {
          pairs.push({ home: hList[0], away: aList[0], label: m.label || `${stage.roundTag} ${i + 1}` });
        }
      }
    } else if (pairingMode === 'RANDOM_DRAW') {
      const shuffled = shuffleCopy(activeTeams);
      for (let i = 0; i + 1 < shuffled.length; i += 2) {
        pairs.push({
          home: shuffled[i],
          away: shuffled[i + 1],
          label: `${stage.roundTag.replace('_', ' ')} ${pairs.length + 1}`,
        });
      }
    } else {
      // Seeded pairing
      const sorted = [...activeTeams].sort(compareStandings);
      for (let i = 0; i < Math.floor(sorted.length / 2); i++) {
        pairs.push({
          home: sorted[i],
          away: sorted[sorted.length - 1 - i],
          label: `${stage.roundTag.replace('_', ' ')} ${i + 1}`,
        });
      }
    }

    pairs.forEach((p, idx) => {
      fixturesToCreate.push({
        tournamentId: tourney.id,
        matchday: startDay,
        matchNumber: idx + 1,
        stage: stage.roundTag || 'KNOCKOUT',
        leg: 1,
        homeTeamId: p.home.id,
        awayTeamId: p.away.id,
        status: 'SCHEDULED',
      });
      if (stage.legs === 2) {
        fixturesToCreate.push({
          tournamentId: tourney.id,
          matchday: startDay + 1,
          matchNumber: idx + 1,
          stage: stage.roundTag || 'KNOCKOUT',
          leg: 2,
          homeTeamId: p.away.id,
          awayTeamId: p.home.id,
          status: 'SCHEDULED',
        });
      }
    });
  }

  if (fixturesToCreate.length === 0) {
    throw new Error('No matchups could be created for this stage. Check team count or group distribution.');
  }

  await prisma.tournamentFixture.createMany({ data: fixturesToCreate });
  await prisma.tournament.update({
    where: { id: tourney.id },
    data: { status: 'ACTIVE' },
  });
  return fixturesToCreate;
}

export async function advanceTournamentStage(tournamentId: string, force: boolean = false) {
  const tourney = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    include: {
      teams: true,
      fixtures: {
        include: { homeTeam: true, awayTeam: true },
        orderBy: [{ matchday: 'asc' }, { matchNumber: 'asc' }],
      },
    },
  });
  if (!tourney || !tourney.blueprintStages) throw new Error('Blueprint configuration missing on tournament.');

  const stages: BlueprintStage[] = BlueprintDefinitionSchema.shape.stages.parse(
    typeof tourney.blueprintStages === 'string' ? JSON.parse(tourney.blueprintStages) : tourney.blueprintStages
  );
  const curIdx = tourney.currentStageIdx || 0;
  const curStage = stages[curIdx];
  const nextStage = stages[curIdx + 1];
  const activeTeams: StandingTeamLike[] = tourney.teams
    .filter((t) => !t.isEliminated)
    .map((t) => ({
      id: t.id,
      name: t.name,
      alias: t.alias,
      group: t.group,
      nationId: t.nationId,
      clubId: t.clubId,
      standing: {
        points: t.points,
        goalDifference: t.goalDifference,
        goalsFor: t.goalsFor,
        goalsAgainst: t.goalsAgainst,
        played: t.played,
        won: t.won,
        drawn: t.drawn,
        lost: t.lost,
      },
    }));

  const unplayed = tourney.fixtures.filter((f) => f.status !== 'PLAYED');
  if (unplayed.length > 0 && !force) {
    throw new Error(`Cannot advance yet: ${unplayed.length} unplayed fixture(s) remain in **${curStage.name}**.`);
  }

  const maxDay = tourney.fixtures.reduce((m, f) => Math.max(m, f.matchday), 0);
  const historyRaw = tourney.stageHistory ? (typeof tourney.stageHistory === 'string' ? JSON.parse(tourney.stageHistory) : tourney.stageHistory) : [];
  const history = Array.isArray(historyRaw) ? [...historyRaw] : [];

  history.push({
    stageIdx: curIdx,
    stageName: curStage.name,
    kind: curStage.kind,
    completedAt: new Date().toISOString(),
    standings: [...activeTeams].sort(compareStandings).map((t, i) => ({
      rank: i + 1,
      teamId: t.id,
      teamName: t.name,
      group: t.group,
      points: t.standing?.points ?? 0,
      gd: t.standing?.goalDifference ?? 0,
      gf: t.standing?.goalsFor ?? 0,
    })),
  });

  // Champion Crowning if no next stage
  if (!nextStage) {
    let championName = activeTeams.sort(compareStandings)[0]?.name || 'Champion';
    let scoreText = '';

    if (curStage.kind === 'KNOCKOUT') {
      const stageFixes = tourney.fixtures
        .filter((f) => f.stage === curStage.roundTag && f.status === 'PLAYED')
        .sort((a, b) => b.matchday - a.matchday || a.matchNumber - b.matchNumber);
      const decider = stageFixes[0];
      if (decider) {
        const homeWon = (decider.homeScore ?? 0) >= (decider.awayScore ?? 0);
        championName = homeWon ? decider.homeTeam.name : decider.awayTeam.name;
        scoreText = ` \`[${decider.homeScore} - ${decider.awayScore}]\``;
      }
    }

    await prisma.tournament.update({
      where: { id: tourney.id },
      data: {
        currentPhase: 'COMPLETED',
        status: 'COMPLETED',
        stageHistory: JSON.stringify(history),
      },
    });

    return {
      concluded: true,
      championName,
      scoreText,
      stageName: curStage.name,
    };
  }

  // Knockout previous fixtures mapping for selectors
  const prevKnockoutFixtures: KnockoutFixtureLike[] =
    curStage.kind === 'KNOCKOUT'
      ? tourney.fixtures
          .filter((f) => f.stage === curStage.roundTag)
          .map((f) => ({
            matchNumber: f.matchNumber,
            homeTeamId: f.homeTeamId,
            awayTeamId: f.awayTeamId,
            homeScore: f.homeScore,
            awayScore: f.awayScore,
          }))
      : [];

  // Advancing to Next GROUPS Stage
  if (nextStage.kind === 'GROUPS') {
    const routes = nextStage.routes || [];
    if (routes.length === 0) throw new Error(`Stage "${nextStage.name}" has no group routing rules defined.`);

    const claimed = new Set<string>();
    const groupAssignments: Record<string, StandingTeamLike[]> = {};

    for (const rule of routes) {
      const tgt = rule.targetGroup.toUpperCase();
      if (!groupAssignments[tgt]) groupAssignments[tgt] = [];
      for (const sel of rule.selectors) {
        for (const t of evaluateSelector(sel, activeTeams, prevKnockoutFixtures, claimed)) {
          if (!claimed.has(t.id)) {
            claimed.add(t.id);
            groupAssignments[tgt].push(t);
          }
        }
      }
    }

    const eliminated: StandingTeamLike[] = activeTeams.filter((t) => !claimed.has(t.id));
    for (const t of eliminated) {
      await prisma.tournamentTeam.update({ where: { id: t.id }, data: { isEliminated: true, group: null } });
    }

    const resetStats = nextStage.resetStandings !== false;
    const routedTeams: any[] = [];
    for (const [grp, list] of Object.entries(groupAssignments)) {
      for (const t of list) {
        await prisma.tournamentTeam.update({
          where: { id: t.id },
          data: resetStats
            ? { group: grp, isEliminated: false, played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, goalDifference: 0, points: 0 }
            : { group: grp, isEliminated: false },
        });
        routedTeams.push({ ...t, group: grp });
      }
    }

    const fixturesData = buildGroupRoundRobinFixtures({
      tournamentId: tourney.id,
      teams: routedTeams,
      legs: nextStage.legs || 1,
      startMatchday: maxDay + 1,
      preferredGroupOrder: routes.map((r) => r.targetGroup.toUpperCase()),
    });

    if (fixturesData.length > 0) {
      await prisma.tournamentFixture.createMany({ data: fixturesData });
    }

    await prisma.tournament.update({
      where: { id: tourney.id },
      data: {
        currentStageIdx: curIdx + 1,
        currentPhase: `STAGE_${curIdx + 2}`,
        stageHistory: JSON.stringify(history),
      },
    });

    return {
      concluded: false,
      nextStage,
      groupAssignments,
      eliminated,
      fixturesCount: fixturesData.length,
      startMatchday: maxDay + 1,
    };
  }

  // Advancing to Next KNOCKOUT Stage
  const pool: StandingTeamLike[] = [];
  const seen = new Set<string>();
  const addPoolTeam = (t: StandingTeamLike) => {
    if (!seen.has(t.id)) {
      seen.add(t.id);
      pool.push(t);
    }
  };

  if (nextStage.qualifiers && nextStage.qualifiers.length > 0) {
    for (const q of nextStage.qualifiers) {
      for (const t of evaluateSelector(q, activeTeams, prevKnockoutFixtures)) addPoolTeam(t);
    }
  } else if (nextStage.matchups && nextStage.matchups.length > 0) {
    for (const m of nextStage.matchups) {
      for (const t of evaluateSelector(m.homeSelector, activeTeams, prevKnockoutFixtures)) addPoolTeam(t);
      for (const t of evaluateSelector(m.awaySelector, activeTeams, prevKnockoutFixtures)) addPoolTeam(t);
    }
  } else if (prevKnockoutFixtures.length > 0) {
    for (const t of evaluateSelector('PREV_WIN:ALL', activeTeams, prevKnockoutFixtures)) addPoolTeam(t);
  } else {
    activeTeams.sort(compareStandings).forEach(addPoolTeam);
  }

  for (const t of activeTeams) {
    if (!seen.has(t.id)) {
      await prisma.tournamentTeam.update({ where: { id: t.id }, data: { isEliminated: true, group: null } });
    } else {
      await prisma.tournamentTeam.update({ where: { id: t.id }, data: { isEliminated: false } });
    }
  }

  const eliminated = activeTeams.filter((t) => !seen.has(t.id));
  const pairingMode = nextStage.pairingMode || 'SEEDED';
  const pairs: Array<{ home: StandingTeamLike; away: StandingTeamLike; label: string }> = [];

  if (pairingMode === 'RANDOM_DRAW') {
    const shuffled = shuffleCopy(pool);
    for (let i = 0; i + 1 < shuffled.length; i += 2) {
      pairs.push({
        home: shuffled[i],
        away: shuffled[i + 1],
        label: `${nextStage.roundTag.replace('_', ' ')} ${pairs.length + 1}`,
      });
    }
  } else if (nextStage.matchups && nextStage.matchups.length > 0) {
    for (const [i, m] of nextStage.matchups.entries()) {
      const hList = evaluateSelector(m.homeSelector, activeTeams, prevKnockoutFixtures);
      const aList = evaluateSelector(m.awaySelector, activeTeams, prevKnockoutFixtures);
      if (hList[0] && aList[0]) {
        pairs.push({ home: hList[0], away: aList[0], label: m.label || `${nextStage.roundTag} ${i + 1}` });
      }
    }
  } else {
    for (let i = 0; i < Math.floor(pool.length / 2); i++) {
      pairs.push({
        home: pool[i],
        away: pool[pool.length - 1 - i],
        label: `${nextStage.roundTag.replace('_', ' ')} ${i + 1}`,
      });
    }
  }

  const stageDay = maxDay + 1;
  const fixturesData: any[] = [];
  pairs.forEach((p, idx) => {
    fixturesData.push({
      tournamentId: tourney.id,
      matchday: stageDay,
      matchNumber: idx + 1,
      stage: nextStage.roundTag || 'KNOCKOUT',
      leg: 1,
      homeTeamId: p.home.id,
      awayTeamId: p.away.id,
      status: 'SCHEDULED',
    });
    if (nextStage.legs === 2) {
      fixturesData.push({
        tournamentId: tourney.id,
        matchday: stageDay + 1,
        matchNumber: idx + 1,
        stage: nextStage.roundTag || 'KNOCKOUT',
        leg: 2,
        homeTeamId: p.away.id,
        awayTeamId: p.home.id,
        status: 'SCHEDULED',
      });
    }
  });

  if (fixturesData.length > 0) {
    await prisma.tournamentFixture.createMany({ data: fixturesData });
  }

  await prisma.tournament.update({
    where: { id: tourney.id },
    data: {
      currentStageIdx: curIdx + 1,
      currentPhase: roundTagToPhase(nextStage.roundTag),
      stageHistory: JSON.stringify(history),
    },
  });

  return {
    concluded: false,
    nextStage,
    pairs,
    eliminated,
    fixturesCount: fixturesData.length,
    startMatchday: stageDay,
  };
}
