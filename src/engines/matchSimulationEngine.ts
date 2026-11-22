import { prisma } from '../database/prisma.js';
import { generateAiMinuteCommentary, generateAiNewsArticle, MatchEventData, MatchSummaryData } from '../services/aiEngine.js';
import { logger } from '../utils/logger.js';

export interface SimulatedMatchResult {
  homeTeamName: string;
  awayTeamName: string;
  homeScore: number;
  awayScore: number;
  homePossession: number;
  awayPossession: number;
  commentaryEvents: { minute: number; text: string; header: string; playerTags?: string[] }[];
  newsArticle: string;
  motmPlayerName: string;
  motmRating: number;
}

/**
 * Calculates derived ratings for a footballer
 */
export function calculateDerivedRatings(player: {
  fin: number; pow: number; hea: number;
  pas: number; vis: number; cro: number; dri: number;
  tck: number; int: number; mrk: number;
  pac: number; phy: number; cmp: number; agi: number; wrk: number;
  activeBoots?: string | null;
  intelBonus?: number;
}) {
  const bootBonusAtk = player.activeBoots === 'strika' ? 10 : 0;
  const bootBonusMid = player.activeBoots === 'passa' ? 10 : 0;
  const bootBonusDef = player.activeBoots === 'bully' ? 10 : 0;
  const intelBonus = player.intelBonus || 0;

  const rawAtk = Math.round((player.fin * 2 + player.pow + player.hea + player.pac) / 5);
  const rawMid = Math.round((player.pas * 2 + player.vis * 2 + player.dri + player.cmp) / 6);
  const rawDef = Math.round((player.tck * 2 + player.int * 2 + player.mrk + player.phy) / 6);

  return {
    atk: Math.min(99, rawAtk + bootBonusAtk + intelBonus),
    mid: Math.min(99, rawMid + bootBonusMid + intelBonus),
    def: Math.min(99, rawDef + bootBonusDef + intelBonus)
  };
}

/**
 * Executes full 90-minute AI-powered football match simulation
 */
