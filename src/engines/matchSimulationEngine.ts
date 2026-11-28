import { prisma } from '../database/prisma.js';
import { ATTRIBUTES_LIST } from '../config/constants.js';
import { generateAiMinuteCommentary, generateAiNewsArticle, MatchEventData, MatchSummaryData } from '../services/aiEngine.js';
import { parseTeamTactics, TeamTactics } from '../commands/tacticsCommand.js';
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
  isExhibition?: boolean;
  motmBoost?: { playerName: string; attrName: string; attrKey: string; delta: number; oldVal: number; newVal: number };
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
  trainingPoints?: number;
  position?: string;
}, playingPosition?: string) {
  const rawPos = (playingPosition || player.position || 'ATT').toUpperCase();
  const pos = rawPos === 'ATTACKER' || rawPos === 'FWD' || rawPos === 'ST' ? 'ATK'
    : rawPos === 'MIDFIELDER' ? 'MID'
    : rawPos === 'DEFENDER' ? 'DEF'
    : rawPos;

  // Capped at +10 max from collected TP (+1 per 4 TP)
  const tpBoost = Math.min(10, Math.floor((player.trainingPoints || 0) / 4));

  // Position-locked boots: strika -> ATK, passa -> MID, bully -> DEF
  const bootBonusAtk = (pos === 'ATK' && player.activeBoots === 'strika') ? 10 : 0;
  const bootBonusMid = (pos === 'MID' && player.activeBoots === 'passa') ? 10 : 0;
  const bootBonusDef = (pos === 'DEF' && player.activeBoots === 'bully') ? 10 : 0;

  // Intel bonus applies strictly to the position played
  const intelBonus = player.intelBonus || 0;

  const rawAtk = Math.round((player.fin * 2 + player.pow + player.hea + player.pac) / 5);
  const rawMid = Math.round((player.pas * 2 + player.vis * 2 + player.dri + player.cmp) / 6);
  const rawDef = Math.round((player.tck * 2 + player.int * 2 + player.mrk + player.phy) / 6);

  return {
    atk: Math.min(99, rawAtk + bootBonusAtk + (pos === 'ATK' ? intelBonus + tpBoost : 0)),
    mid: Math.min(99, rawMid + bootBonusMid + (pos === 'MID' ? intelBonus + tpBoost : 0)),
    def: Math.min(99, rawDef + bootBonusDef + (pos === 'DEF' ? intelBonus + tpBoost : 0))
  };
}

/**
 * Applies tactical modifiers to a team's base ratings and possession
 */
function applyTacticalModifiers(baseRatings: { atk: number; mid: number; def: number }, tactics: TeamTactics) {
  const ratings = { ...baseRatings };
  let possMod = 0;

  // 1. Team Mentality
  switch (tactics.teamMentality) {
    case 'Hard Defending':
      ratings.atk = Math.max(20, ratings.atk - 15);
      ratings.def = Math.min(99, ratings.def + 15);
      possMod -= 10;
      break;
    case 'Defensive':
      ratings.atk = Math.max(25, ratings.atk - 8);
      ratings.def = Math.min(99, ratings.def + 8);
      possMod -= 5;
      break;
    case 'Attacking':
      ratings.atk = Math.min(99, ratings.atk + 8);
      ratings.def = Math.max(25, ratings.def - 8);
      possMod += 5;
      break;
    case 'Hard Attacking':
      ratings.atk = Math.min(99, ratings.atk + 15);
      ratings.def = Math.max(20, ratings.def - 15);
      possMod += 10;
      break;
  }

  // 2. Passing Style
  if (tactics.passingStyle === 'Short') {
    possMod += 6;
  } else if (tactics.passingStyle === 'Long') {
    possMod -= 6;
  }

  // 3. Pressing Style
  if (tactics.pressingStyle === 'High') {
    possMod += 4;
  } else if (tactics.pressingStyle === 'Low') {
    possMod -= 4;
  }

  return { ratings, possMod };
}

/**
 * Executes full 90-minute AI-powered football match simulation incorporating deep team tactics
 */
