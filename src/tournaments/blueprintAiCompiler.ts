import {
  BlueprintDefinition,
  BlueprintDefinitionSchema,
  BlueprintStage,
  PairingMode,
  RoundTag,
} from './blueprintTypes.js';
import { logger } from '../utils/logger.js';

const COMPILER_SYSTEM_PROMPT = `You convert tournament format descriptions into STRICT JSON matching the schema below.
Return ONLY valid JSON — no markdown explanation, no prose outside the JSON object.

Schema:
{
  "name": "string (tournament format name)",
  "description": "string (1-2 sentence overview)",
  "stages": [
    // Variant 1: GROUPS stage (Stage 1 initial groups OR Stage 2+ re-grouped stage)
    {
      "kind": "GROUPS",
      "name": "string",
      "groups": ["A", "B"],         // Use on Stage 1 when splitting teams into groups. For single league use ["A"].
      "legs": 1,                    // 1 or 2
      "resetStandings": true,       // true on Stage 2+ to start fresh table points
      "routes": [                   // Required for Stage 2+ GROUPS to move qualified teams from Stage N-1
        { "targetGroup": "WINNERS", "selectors": ["A:1-3", "B:1-3"] },
        { "targetGroup": "SECOND",  "selectors": ["A:4-5", "B:4-5", "BEST(A:6,B:6)"] }
      ]
    },
    // Variant 2: KNOCKOUT stage (Play-ins, Quarter-Finals, Semi-Finals, Final)
    {
      "kind": "KNOCKOUT",
      "name": "string",
      "roundTag": "PLAY_IN" | "QUARTER_FINAL" | "SEMI_FINAL" | "FINAL" | "KNOCKOUT",
      "pairingMode": "SEEDED" | "CROSS_GROUP" | "RANDOM_DRAW" | "MANUAL",
      "qualifiers": ["A:1-2", "B:1-2"],
      "matchups": [                 // Optional when SEEDED/CROSS_GROUP; required if explicit pairings desired
        { "homeSelector": "A:1", "awaySelector": "B:2", "label": "Semi-Final 1" }
      ],
      "legs": 1                     // 1 or 2
    }
  ]
}

Selector Rules:
- "<GROUP>:<N>" (e.g. "A:1", "WINNERS:2") or range "<GROUP>:<START>-<END>" (e.g. "A:1-3", "B:4-5").
- "BEST(<expr1>,<expr2>,...)" or "BEST:<K>(<expr1>,...)" picks top K teams across groups by points/GD/GF (e.g. "BEST(A:3,B:3)" = better 3rd-place team).
- "ALL:<START>-<END>" ranks across all active teams; "REMAINING" takes unclaimed active teams.
- "PREV_WIN:ALL", "PREV_WIN:<N>", "PREV_LOSE:<N>" reference winners/losers of the immediately preceding KNOCKOUT stage.
- Group names in Stage K routes MUST match targetGroup/groups from Stage K-1!
- If there are Semi-Finals, ALWAYS include the Final as the final stage with qualifiers ["PREV_WIN:ALL"] and matchup PREV_WIN:1 vs PREV_WIN:2.`;

function stripJsonFences(raw: string): string {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) return fenced[1].trim();
  const firstBrace = trimmed.indexOf('{');
  const lastBrace = trimmed.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    return trimmed.slice(firstBrace, lastBrace + 1);
  }
  return trimmed;
}

/**
 * Parses compact offline DSL lines into a BlueprintDefinition.
 */