export async function simulateFullMatch(homePlayerId: string, awayPlayerId?: string): Promise<SimulatedMatchResult> {
  const homePlayer = await prisma.player.findUnique({
    where: { id: homePlayerId },
    include: { nation: true, club: true }
  });

  const awayPlayer = awayPlayerId ? await prisma.player.findUnique({
    where: { id: awayPlayerId },
    include: { nation: true, club: true }
  }) : null;

  const homeTeamName = homePlayer?.nation?.name || homePlayer?.club?.name || `${homePlayer?.username || 'Red'} FC`;
  const awayTeamName = awayPlayer?.nation?.name || awayPlayer?.club?.name || (awayPlayer ? `${awayPlayer.username} FC` : 'All-Star XI');

  const homeRatings = homePlayer ? calculateDerivedRatings(homePlayer) : { atk: 65, mid: 65, def: 65 };
  const awayRatings = awayPlayer ? calculateDerivedRatings(awayPlayer) : { atk: 62, mid: 63, def: 64 };

  let homeScore = 0;
  let awayScore = 0;

  // Determine possession based on midfield battle
  const midDiff = homeRatings.mid - awayRatings.mid;
  const homePossession = Math.min(70, Math.max(30, 50 + Math.round(midDiff * 0.7) + Math.floor(Math.random() * 7 - 3)));
  const awayPossession = 100 - homePossession;

  const events: { minute: number; text: string; header: string; playerTags?: string[] }[] = [];
  const scorers: { minute: number; player: string; team: string; assistBy?: string }[] = [];
  const cards: { minute: number; player: string; type: 'YELLOW' | 'RED'; team: string }[] = [];

  // 0' Kickoff
  const kickoffText = await generateAiMinuteCommentary({
    minute: 0,
    type: 'KICKOFF',
    homeTeam: homeTeamName,
    awayTeam: awayTeamName,
    homeScore: 0,
    awayScore: 0,
    actorPlayer: homePlayer?.username || 'Captain'
  });
  events.push({
    minute: 0,
    header: `🏟️ KICKOFF — ${homeTeamName} 0 : 0 ${awayTeamName}`,
    text: kickoffText,
    playerTags: [homePlayer?.username || 'Home Captain']
  });

  // Key match incidents across 90 minutes
  const keyMinutes = [8, 19, 28, 44, 56, 71, 83, 90];
  let homePlayerGoals = 0;
  let homePlayerAssists = 0;
  let homePlayerTackles = 0;
  let homePlayerShots = 0;

  for (const min of keyMinutes) {
    const isHomeAttack = Math.random() * 100 < homePossession;
    const attackingRatings = isHomeAttack ? homeRatings : awayRatings;
    const defendingRatings = isHomeAttack ? awayRatings : homeRatings;
    const attackingTeam = isHomeAttack ? homeTeamName : awayTeamName;
    const defendingTeam = isHomeAttack ? awayTeamName : homeTeamName;
    const activeAttacker = isHomeAttack ? (homePlayer?.username || 'Striker') : (awayPlayer?.username || 'Striker');
    const activeDefender = isHomeAttack ? (awayPlayer?.username || 'Centre-Back') : (homePlayer?.username || 'Centre-Back');

    const roll = Math.random() * 100;

    if (roll < 35) {
      // Chance & Potential Goal
      homePlayerShots++;
      const goalProbability = Math.max(20, Math.min(80, 45 + (attackingRatings.atk - defendingRatings.def)));
      if (Math.random() * 100 < goalProbability) {
        if (isHomeAttack) {
          homeScore++;
          homePlayerGoals++;
        } else {
          awayScore++;
        }
        scorers.push({ minute: min, player: activeAttacker, team: attackingTeam });

        const commentary = await generateAiMinuteCommentary({
          minute: min,
          type: 'GOAL',
          homeTeam: homeTeamName,
          awayTeam: awayTeamName,
          homeScore,
          awayScore,
          actorPlayer: activeAttacker,
          secondaryPlayer: activeDefender
        });

        events.push({
          minute: min,
          header: `⚽ GOAL! — ${homeTeamName} ${homeScore} : ${awayScore} ${awayTeamName}`,
          text: commentary,
          playerTags: [activeAttacker]
        });
      } else {
        // Great save
        const commentary = await generateAiMinuteCommentary({
          minute: min,
          type: 'SAVE',
          homeTeam: homeTeamName,
          awayTeam: awayTeamName,
          homeScore,
          awayScore,
          actorPlayer: activeDefender,
          secondaryPlayer: activeAttacker
        });
        events.push({
          minute: min,
          header: `🧤 SPECTACULAR SAVE — ${homeTeamName} ${homeScore} : ${awayScore} ${awayTeamName}`,
          text: commentary,
          playerTags: [activeDefender, activeAttacker]
        });
      }
    } else if (roll < 65) {
      // Dribble or Tackle battle
      if (isHomeAttack) homePlayerTackles++;
      const commentary = await generateAiMinuteCommentary({
        minute: min,
        type: 'TACKLE',
        homeTeam: homeTeamName,
        awayTeam: awayTeamName,
        homeScore,
        awayScore,
        actorPlayer: activeDefender,
        secondaryPlayer: activeAttacker
      });
      events.push({
        minute: min,
        header: `🛡️ TACKLE WON — ${activeDefender}`,
        text: commentary,
        playerTags: [activeDefender, activeAttacker]
      });
    } else if (roll < 85) {
      // Buildup play / Key passes
      if (isHomeAttack && Math.random() < 0.4) homePlayerAssists++;
      const commentary = await generateAiMinuteCommentary({
        minute: min,
        type: 'BUILDUP',
        homeTeam: homeTeamName,
        awayTeam: awayTeamName,
        homeScore,
        awayScore,
        actorPlayer: activeAttacker,
        secondaryPlayer: activeDefender
      });
      events.push({
        minute: min,
        header: `⚡ ATTACKING BUILDUP — ${attackingTeam}`,
        text: commentary,
        playerTags: [activeAttacker]
      });
    } else {
      // Tactical Foul / Yellow Card
      cards.push({ minute: min, player: activeDefender, type: 'YELLOW', team: defendingTeam });
      const commentary = await generateAiMinuteCommentary({
        minute: min,
        type: 'YELLOW_CARD',
        homeTeam: homeTeamName,
        awayTeam: awayTeamName,
        homeScore,
        awayScore,
        actorPlayer: activeDefender,
        secondaryPlayer: activeAttacker
      });
      events.push({
        minute: min,
        header: `🟨 YELLOW CARD — ${activeDefender}`,
        text: commentary,
        playerTags: [activeDefender]
      });
    }
  }

  // 90' Full Time
  const fulltimeText = await generateAiMinuteCommentary({
    minute: 90,
    type: 'FULLTIME',
    homeTeam: homeTeamName,
    awayTeam: awayTeamName,
    homeScore,
    awayScore
  });
  events.push({
    minute: 90,
    header: `🏁 FULL TIME — ${homeTeamName} ${homeScore} : ${awayScore} ${awayTeamName}`,
    text: fulltimeText
  });

  // MOTM calculation
  const isHomeWinner = homeScore >= awayScore;
  const motmPlayer = isHomeWinner ? (homePlayer?.username || 'Captain') : (awayPlayer?.username || 'Opponent Star');
  const motmTeam = isHomeWinner ? homeTeamName : awayTeamName;
  const motmRating = +(7.5 + (homePlayerGoals * 0.7) + (homePlayerAssists * 0.4) + Math.random() * 0.5).toFixed(1);
  const motmStats = `${homePlayerGoals} Goal(s), ${homePlayerAssists} Assist(s), ${homePlayerTackles} Tackle(s)`;

  // Generate sensational sports newspaper article with AI
  const newsArticle = await generateAiNewsArticle({
    homeTeam: homeTeamName,
    awayTeam: awayTeamName,
    homeScore,
    awayScore,
    homePossession,
    awayPossession,
    scorers,
    cards,
    motm: {
      player: motmPlayer,
      team: motmTeam,
      rating: motmRating,
      stats: motmStats
    }
  });

  // Persist Match Record and update Player Career Stats
  if (homePlayer) {
    await prisma.player.update({
      where: { id: homePlayer.id },
      data: {
        matchesPlayed: { increment: 1 },
        goalsScored: { increment: homePlayerGoals },
        assists: { increment: homePlayerAssists },
        shots: { increment: homePlayerShots },
        tacklesWon: { increment: homePlayerTackles },
        motmCount: isHomeWinner && homePlayerGoals > 0 ? { increment: 1 } : undefined,
        stamina: Math.max(10, homePlayer.stamina - 25), // Match drains stamina
        intelBonus: 0, // Intel resets after matchday
        activeBoots: null // Boots reset after matchday
      }
    });
  }

  await prisma.matchSimulation.create({
    data: {
      homeTeamName,
      awayTeamName,
      homeScore,
      awayScore,
      homePossession,
      awayPossession,
      motmPlayerId: homePlayer?.id,
      motmRating,
      commentaryLogs: JSON.stringify(events),
      aiNewsArticle: newsArticle
    }
  });

  return {
    homeTeamName,
    awayTeamName,
    homeScore,
    awayScore,
    homePossession,
    awayPossession,
    commentaryEvents: events,
    newsArticle,
    motmPlayerName: motmPlayer,
    motmRating
  };
}
