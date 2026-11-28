import { EmbedBuilder } from 'discord.js';
import { prisma } from '../database/prisma.js';
import {
  BlueprintDefinition,
  BlueprintDefinitionSchema,
  BlueprintStage,
  formatBlueprintStagesLines,
  slugifyBlueprintName,
} from './blueprintTypes.js';

export interface BuiltinBlueprint extends BlueprintDefinition {
  slug: string;
  aliases: string[];
}

export const BUILTIN_BLUEPRINTS: BuiltinBlueprint[] = [
  {
    slug: 'round-robin',
    aliases: ['rr', 'single-league', 'ipl', 'playoffs'],
    name: 'Single Round-Robin + Playoff Qualifier',
    description: 'All teams play single league stage -> 1st to Grand Final, 2nd vs 3rd in Qualifier -> Grand Final.',
    stages: [
      {
        kind: 'GROUPS',
        name: 'Stage 1: Round-Robin League',
        groups: ['A'],
        legs: 1,
        resetStandings: false,
      },
      {
        kind: 'KNOCKOUT',
        name: 'Stage 2: Playoff Qualifier',
        roundTag: 'PLAY_IN',
        pairingMode: 'SEEDED',
        qualifiers: ['A:2-3'],
        matchups: [
          { homeSelector: 'A:2', awaySelector: 'A:3', label: 'Qualifier' },
        ],
        legs: 1,
      },
      {
        kind: 'KNOCKOUT',
        name: 'Stage 3: Grand Final',
        roundTag: 'FINAL',
        pairingMode: 'SEEDED',
        qualifiers: ['A:1', 'PREV_WIN:1'],
        matchups: [
          { homeSelector: 'A:1', awaySelector: 'PREV_WIN:1', label: 'Grand Final' },
        ],
        legs: 1,
      },
    ],
  },
  {
    slug: 'champions-cup',
    aliases: ['ucl', 'champions', 'groups-to-ko'],
    name: 'Champions Cup (2 Groups to Knockout)',
    description: '2 Groups of 4 -> Top 2 each to Semi-Finals (Cross-Group) -> Grand Final.',
    stages: [
      {
        kind: 'GROUPS',
        name: 'Stage 1: Group Stage (A & B)',
        groups: ['A', 'B'],
        legs: 1,
      },
      {
        kind: 'KNOCKOUT',
        name: 'Stage 2: Semi-Finals',
        roundTag: 'SEMI_FINAL',
        pairingMode: 'CROSS_GROUP',
        qualifiers: ['A:1-2', 'B:1-2'],
        matchups: [
          { homeSelector: 'A:1', awaySelector: 'B:2', label: 'Semi-Final 1' },
          { homeSelector: 'B:1', awaySelector: 'A:2', label: 'Semi-Final 2' },
        ],
        legs: 1,
      },
      {
        kind: 'KNOCKOUT',
        name: 'Stage 3: Grand Final',
        roundTag: 'FINAL',
        pairingMode: 'SEEDED',
        qualifiers: ['PREV_WIN:ALL'],
        matchups: [
          { homeSelector: 'PREV_WIN:1', awaySelector: 'PREV_WIN:2', label: 'Grand Final' },
        ],
        legs: 1,
      },
    ],
  },
  {
    slug: 'world-cup-best3rd',
    aliases: ['worldcup3rd', 'best3rd', 'wc3rd'],
    name: '3-Group Cup + Best 3rd Qualifiers',
    description: '3 Groups (A, B, C) -> Top 2 each + 2 best 3rd-place teams -> Quarter-Finals -> Semi-Finals -> Final.',
    stages: [
      { kind: 'GROUPS', name: 'Stage 1: Groups (A, B, C)', groups: ['A', 'B', 'C'], legs: 1 },
      {
        kind: 'KNOCKOUT',
        name: 'Stage 2: Quarter-Finals',
        roundTag: 'QUARTER_FINAL',
        pairingMode: 'RANDOM_DRAW',
        qualifiers: ['A:1-2', 'B:1-2', 'C:1-2', 'BEST:2(A:3,B:3,C:3)'],
      },
      { kind: 'KNOCKOUT', name: 'Stage 3: Semi-Finals', roundTag: 'SEMI_FINAL', pairingMode: 'SEEDED', qualifiers: ['PREV_WIN:ALL'] },
      { kind: 'KNOCKOUT', name: 'Stage 4: Grand Final', roundTag: 'FINAL', pairingMode: 'SEEDED', qualifiers: ['PREV_WIN:ALL'] },
    ],
  },
  {
    slug: 'meridian',
    aliases: ['meridian-cup', 'mcc'],
    name: 'Meridian Challengers Cup',
    description: '2 Groups of 8 -> Top 3 Winners Group / 4th-6th Second Chance -> Semi-Finals -> Grand Final.',
    stages: [
      {
        kind: 'GROUPS',
        name: 'Stage 1: Preliminary Groups',
        groups: ['A', 'B'],
        legs: 1,
      },
      {
        kind: 'GROUPS',
        name: 'Stage 2: Re-Group Split',
        legs: 1,
        resetStandings: true,
        routes: [
          { targetGroup: 'WINNERS', selectors: ['A:1-3', 'B:1-3'] },
          { targetGroup: 'SECOND', selectors: ['A:4-5', 'B:4-5', 'BEST(A:6,B:6)'] },
        ],
      },
      {
        kind: 'KNOCKOUT',
        name: 'Stage 3: Semi-Finals',
        roundTag: 'SEMI_FINAL',
        pairingMode: 'SEEDED',
        qualifiers: ['WINNERS:1-3', 'SECOND:1'],
        matchups: [
          { homeSelector: 'WINNERS:1', awaySelector: 'SECOND:1', label: 'Semi-Final 1' },
          { homeSelector: 'WINNERS:2', awaySelector: 'WINNERS:3', label: 'Semi-Final 2' },
        ],
      },
      {
        kind: 'KNOCKOUT',
        name: 'Stage 4: Grand Final',
        roundTag: 'FINAL',
        pairingMode: 'SEEDED',
        qualifiers: ['PREV_WIN:ALL'],
        matchups: [
          { homeSelector: 'PREV_WIN:1', awaySelector: 'PREV_WIN:2', label: 'Grand Final' },
        ],
      },
    ],
  },
  {
    slug: 'classic-knockout',
    aliases: ['ko', 'knockout', 'brackets'],
    name: 'Single Elimination Knockout',
    description: 'Straight bracket tournament: Quarter-Finals -> Semi-Finals -> Grand Final.',
    stages: [
      {
        kind: 'KNOCKOUT',
        name: 'Stage 1: Quarter-Finals',
        roundTag: 'QUARTER_FINAL',
        pairingMode: 'RANDOM_DRAW',
        qualifiers: ['ALL:1-8'],
        legs: 1,
      },
      {
        kind: 'KNOCKOUT',
        name: 'Stage 2: Semi-Finals',
        roundTag: 'SEMI_FINAL',
        pairingMode: 'SEEDED',
        qualifiers: ['PREV_WIN:ALL'],
        legs: 1,
      },
      {
        kind: 'KNOCKOUT',
        name: 'Stage 3: Grand Final',
        roundTag: 'FINAL',
        pairingMode: 'SEEDED',
        qualifiers: ['PREV_WIN:ALL'],
        legs: 1,
      },
    ],
  },
];