export async function simulateFullMatch(
  homePlayerId: string,
  awayPlayerId?: string,
  options: { isExhibition?: boolean } = {}
): Promise<SimulatedMatchResult> {
  const isExhibition = Boolean(options.isExhibition);
  const homePlayer = await prisma.player.findUnique({
    where: { id: homePlayerId },
    include: { nation: true, club: true }
  });

  if (isExhibition && (!homePlayer || homePlayer.vipTier < 1)) {
    throw new Error('VIP status is required to host All-Star Exhibition Friendlies (`-friendly`).');
  }

  const awayPlayer = awayPlayerId ? await prisma.player.findUnique({
    where: { id: awayPlayerId },
    include: { nation: true, club: true }
  }) : null;

  const homeTeam = homePlayer?.nation || homePlayer?.club;
  const awayTeam = awayPlayer?.nation || awayPlayer?.club;

  const homeTactics = parseTeamTactics(homeTeam?.tactics);
  const awayTactics = parseTeamTactics(awayTeam?.tactics);

  const homeTeamName = isExhibition
    ? `${homePlayer?.username || 'VIP'} All-Stars`
    : (homeTeam?.name || `${homePlayer?.username || 'Home'} FC`);
  const awayTeamName = isExhibition
    ? (awayPlayer ? `${awayPlayer.username} Select XI` : 'VIP Legends XI')
    : (awayTeam?.name || (awayPlayer ? `${awayPlayer.username} FC` : 'All-Star XI'));

  const rawHomeRatings = homePlayer ? calculateDerivedRatings(homePlayer) : { atk: 65, mid: 65, def: 65 };
  const rawAwayRatings = awayPlayer ? calculateDerivedRatings(awayPlayer) : { atk: 62, mid: 63, def: 64 };

  const homeTactical = applyTacticalModifiers(rawHomeRatings, homeTactics);
  const awayTactical = applyTacticalModifiers(rawAwayRatings, awayTactics);

  const homeRatings = homeTactical.ratings;
  const awayRatings = awayTactical.ratings;

  let homeScore = 0;
  let awayScore = 0;

  // Determine possession based on midfield battle + tactical modifiers
  const midDiff = homeRatings.mid - awayRatings.mid;
  const rawHomePoss = 50 + Math.round(midDiff * 0.5) + (homeTactical.possMod - awayTactical.possMod) + Math.floor(Math.random() * 7 - 3);
  const homePossession = Math.min(75, Math.max(25, rawHomePoss));
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
    header: `🏟️ KICKOFF — ${homeTeamName} (Mentality: ${homeTactics.teamMentality}) vs ${awayTeamName} (Mentality: ${awayTactics.teamMentality})`,
    text: kickoffText,
    playerTags: [homePlayer?.username || 'Home Captain']
  });

  // Key match incidents across 90 minutes
  const keyMinutes = [8, 19, 28, 44, 56, 71, 83, 90];
  let homePlayerGoals = 0;
  let homePlayerAssists = 0;
  let homePlayerTackles = 0;
  let homePlayerShots = 0;
  let homePlayerPasses = homeTactics.passingStyle === 'Short' ? 38 : homeTactics.passingStyle === 'Long' ? 18 : 26;

  for (const min of keyMinutes) {
    const isHomeAttack = Math.random() * 100 < homePossession;
    const attackingRatings = isHomeAttack ? homeRatings : awayRatings;
    const defendingRatings = isHomeAttack ? awayRatings : homeRatings;
    const attackingTeam = isHomeAttack ? homeTeamName : awayTeamName;
    const defendingTeam = isHomeAttack ? awayTeamName : homeTeamName;
    const attackingTactics = isHomeAttack ? homeTactics : awayTactics;
    const defendingTactics = isHomeAttack ? awayTactics : homeTactics;
    const activeAttacker = isHomeAttack ? (homePlayer?.username || 'Striker') : (awayPlayer?.username || 'Striker');
    const activeDefender = isHomeAttack ? (awayPlayer?.username || 'Centre-Back') : (homePlayer?.username || 'Centre-Back');

    const roll = Math.random() * 100;

    // 1. Offside Trap Check (if defending team has Offside Trap On)
    if (defendingTactics.offsideTrap === 'On' && roll < 38) {
      const attackerPace = isHomeAttack ? (homePlayer?.pac || 50) : (awayPlayer?.pac || 50);
      const attackerVision = isHomeAttack ? (homePlayer?.vis || 50) : (awayPlayer?.vis || 50);

      // If attacker is fast/smart, offside trap is breached!
      if (attackerPace > 75 || attackerVision > 75 || Math.random() < 0.35) {
        // Trap breached -> Huge chance
        if (isHomeAttack) homePlayerShots++;
        const goalProbability = Math.max(35, Math.min(85, 55 + (attackingRatings.atk - defendingRatings.def)));
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
            header: `⚠️ OFFSIDE TRAP BEATEN & GOAL! — ${attackingTeam}`,
            text: `${activeAttacker} sprints cleanly through the high line and tucks the ball into the corner! ${commentary}`,
            playerTags: [activeAttacker]
          });
          continue;
        }
      } else {
        // Offside trap successfully catches attacker
        events.push({
          minute: min,
          header: `🚩 OFFSIDE FLAG RAISED — ${activeAttacker}`,
          text: `Assistant referee raises the flag! ${defendingTeam}'s disciplined offside trap steps up in unison, leaving ${activeAttacker} caught leaning offside.`,
          playerTags: [activeAttacker, activeDefender]
        });
        continue;
      }
    }

    // 2. Goal Scoring Chances
    if (roll < 35) {
      if (isHomeAttack) homePlayerShots++;
      let goalProbability = Math.max(20, Math.min(80, 45 + (attackingRatings.atk - defendingRatings.def)));

      // Counter attack bonus if counter-attack is active
      if (attackingTactics.forceCounter === 'On' && defendingTactics.teamMentality.includes('Attack')) {
        goalProbability += 15;
      }

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

        const headerPrefix = attackingTactics.forceCounter === 'On' && Math.random() < 0.5 
          ? `⚡ COUNTER-ATTACK GOAL!` 
          : attackingTactics.focusPassing === 'Down Both Flanks' 
          ? `👟 FLANK CROSS & GOAL!` 
          : `⚽ GOAL!`;

        events.push({
          minute: min,
          header: `${headerPrefix} — ${homeTeamName} ${homeScore} : ${awayScore} ${awayTeamName}`,
          text: commentary,
          playerTags: [activeAttacker]
        });
      } else {
        // Save
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
          header: `🧤 SPECTACULAR SAVE — ${defendingTeam}`,
          text: commentary,
          playerTags: [activeDefender, activeAttacker]
        });
      }
    } else if (roll < 65) {
      // 3. Tackles & Turnovers (Pressing & Tackling Styles)
      if (isHomeAttack) homePlayerTackles++;

      const isHardTackle = defendingTactics.tacklingStyle === 'Hard';
      const isHighPress = defendingTactics.pressingStyle === 'High';

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

      const header = isHighPress 
        ? `🔥 HIGH PRESS TURNOVER — ${activeDefender}` 
        : isHardTackle 
        ? `💥 CRUNCHING HARD TACKLE — ${activeDefender}` 
        : `🛡️ TACKLE WON — ${activeDefender}`;

      events.push({
        minute: min,
        header,
        text: commentary,
        playerTags: [activeDefender, activeAttacker]
      });
    } else if (roll < 85) {
      // 4. Tactical Buildup (Passing Style & Focus)
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

      const focusHeader = attackingTactics.focusPassing === 'Through The Middle' 
        ? `🪄 SLICED THROUGH THE MIDDLE — ${attackingTeam}` 
        : attackingTactics.focusPassing.includes('Flank') 
        ? `👟 WHIPPED CROSS INTO THE BOX — ${attackingTeam}` 
        : attackingTactics.passingStyle === 'Short' 
        ? `✨ TIKI-TAKA COMBINATION — ${attackingTeam}` 
        : `⚡ ATTACKING BUILDUP — ${attackingTeam}`;

      events.push({
        minute: min,
        header: focusHeader,
        text: commentary,
        playerTags: [activeAttacker]
      });
    } else {
      // 5. Tactical Foul / Discipline (Influenced by Tackling Style)
      const isHardTackling = defendingTactics.tacklingStyle === 'Hard';
      const isEasyTackling = defendingTactics.tacklingStyle === 'Easy';

      if (isEasyTackling && Math.random() < 0.7) {
        // Clean gentle dispossess without card
        events.push({
          minute: min,
          header: `🛡️ JOCKEYING & CONTAINMENT — ${activeDefender}`,
          text: `${activeDefender} stays on their feet with disciplined jockeying and intercepts the attack cleanly without conceding a foul.`,
          playerTags: [activeDefender]
        });
      } else {
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
          header: `🟨 YELLOW CARD ${isHardTackling ? '(Hard Challenge)' : ''} — ${activeDefender}`,
          text: commentary,
          playerTags: [activeDefender]
        });
      }
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
  const isDraw = homeScore === awayScore;
  const isHomeWinner = homeScore > awayScore;
  const motmOwner = (isHomeWinner || isDraw) ? homePlayer : (awayPlayer || homePlayer);
  const motmPlayer = isHomeWinner
    ? (homePlayer?.username || 'Captain')
    : isDraw
      ? (homePlayer?.username || 'Star Midfielder')
      : (awayPlayer?.username || 'Opponent Star');
  const motmTeam = (isHomeWinner || isDraw) ? homeTeamName : awayTeamName;
  const motmRating = +Math.min(10.0, 7.5 + (homePlayerGoals * 0.7) + (homePlayerAssists * 0.4) + Math.random() * 0.6).toFixed(1);
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

  // Stamina consumption (halved in friendly exhibition matches)
  const rawDrain = (homeTactics.pressingStyle === 'High' || homeTactics.teamMentality === 'Hard Attacking') ? 30 : (homeTactics.pressingStyle === 'Low') ? 20 : 25;
  const homeStaminaDrain = isExhibition ? Math.round(rawDrain / 2) : rawDrain;

  // Exhibition All-Star MOTM +1 to +2 Attribute Boost (Zero attribute deduction ever in exhibition matches!)
  let motmBoost: SimulatedMatchResult['motmBoost'];
  if (isExhibition && motmOwner) {
    const eligibleAttrs = ATTRIBUTES_LIST.filter(a => ((motmOwner as any)[a.key] as number) < 99);
    if (eligibleAttrs.length > 0) {
      const picked = eligibleAttrs[Math.floor(Math.random() * eligibleAttrs.length)];
      const oldVal = (motmOwner as any)[picked.key] as number;
      const delta = Math.min(99 - oldVal, Math.random() < 0.45 ? 2 : 1);
      const newVal = oldVal + delta;
      await prisma.player.update({
        where: { id: motmOwner.id },
        data: { [picked.key]: newVal }
      });
      motmBoost = {
        playerName: motmOwner.username,
        attrName: picked.name,
        attrKey: picked.key.toUpperCase(),
        delta,
        oldVal,
        newVal
      };
    }
  }

  // Persist Match Record and update Player Career Stats
  if (homePlayer) {
    let parsedRatings: number[] = [];
    try {
      const raw = JSON.parse(homePlayer.recentRatings || '[]');
      if (Array.isArray(raw)) parsedRatings = raw.map(Number).filter(n => !isNaN(n));
    } catch {}
    parsedRatings.push(isHomeWinner ? motmRating : +Math.max(5.8, motmRating - 0.8).toFixed(1));
    if (parsedRatings.length > 5) parsedRatings = parsedRatings.slice(-5);

    const possWonDelta = Math.max(3, Math.round(homePossession / 8));
    const possLostDelta = Math.max(2, Math.round(awayPossession / 10));

    await prisma.player.update({
      where: { id: homePlayer.id },
      data: {
        matchesPlayed: { increment: 1 },
        wins: isHomeWinner ? { increment: 1 } : undefined,
        draws: isDraw ? { increment: 1 } : undefined,
        losses: (!isHomeWinner && !isDraw) ? { increment: 1 } : undefined,
        goalsScored: { increment: homePlayerGoals },
        assists: { increment: homePlayerAssists },
        shots: { increment: homePlayerShots },
        tacklesWon: { increment: homePlayerTackles },
        passesCompleted: { increment: homePlayerPasses },
        passesAttempted: { increment: homePlayerPasses + 5 },
        possessionWon: { increment: possWonDelta },
        possessionLost: { increment: possLostDelta },
        cleanSheets: awayScore === 0 ? { increment: 1 } : undefined,
        motmCount: motmOwner?.id === homePlayer.id ? { increment: 1 } : undefined,
        recentRatings: JSON.stringify(parsedRatings),
        stamina: Math.max(10, homePlayer.stamina - homeStaminaDrain),
        intelBonus: isExhibition ? homePlayer.intelBonus : 0, // Friendly exhibitions preserve matchday intel/boots
        activeBoots: isExhibition ? homePlayer.activeBoots : null
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
      motmPlayerId: motmOwner?.id,
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
    motmRating,
    isExhibition,
    motmBoost
  };
}
