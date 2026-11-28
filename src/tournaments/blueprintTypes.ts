import { z } from 'zod';

export const PairingModeSchema = z.enum(['SEEDED', 'CROSS_GROUP', 'RANDOM_DRAW', 'MANUAL']);
export type PairingMode = z.infer<typeof PairingModeSchema>;

export const RoundTagSchema = z.enum(['PLAY_IN', 'QUARTER_FINAL', 'SEMI_FINAL', 'FINAL', 'KNOCKOUT']);
export type RoundTag = z.infer<typeof RoundTagSchema>;

export const GroupRouteRuleSchema = z.object({
  targetGroup: z.string().min(1).max(16),
  selectors: z.array(z.string().min(1)).min(1),
});

export const KnockoutMatchupSchema = z.object({
  homeSelector: z.string().min(1),
  awaySelector: z.string().min(1),
  label: z.string().max(60).optional(),
});

export const GroupsStageSchema = z.object({
  kind: z.literal('GROUPS'),
  name: z.string().min(1).max(80),
  groups: z.array(z.string().min(1).max(16)).optional(),
  legs: z.union([z.literal(1), z.literal(2)]).optional(),
  resetStandings: z.boolean().optional(),
  routes: z.array(GroupRouteRuleSchema).optional(),
});

export const KnockoutStageSchema = z.object({
  kind: z.literal('KNOCKOUT'),
  name: z.string().min(1).max(80),
  roundTag: RoundTagSchema.default('KNOCKOUT'),
  pairingMode: PairingModeSchema.default('SEEDED'),
  qualifiers: z.array(z.string().min(1)).optional(),
  matchups: z.array(KnockoutMatchupSchema).optional(),
  legs: z.union([z.literal(1), z.literal(2)]).optional(),
});

export const BlueprintStageSchema = z.discriminatedUnion('kind', [
  GroupsStageSchema,
  KnockoutStageSchema,
]);

export const BlueprintDefinitionSchema = z.object({
  name: z.string().min(2).max(80),
  description: z.string().max(400).optional(),
  stages: z.array(BlueprintStageSchema).min(1).max(8),
});

export type GroupRouteRule = z.infer<typeof GroupRouteRuleSchema>;
export type KnockoutMatchup = z.infer<typeof KnockoutMatchupSchema>;
export type GroupsStage = z.infer<typeof GroupsStageSchema>;
export type KnockoutStage = z.infer<typeof KnockoutStageSchema>;
export type BlueprintStage = z.infer<typeof BlueprintStageSchema>;
export type BlueprintDefinition = z.infer<typeof BlueprintDefinitionSchema>;

export function slugifyBlueprintName(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
}

export function formatBlueprintStagesLines(stages: BlueprintStage[]): string[] {
  return stages.map((st, idx) => {
    const num = idx + 1;
    if (st.kind === 'GROUPS') {
      if (st.routes && st.routes.length > 0) {
        const routeDesc = st.routes.map((r) => `**${r.targetGroup}** ← \`${r.selectors.join(' + ')}\``).join(' | ');
        return `**Stage ${num} (Groups${st.legs === 2 ? ' 2-Leg' : ''}):** ${st.name}\n  ↳ ${routeDesc}`;
      }
      return `**Stage ${num} (Groups${st.legs === 2 ? ' 2-Leg' : ''}):** ${st.name} (\`${(st.groups || ['A', 'B']).join(', ')}\`)`;
    }
    const modeTag = st.pairingMode || 'SEEDED';
    const matchDesc =
      st.matchups && st.matchups.length > 0
        ? st.matchups.map((m) => `\`${m.homeSelector} vs ${m.awaySelector}\``).join(', ')
        : st.qualifiers?.join(', ') || 'Winners advance';
    return `**Stage ${num} (${st.roundTag} • ${modeTag}):** ${st.name}\n  ↳ ${matchDesc}`;
  });
}