export function getBuiltinBlueprint(query: string): BuiltinBlueprint | undefined {
  const norm = slugifyBlueprintName(query);
  return BUILTIN_BLUEPRINTS.find(
    (b) => b.slug === norm || b.aliases.some((a) => slugifyBlueprintName(a) === norm)
  );
}

export interface BlueprintDraftState {
  userId: string;
  name: string;
  description?: string;
  stages: BlueprintStage[];
  updatedAt: number;
}

const activeDrafts = new Map<string, BlueprintDraftState>();

export function getBlueprintDraft(userId: string): BlueprintDraftState | undefined {
  const entry = activeDrafts.get(userId);
  if (!entry) return undefined;
  if (Date.now() - entry.updatedAt > 60 * 60 * 1000) {
    activeDrafts.delete(userId);
    return undefined;
  }
  return entry;
}

export function setBlueprintDraft(state: Omit<BlueprintDraftState, 'updatedAt'>): BlueprintDraftState {
  const next: BlueprintDraftState = { ...state, updatedAt: Date.now() };
  activeDrafts.set(state.userId, next);
  return next;
}

export function clearBlueprintDraft(userId: string): void {
  activeDrafts.delete(userId);
}

export async function saveBlueprintToDb(params: {
  name: string;
  description?: string;
  stages: BlueprintStage[];
  createdById?: string;
}) {
  const parsed = BlueprintDefinitionSchema.parse({
    name: params.name.trim(),
    description: params.description?.trim(),
    stages: params.stages,
  });

  const slug = slugifyBlueprintName(parsed.name);
  if (!slug) throw new Error('Blueprint name must contain at least 2 alphanumeric characters.');

  const saved = await prisma.tournamentBlueprint.upsert({
    where: { slug },
    create: {
      slug,
      name: parsed.name,
      description: parsed.description || null,
      stagesJson: JSON.stringify(parsed.stages),
      createdById: params.createdById || null,
    },
    update: {
      name: parsed.name,
      description: parsed.description || null,
      stagesJson: JSON.stringify(parsed.stages),
      createdById: params.createdById || undefined,
    },
  });

  return saved;
}