export function parseCompactDslToBlueprint(rawText: string, defaultName: string = 'Custom Tournament'): BlueprintDefinition | null {
  const lines = rawText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  let name = defaultName;
  let description: string | undefined;
  const stages: BlueprintStage[] = [];

  for (const line of lines) {
    if (/^NAME\s*:/i.test(line)) {
      name = line.replace(/^NAME\s*:/i, '').trim() || name;
      continue;
    }
    if (/^DESC(?:RIPTION)?\s*:/i.test(line)) {
      description = line.replace(/^DESC(?:RIPTION)?\s*:/i, '').trim() || undefined;
      continue;
    }

    const parts = line.split('|').map((p) => p.trim());
    const head = parts[0] || '';

    if (/^GROUPS?\b/i.test(head)) {
      const stageName = head.replace(/^GROUPS?\s*/i, '').replace(/^["']|["']$/g, '').trim() || `Stage ${stages.length + 1}`;
      const defPart = parts[1] || 'A, B';
      const legsToken = parts.find((p) => /^legs\s*:/i.test(p));
      const resetToken = parts.find((p) => /^reset\s*:/i.test(p));
      const legs = legsToken?.includes('2') ? 2 : 1;
      const resetStandings = resetToken ? !/false|no|0/i.test(resetToken) : true;

      if (defPart.includes('=')) {
        const routes = defPart.split(';').map((seg) => {
          const [grp, rawSels] = seg.split('=').map((x) => x.trim());
          return {
            targetGroup: grp.toUpperCase(),
            selectors: (rawSels || '').split('+').map((s) => s.trim()).filter(Boolean),
          };
        }).filter((r) => r.targetGroup && r.selectors.length > 0);
        stages.push({ kind: 'GROUPS', name: stageName, legs, resetStandings, routes });
      } else {
        const groups = defPart.split(/[\s,]+/).map((g) => g.trim().toUpperCase()).filter(Boolean);
        stages.push({ kind: 'GROUPS', name: stageName, legs, groups: groups.length ? groups : ['A', 'B'] });
      }
      continue;
    }

    if (/^(?:KO|KNOCKOUT)\b/i.test(head)) {
      const stageName = head.replace(/^(?:KO|KNOCKOUT)\s*/i, '').replace(/^["']|["']$/g, '').trim() || `Knockout Stage ${stages.length + 1}`;
      const roundTagRaw = (parts[1] || 'KNOCKOUT').toUpperCase() as RoundTag;
      const validTags: RoundTag[] = ['PLAY_IN', 'QUARTER_FINAL', 'SEMI_FINAL', 'FINAL', 'KNOCKOUT'];
      const roundTag = validTags.includes(roundTagRaw) ? roundTagRaw : 'KNOCKOUT';
      const pairingRaw = (parts[2] || 'SEEDED').toUpperCase() as PairingMode;
      const validPairings: PairingMode[] = ['SEEDED', 'CROSS_GROUP', 'RANDOM_DRAW', 'MANUAL'];
      const pairingMode = validPairings.includes(pairingRaw) ? pairingRaw : 'SEEDED';
      const pairSpec = parts[3] || '';

      if (/\bvs\b/i.test(pairSpec)) {
        const matchups = pairSpec.split(',').map((m, idx) => {
          const [h, a] = m.split(/\bvs\b/i).map((x) => x.trim());
          return { homeSelector: h, awaySelector: a, label: `${roundTag.replace('_', ' ')} ${idx + 1}` };
        }).filter((m) => m.homeSelector && m.awaySelector);
        stages.push({ kind: 'KNOCKOUT', name: stageName, roundTag, pairingMode, matchups, legs: 1 });
      } else {
        const qualifiers = pairSpec.split(/[\s+]+/).map((q) => q.trim()).filter(Boolean);
        stages.push({
          kind: 'KNOCKOUT',
          name: stageName,
          roundTag,
          pairingMode,
          qualifiers: qualifiers.length ? qualifiers : ['PREV_WIN:ALL'],
          legs: 1,
        });
      }
    }
  }

  if (stages.length === 0) return null;
  return BlueprintDefinitionSchema.parse({ name, description, stages });
}

/**
 * Smart offline heuristic parser for popular natural language tournament rules.
 */
export function parseNaturalLanguageHeuristics(
  input: string,
  preferredName?: string
): BlueprintDefinition | null {
  const text = input.toLowerCase();

  // Pattern A: Round-robin league -> 2nd vs 3rd qualifier -> Grand Final (User's specific case)
  if (
    (text.includes('round-robin') || text.includes('round robin') || text.includes('league stage')) &&
    (text.includes('qualifier') || text.includes('playoff')) &&
    (text.includes('grand final') || text.includes('final'))
  ) {
    const has2ndVs3rd = text.includes('2nd') || text.includes('second');
    const stages: BlueprintStage[] = [
      {
        kind: 'GROUPS',
        name: 'Stage 1: Round-Robin League',
        groups: ['A'],
        legs: text.includes('two legs') || text.includes('2 legs') || text.includes('home and away') ? 2 : 1,
        resetStandings: false,
      },
    ];

    if (has2ndVs3rd) {
      stages.push({
        kind: 'KNOCKOUT',
        name: 'Stage 2: Playoff Qualifier (2nd vs 3rd)',
        roundTag: 'PLAY_IN',
        pairingMode: 'SEEDED',
        qualifiers: ['A:2-3'],
        matchups: [
          { homeSelector: 'A:2', awaySelector: 'A:3', label: 'Playoff Qualifier' },
        ],
        legs: 1,
      });

      stages.push({
        kind: 'KNOCKOUT',
        name: 'Stage 3: Grand Final',
        roundTag: 'FINAL',
        pairingMode: 'SEEDED',
        qualifiers: ['A:1', 'PREV_WIN:1'],
        matchups: [
          { homeSelector: 'A:1', awaySelector: 'PREV_WIN:1', label: 'Grand Final (1st vs Qualifier Winner)' },
        ],
        legs: 1,
      });
    } else {
      // Top 2 to final directly
      stages.push({
        kind: 'KNOCKOUT',
        name: 'Stage 2: Grand Final',
        roundTag: 'FINAL',
        pairingMode: 'SEEDED',
        qualifiers: ['A:1-2'],
        matchups: [
          { homeSelector: 'A:1', awaySelector: 'A:2', label: 'Grand Final' },
        ],
        legs: 1,
      });
    }

    return BlueprintDefinitionSchema.parse({
      name: preferredName || 'Single Round-Robin with Playoffs',
      description: input.trim(),
      stages,
    });
  }

  // Pattern B: 2 Groups -> Top 2 advance to Semi-Finals -> Grand Final
  if (
    (text.includes('2 groups') || text.includes('two groups')) &&
    (text.includes('semi') || text.includes('semis')) &&
    (text.includes('final') || text.includes('finals'))
  ) {
    const legs = text.includes('two legs') || text.includes('2 legs') ? 2 : 1;
    const stages: BlueprintStage[] = [
      {
        kind: 'GROUPS',
        name: 'Stage 1: Group Stage (Groups A & B)',
        groups: ['A', 'B'],
        legs,
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
    ];

    return BlueprintDefinitionSchema.parse({
      name: preferredName || '2-Group Champions Cup',
      description: input.trim(),
      stages,
    });
  }

  // Pattern C: 4 Groups -> Top 2 to Quarter-Finals -> Semi-Finals -> Final (World Cup style)
  if (
    (text.includes('4 groups') || text.includes('four groups')) &&
    (text.includes('quarter') || text.includes('quarters')) &&
    text.includes('final')
  ) {
    const stages: BlueprintStage[] = [
      {
        kind: 'GROUPS',
        name: 'Stage 1: Group Stage (A, B, C, D)',
        groups: ['A', 'B', 'C', 'D'],
        legs: 1,
      },
      {
        kind: 'KNOCKOUT',
        name: 'Stage 2: Quarter-Finals',
        roundTag: 'QUARTER_FINAL',
        pairingMode: 'CROSS_GROUP',
        qualifiers: ['A:1-2', 'B:1-2', 'C:1-2', 'D:1-2'],
        matchups: [
          { homeSelector: 'A:1', awaySelector: 'B:2', label: 'QF 1' },
          { homeSelector: 'C:1', awaySelector: 'D:2', label: 'QF 2' },
          { homeSelector: 'B:1', awaySelector: 'A:2', label: 'QF 3' },
          { homeSelector: 'D:1', awaySelector: 'C:2', label: 'QF 4' },
        ],
        legs: 1,
      },
      {
        kind: 'KNOCKOUT',
        name: 'Stage 3: Semi-Finals',
        roundTag: 'SEMI_FINAL',
        pairingMode: 'SEEDED',
        qualifiers: ['PREV_WIN:ALL'],
        legs: 1,
      },
      {
        kind: 'KNOCKOUT',
        name: 'Stage 4: Grand Final',
        roundTag: 'FINAL',
        pairingMode: 'SEEDED',
        qualifiers: ['PREV_WIN:ALL'],
        legs: 1,
      },
    ];

    return BlueprintDefinitionSchema.parse({
      name: preferredName || '4-Group World Cup Format',
      description: input.trim(),
      stages,
    });
  }

  return null;
}

export async function compileTextToBlueprint(
  rawInput: string,
  preferredName?: string
): Promise<{ blueprint: BlueprintDefinition; compiler: 'DSL' | 'HEURISTIC' | 'AI' }> {
  // 1. Fast offline compact DSL parser
  const dslAttempt = parseCompactDslToBlueprint(rawInput, preferredName || 'Custom Tournament');
  if (dslAttempt) {
    return { blueprint: dslAttempt, compiler: 'DSL' };
  }

  // 2. High-speed offline natural language heuristic matcher
  const heuristicAttempt = parseNaturalLanguageHeuristics(rawInput, preferredName);
  if (heuristicAttempt) {
    return { blueprint: heuristicAttempt, compiler: 'HEURISTIC' };
  }

  // 3. OpenRouter AI Compiler
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey?.trim()) {
    throw new Error(
      'AI Blueprint Compiler requires `OPENROUTER_API_KEY` in .env. Alternatively, provide compact DSL lines (`GROUPS ...` / `KO ...`).'
    );
  }

  const prompt =
    (preferredName ? `Tournament Format Name: ${preferredName}\n\n` : '') +
    `Convert this tournament structure and rules into valid JSON Blueprint:\n\n${rawInput.trim()}`;

  // Prioritize ultra-reliable fast low-cost model, with free fallbacks
  const models = [
    'openai/gpt-4o-mini',
    'openrouter/free',
    'liquid/lfm-3-1.7b:free',
    'nvidia/nemotron-3.5-lightning:free',
    'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free'
  ];

  let rawJsonText: string | null = null;
  let lastError: any = null;

  for (const model of models) {
    try {
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey.trim()}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://github.com/anshul-gaming/beyond-the-final-whistle',
          'X-Title': 'BTFW Tournament Blueprint AI Compiler',
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: COMPILER_SYSTEM_PROMPT },
            { role: 'user', content: prompt },
          ],
          temperature: 0.1,
          max_tokens: 1800,
        }),
        signal: AbortSignal.timeout(20000),
      });

      if (response.ok) {
        const data: any = await response.json();
        const content = data?.choices?.[0]?.message?.content?.trim();
        if (content) {
          rawJsonText = content;
          break;
        }
      } else {
        const errBody = await response.text().catch(() => '');
        lastError = new Error(`Model ${model} returned ${response.status}: ${errBody}`);
      }
    } catch (err: any) {
      lastError = err;
    }
  }

  if (!rawJsonText) {
    throw new Error(`AI compiler failed to generate blueprint: ${lastError?.message || 'No response from OpenRouter'}`);
  }

  const clean = stripJsonFences(rawJsonText);
  let rawParsed: any;
  try {
    rawParsed = JSON.parse(clean);
  } catch (err: any) {
    logger.error({ clean, err: err.message }, 'Failed to parse AI JSON response');
    throw new Error('AI output could not be parsed as valid JSON. Try describing the stages more clearly or use the interactive Stage Builder.');
  }

  if (preferredName?.trim()) {
    rawParsed.name = preferredName.trim();
  }

  const validated = BlueprintDefinitionSchema.parse(rawParsed);
  return { blueprint: validated, compiler: 'AI' };
}
