import { logger } from '../utils/logger.js';

export interface MatchEventData {
  minute: number;
  type: 'KICKOFF' | 'BUILDUP' | 'TACKLE' | 'CORNER' | 'DRIBBLE' | 'OFFSIDE' | 'GOAL' | 'SAVE' | 'YELLOW_CARD' | 'RED_CARD' | 'FULLTIME';
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
  actorPlayer?: string;
  actorTeam?: string;
  secondaryPlayer?: string;
  secondaryTeam?: string;
  details?: string;
}

export interface MatchSummaryData {
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
  homePossession: number;
  awayPossession: number;
  scorers: { minute: number; player: string; team: string; assistBy?: string }[];
  cards: { minute: number; player: string; type: 'YELLOW' | 'RED'; team: string }[];
  motm: { player: string; team: string; rating: number; stats: string };
  tournamentName?: string;
}

async function callOpenRouter(systemPrompt: string, userPrompt: string): Promise<string | null> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  const openaiKey = process.env['openai-key'] || process.env.OPENAI_API_KEY;

  // Try OpenRouter first with openai/gpt-4o-mini
  if (apiKey && apiKey.trim() !== '') {
    try {
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey.trim()}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://github.com/anshul-gaming/beyond-the-final-whistle',
          'X-Title': 'Beyond The Final Whistle Football Bot'
        },
        body: JSON.stringify({
          model: 'openai/gpt-4o-mini',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          temperature: 0.85,
          max_tokens: 1000
        }),
        signal: AbortSignal.timeout(10000)
      });

      if (response.ok) {
        const data: any = await response.json();
        const content = data?.choices?.[0]?.message?.content?.trim();
        if (content) return content;
      }
    } catch (err: any) {
      logger.warn({ err: err.message }, 'OpenRouter AI completion error, trying fallback');
    }
  }

  // Fallback to direct OpenAI API with gpt-4o-mini
  if (openaiKey && openaiKey.trim() !== '') {
    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openaiKey.trim()}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          temperature: 0.85,
          max_tokens: 1000
        }),
        signal: AbortSignal.timeout(10000)
      });

      if (response.ok) {
        const data: any = await response.json();
        const content = data?.choices?.[0]?.message?.content?.trim();
        if (content) return content;
      }
    } catch (err: any) {
      logger.warn({ err: err.message }, 'Direct OpenAI completion error');
    }
  }

  return null;
}

/**
 * Generate energetic, tactical football match play commentary
 */
export async function generateAiMinuteCommentary(event: MatchEventData): Promise<string> {
  const systemPrompt = `You are the lead matchday commentator for "Beyond The Final Whistle" (an intense football simulation Discord RPG like WITS).
Output exactly 2-3 sentences of broadcast commentary with real match emotion, player names, and technical football terminology.
Keep it punchy, sharp, and visceral. Do not include markdown headers or meta commentary.`;

  const userPrompt = `Minute: ${event.minute}'
Event: ${event.type}
Scoreline: ${event.homeTeam} ${event.homeScore} - ${event.awayScore} ${event.awayTeam}
Key Player: ${event.actorPlayer || 'Midfield battler'}
Secondary Player: ${event.secondaryPlayer || 'Defender'}
Context: ${event.details || 'Intense contest in the final third'}`;

  const aiResult = await callOpenRouter(systemPrompt, userPrompt);
  if (aiResult) return aiResult;

  // High quality algorithmic fallback
  switch (event.type) {
    case 'KICKOFF':
      return `And we're underway! The referee blows the whistle as ${event.homeTeam} set the tempo early, moving the ball briskly across the pitch. ${event.actorPlayer || 'The frontline'} presses high immediately!`;
    case 'BUILDUP':
      return `${event.actorPlayer || 'The midfielder'} carries it through the half-space, threading a crisp pass to ${event.secondaryPlayer || 'the flank'}. The defensive shape is being tested as the tempo rapidly spikes!`;
    case 'TACKLE':
      return `Brutal, crunching challenge from ${event.actorPlayer}! Timed to absolute perfection—dispossessing ${event.secondaryPlayer} and immediately releasing the counter-attack!`;
    case 'DRIBBLE':
      return `${event.actorPlayer} drops the shoulder with explosive agility, leaving ${event.secondaryPlayer} scrambling on the turn! Pure technical wizardry down the channel!`;
    case 'CORNER':
      return `Danger looming in the penalty box! ${event.actorPlayer} whips in a venomous inswinger toward the near post, looking for aerial supremacy!`;
    case 'SAVE':
      return `WHAT A FLYING SAVE! ${event.actorPlayer} launches horizontally through the air to tip ${event.secondaryPlayer}'s stinging strike around the post! Pure reflexes!`;
    case 'GOAL':
      return `GOOOOOOAL! SENSATIONAL FINISH! ${event.actorPlayer} hammers it past the goalkeeper into the roof of the net! The stadium erupts as ${event.homeTeam} celebrate!`;
    case 'YELLOW_CARD':
      return `The referee reaches into his pocket! Yellow card for ${event.actorPlayer} after a cynical trip on ${event.secondaryPlayer} to break up the transition!`;
    case 'RED_CARD':
      return `RED CARD! DISASTER! ${event.actorPlayer} receives his marching orders for a dangerous lunging tackle! A catastrophic blow for the side!`;
    case 'OFFSIDE':
      return `The linesman raises the flag! ${event.actorPlayer} timed the run slightly too eager, caught by the disciplined offside trap!`;
    case 'FULLTIME':
      return `The final whistle sounds! It's all over! What a heart-stopping football drama from the first minute to the last!`;
    default:
      return `${event.actorPlayer || 'The team'} pushes forward with relentless attacking intent!`;
  }
}