export async function getBlueprintBySlugOrName(query: string): Promise<{
  id: string;
  slug: string;
  name: string;
  description?: string | null;
  stages: BlueprintStage[];
  isBuiltin: boolean;
} | null> {
  const raw = query.trim();
  if (!raw) return null;
  const slug = slugifyBlueprintName(raw);

  const dbRow = await prisma.tournamentBlueprint.findFirst({
    where: {
      OR: [{ slug }, { name: { equals: raw, mode: 'insensitive' } }],
    },
  });

  if (dbRow) {
    const rawStages = typeof dbRow.stagesJson === 'string' ? JSON.parse(dbRow.stagesJson) : dbRow.stagesJson;
    const stages = BlueprintDefinitionSchema.shape.stages.parse(rawStages);
    return {
      id: dbRow.id,
      slug: dbRow.slug,
      name: dbRow.name,
      description: dbRow.description,
      stages,
      isBuiltin: false,
    };
  }

  const builtin = getBuiltinBlueprint(raw);
  if (builtin) {
    return {
      id: `builtin:${builtin.slug}`,
      slug: builtin.slug,
      name: builtin.name,
      description: builtin.description,
      stages: builtin.stages,
      isBuiltin: true,
    };
  }

  return null;
}

export async function listAllBlueprints() {
  const customRows = await prisma.tournamentBlueprint.findMany({
    orderBy: { updatedAt: 'desc' },
  });

  return {
    builtins: BUILTIN_BLUEPRINTS,
    custom: customRows.map((r) => {
      const stages = typeof r.stagesJson === 'string' ? JSON.parse(r.stagesJson) : r.stagesJson;
      return {
        id: r.id,
        slug: r.slug,
        name: r.name,
        description: r.description,
        stages: (Array.isArray(stages) ? stages : []) as BlueprintStage[],
      };
    }),
  };
}

export async function deleteBlueprintBySlug(query: string): Promise<boolean> {
  const slug = slugifyBlueprintName(query);
  const existing = await prisma.tournamentBlueprint.findFirst({
    where: { OR: [{ slug }, { name: { equals: query.trim(), mode: 'insensitive' } }] },
  });
  if (!existing) return false;
  await prisma.tournamentBlueprint.delete({ where: { id: existing.id } });
  return true;
}

export function buildBlueprintPreviewEmbed(
  bp: BlueprintDefinition & { slug?: string; isBuiltin?: boolean },
  statusTag: string = 'Draft Preview'
): EmbedBuilder {
  const stageLines = formatBlueprintStagesLines(bp.stages);
  const descParts = [
    bp.description ? `*${bp.description}*\n` : '',
    stageLines.length > 0 ? stageLines.join('\n\n') : '*No stages added yet — click below to add Stage 1!*',
  ];

  return new EmbedBuilder()
    .setTitle(`🧩 Blueprint: ${bp.name}`)
    .setColor('#a855f7')
    .setDescription(descParts.filter(Boolean).join('\n').slice(0, 4000))
    .setFooter({
      text: `${statusTag}${bp.slug ? ` • Slug: ${bp.slug}` : ''} • ${bp.stages.length} stage(s)`,
    });
}