/**
 * Generate full sports newspaper article with headlines, quotes, and tactical review
 */
export async function generateAiNewsArticle(summary: MatchSummaryData): Promise<string> {
  const systemPrompt = `You are the chief sports editor for "Beyond The Final Whistle" newspaper (modeled on the elite, emotional journalism of WITS World Cup coverage).
Write a gripping, authentic sports newspaper match recap featuring:
1. An iconic uppercase headline starting with 📰.
2. A dramatic bold sub-headline highlighting redemption, clutch moments, or heartbreak.
3. 2 paragraphs of match recap capturing the momentum swings, key goal minutes, and pivotal tactical battles.
4. Man of the Match (MOTM) spotlight with rating and player quote.
Use real football drama and style like: "mocked after early tournament struggles, he answered with pure ice in his veins".`;

  const userPrompt = `Match: ${summary.homeTeam} ${summary.homeScore} – ${summary.awayScore} ${summary.awayTeam}
Possession: ${summary.homeTeam} ${summary.homePossession}% | ${summary.awayPossession}% ${summary.awayTeam}
Goals: ${summary.scorers.map(s => `${s.minute}' ${s.player} (${s.team})` + (s.assistBy ? ` [Assist: ${s.assistBy}]` : '')).join(', ') || 'None'}
Discipline: ${summary.cards.map(c => `${c.minute}' ${c.type} for ${c.player}`).join(', ') || 'Clean match'}
MOTM: ${summary.motm.player} (${summary.motm.team}) - Rating ${summary.motm.rating} (${summary.motm.stats})`;

  const aiResult = await callOpenRouter(systemPrompt, userPrompt);
  if (aiResult) return aiResult;

  // High quality journalism fallback
  const winner = summary.homeScore > summary.awayScore ? summary.homeTeam : summary.awayScore > summary.homeScore ? summary.awayTeam : 'Draw';
  const headline = winner !== 'Draw'
    ? `📰 BEYOND THE FINAL WHISTLE: ${summary.motm.player.toUpperCase()} DELIVERS MATCHDAY MASTERCLASS! 📰`
    : `📰 BEYOND THE FINAL WHISTLE: STALEMATE AS ${summary.homeTeam.toUpperCase()} AND ${summary.awayTeam.toUpperCase()} SHARE THE POINTS! 📰`;

  const goalsText = summary.scorers.length > 0
    ? summary.scorers.map(s => `• ${s.minute}' ⚽ **${s.player}** strikes for ${s.team}!${s.assistBy ? ` *(Assist: ${s.assistBy})*` : ''}`).join('\n')
    : '*No goals scored — defensive war of attrition.*';

  return `${headline}\n\n` +
    `⚡ **FROM DOUBTERS TO HEROES: ${summary.motm.player} STEALS THE SHOW IN A DRAMATIC 90-MINUTE SHOWDOWN!**\n\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `**${summary.homeTeam} ${summary.homeScore} – ${summary.awayScore} ${summary.awayTeam}**\n` +
    `Possession: ${summary.homeTeam} ${summary.homePossession}% | ${summary.awayPossession}% ${summary.awayTeam}\n\n` +
    `${goalsText}\n\n` +
    `👑 **MOTM: ${summary.motm.player} (${summary.motm.team})** — \`${summary.motm.rating} Rating\` | *${summary.motm.stats}*\n\n` +
    `Speaking in the tunnel post-match, ${summary.motm.player} smiled with ice in their veins: *"We worked all week for this moment. When the opportunity came, we executed with complete conviction."*\n\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `*Beyond The Final Whistle Sports Bureau*`;
}
