import { TextChannel, EmbedBuilder, AttachmentBuilder, Client } from 'discord.js';
import path from 'path';
import fs from 'fs';
import { generatePossessionPieChart, generateMatchScorecardGraphic } from '../utils/chartHelper.js';
import { TeamTactics } from '../commands/tacticsCommand.js';
import { generateAiMinuteCommentary, generateAiNewsArticle, MatchEventData } from '../services/aiEngine.js';
import { logger } from '../utils/logger.js';

export interface MatchPlayer {
  id: string;
  name: string;
  position: 'ATK' | 'MID' | 'DEF';
  playstyle: string;
  flag: string;
  discordId?: string;
  // Attributes (1-99)
  fin: number;
  pas: number;
  tck: number;
  dri: number;
  int: number;
  pac: number;
  cmp: number;
  vis: number;
  phy: number;
  wrk: number;
  hea?: number;
  pow?: number;
  agi?: number;
  // Match stats tracked dynamically
  goals: number;
  assists: number;
  shots: number;
  tackles: number;
  interceptions: number;
  passesCompleted: number;
  passesAttempted?: number;
  dribblesWon: number;
  fouls: number;
  yellowCards: number;
  redCards: number;
  rating: number;
}

export interface MatchTeam {
  name: string;
  alias: string;
  flag: string;
  tactics: TeamTactics;
  penaltyTakerName: string;
  freeKickTakerName: string;
  cornerTakerName: string;
  captainName?: string;
  players: {
    atk: MatchPlayer;
    mid: MatchPlayer;
    def: MatchPlayer;
  };
  score: number;
  possession: number;
  color: [number, number, number];
}

export interface LiveMatchOptions {
  tickDelayMs?: number;        // Delay between incident messages (default 3200ms)
  halfTimePauseMs?: number;    // Half-time pause (default 8000ms for fast broadcast, 180000ms for official)
  newsChannelId?: string;      // Destination for AI Gazette (#news)
}

const sleep = (ms: number) => new Promise(res => setTimeout(res, ms));

/**
 * Calculates dynamic player ratings based on real match contributions
 */
function calculatePlayerRating(player: MatchPlayer, teamWon: boolean, cleanSheet: boolean): number {
  let base = 6.0;

  base += player.goals * 1.2;
  base += player.assists * 0.8;
  base += player.tackles * 0.35;
  base += player.interceptions * 0.35;
  base += player.dribblesWon * 0.25;
  base += (player.passesCompleted / 10) * 0.2;
  base -= player.fouls * 0.25;
  base -= player.yellowCards * 0.7;
  base -= player.redCards * 2.5;

  if (teamWon) base += 0.4;
  if (cleanSheet && player.position === 'DEF') base += 0.9;
  if (cleanSheet && player.position === 'MID') base += 0.4;

  base += (Math.random() * 0.4 - 0.2);
  return +Math.max(4.0, Math.min(10.0, base)).toFixed(1);
}

/**
 * The Greatest Discord Football Simulator:
 * Incorporates 30+ distinct tactical interaction events, 9 positional playstyles, and deep tactical parameters
 */
export async function runLiveEpisodicMatch(
  client: Client,
  channel: TextChannel,
  homeTeam: MatchTeam,
  awayTeam: MatchTeam,
  options: LiveMatchOptions = {}
) {
  const tickDelay = options.tickDelayMs ?? 3200;
  const halfTimePause = options.halfTimePauseMs ?? 8000;
  const newsChannelId = options.newsChannelId ?? '1574439119227064402'; // #๑•📰│btfw-news

  logger.info(`⚽ Starting grand 30+ scenario simulation: ${homeTeam.name} vs ${awayTeam.name} in #${channel.name}`);

  // 1. Calculate dynamic baseline possession from midfield battle + tactics
  const homeMidScore = (homeTeam.players.mid.pas * 2 + homeTeam.players.mid.vis + homeTeam.players.mid.cmp + homeTeam.players.mid.wrk) / 5;
  const awayMidScore = (awayTeam.players.mid.pas * 2 + awayTeam.players.mid.vis + awayTeam.players.mid.cmp + awayTeam.players.mid.wrk) / 5;
  let homePossBonus = (homeMidScore - awayMidScore) * 0.35;

  // Realistic tactical possession adjustments (+/- 1.5% to 3.5%)
  if (homeTeam.tactics.passingStyle === 'Short') homePossBonus += 2.5;
  if (homeTeam.tactics.passingStyle === 'Long') homePossBonus -= 2.5;
  if (awayTeam.tactics.passingStyle === 'Short') homePossBonus -= 2.5;
  if (awayTeam.tactics.passingStyle === 'Long') homePossBonus += 2.5;

  if (homeTeam.tactics.pressingStyle === 'High') homePossBonus += 1.5;
  if (awayTeam.tactics.pressingStyle === 'High') homePossBonus -= 1.5;

  if (homeTeam.tactics.teamMentality === 'Attacking') homePossBonus += 2.0;
  else if (homeTeam.tactics.teamMentality === 'Hard Attacking') homePossBonus += 3.5;
  else if (homeTeam.tactics.teamMentality === 'Defensive') homePossBonus -= 2.0;
  else if (homeTeam.tactics.teamMentality === 'Hard Defending') homePossBonus -= 3.5;

  if (awayTeam.tactics.teamMentality === 'Attacking') homePossBonus -= 2.0;
  else if (awayTeam.tactics.teamMentality === 'Hard Attacking') homePossBonus -= 3.5;
  else if (awayTeam.tactics.teamMentality === 'Defensive') homePossBonus += 2.0;
  else if (awayTeam.tactics.teamMentality === 'Hard Defending') homePossBonus += 3.5;

  const calculatedHomePoss = Math.max(36, Math.min(64, Math.round(50 + homePossBonus + (Math.random() * 4 - 2))));
  homeTeam.possession = calculatedHomePoss;
  awayTeam.possession = 100 - calculatedHomePoss;

  const matchChronology: string[] = [];
  const scorers: { minute: number; player: string; team: string; assistBy?: string }[] = [];
  const cards: { minute: number; player: string; type: 'YELLOW' | 'RED'; team: string }[] = [];

  const formatMention = (p: MatchPlayer) => p.discordId ? `<@${p.discordId}>` : `@${p.name} ${p.flag}`;

  // Helper to send individual incident cards matching WITS broadcast format
  const sendIncident = async (data: {
    minute: number | string;
    icon: string;
    eventTitle: string;
    actor: MatchPlayer;
    narrative: string;
    secondaryPlayer?: MatchPlayer;
    extraMentions?: MatchPlayer[];
  }) => {
    // If the incident itself is a RED CARD dismissal, the actor is mentioned for the card
    const isDismissalCard = typeof data.eventTitle === 'string' && data.eventTitle.includes('RED CARD');

    const mentions: string[] = [];
    if (data.actor && (data.actor.redCards === 0 || isDismissalCard)) {
      mentions.push(formatMention(data.actor));
    }
    if (data.secondaryPlayer && data.secondaryPlayer.redCards === 0) {
      const m = formatMention(data.secondaryPlayer);
      if (!mentions.includes(m)) mentions.push(m);
    }
    if (data.extraMentions) {
      for (const p of data.extraMentions) {
        if (p && p.redCards === 0) {
          const m = formatMention(p);
          if (!mentions.includes(m)) mentions.push(m);
        }
      }
    }

    const embed = new EmbedBuilder()
      .setColor('#1e293b')
      .setAuthor({ name: `${data.minute}' 🕒` })
      .setTitle(`${data.icon} ${data.eventTitle} — ${data.actor.name} ${data.actor.flag}`)
      .setDescription(
        `### ${homeTeam.name} ${homeTeam.score} : ${awayTeam.score} ${awayTeam.name}\n\n` +
        `${data.narrative}\n\n` +
        `${mentions.join(' ')}`
      );

    if (client.user?.displayAvatarURL()) {
      embed.setThumbnail(client.user.displayAvatarURL());
    }

    await channel.send({ embeds: [embed] });
  };

  // Helper to get active (non-ejected) players on a team
  const getActivePlayers = (team: MatchTeam): MatchPlayer[] => {
    const list = [team.players.atk, team.players.mid, team.players.def].filter(p => p.redCards === 0);
    return list.length > 0 ? list : [team.players.mid];
  };

  // Helper to pick set piece specialist (ONLY among active players on the pitch!)
  const getSpecialist = (team: MatchTeam, type: 'FK' | 'CORNER' | 'PEN'): MatchPlayer => {
    const active = getActivePlayers(team);
    const name = (type === 'FK' ? team.freeKickTakerName : type === 'CORNER' ? team.cornerTakerName : team.penaltyTakerName) || '';
    const match = active.find(p => p.name.toLowerCase() === name.toLowerCase());
    if (match) return match;
    // If designated specialist was sent off, pick the best remaining active player
    return active.slice().sort((a, b) => {
      const scoreA = a.cmp + (type === 'FK' ? a.fin : type === 'CORNER' ? a.pas : a.fin);
      const scoreB = b.cmp + (type === 'FK' ? b.fin : type === 'CORNER' ? b.pas : b.fin);
      return scoreB - scoreA;
    })[0];
  };

  // 0' Kickoff event
  const kickoffNarrative = await generateAiMinuteCommentary({
    minute: 0,
    type: 'KICKOFF',
    homeTeam: homeTeam.name,
    awayTeam: awayTeam.name,
    homeScore: 0,
    awayScore: 0,
    actorPlayer: `${homeTeam.players.mid.name} (${homeTeam.players.mid.playstyle})`,
    actorTeam: homeTeam.name,
    secondaryPlayer: homeTeam.players.atk.name,
    secondaryTeam: homeTeam.name,
    details: `${homeTeam.name} get the match underway, immediately establishing their ${homeTeam.tactics.passingStyle} passing tempo and ${homeTeam.tactics.teamMentality} mentality.`
  });

  await sendIncident({
    minute: 0,
    icon: '🏟️',
    eventTitle: 'KICKOFF',
    actor: homeTeam.players.mid,
    secondaryPlayer: homeTeam.players.atk,
    narrative: kickoffNarrative
  });
  await sleep(tickDelay);

  // Track dynamic comeback momentum & lead psychology
  let recentComebackTeamAlias: string | null = null;
  let comebackSurgeRemaining: number = 0;

  /**
   * Probabilistic duel helper: higher stats win more often, but upsets always remain possible!
   */
  const calcDuelWinProb = (statA: number, statB: number, baseChance: number = 50, scale: number = 1.4): number => {
    const diff = statA - statB;
    return Math.max(22, Math.min(78, Math.round(baseChance + diff * scale)));
  };

  // Generate 7-8 discrete phases for each half
  const half1Minutes = [3, 8, 14, 21, 28, 35, 41, 45];
  const half2Minutes = [49, 56, 62, 70, 77, 83, 88, 90];

  /**
   * Executes a rich, tactical simulation phase selecting from 30+ interaction events
   */
  const simulateTacticalPhase = async (min: number) => {
    // 1. Determine attacking team based on possession roll + mentality modifiers + MAN ADVANTAGE
    const homeRedCount = [homeTeam.players.atk, homeTeam.players.mid, homeTeam.players.def].filter(p => p.redCards > 0).length;
    const awayRedCount = [awayTeam.players.atk, awayTeam.players.mid, awayTeam.players.def].filter(p => p.redCards > 0).length;

    let homeAttackingWeight = homeTeam.possession;
    homeAttackingWeight -= homeRedCount * 14; // Ejected player penalty!
    homeAttackingWeight += awayRedCount * 14; // Man advantage boost!

    if (homeTeam.tactics.teamMentality === 'Hard Attacking') homeAttackingWeight += 5;
    else if (homeTeam.tactics.teamMentality === 'Attacking') homeAttackingWeight += 3;
    else if (homeTeam.tactics.teamMentality === 'Defensive') homeAttackingWeight -= 3;
    else if (homeTeam.tactics.teamMentality === 'Hard Defending') homeAttackingWeight -= 5;

    if (awayTeam.tactics.teamMentality === 'Hard Attacking') homeAttackingWeight -= 5;
    else if (awayTeam.tactics.teamMentality === 'Attacking') homeAttackingWeight -= 3;
    else if (awayTeam.tactics.teamMentality === 'Defensive') homeAttackingWeight += 3;
    else if (awayTeam.tactics.teamMentality === 'Hard Defending') homeAttackingWeight += 5;

    // Game-state psychology & anti-snowball lead management
    const currentGoalDiff = homeTeam.score - awayTeam.score; // Positive if home leads
    if (currentGoalDiff >= 2) {
      // Home leading by 2+ manages tempo, drops back
      homeAttackingWeight -= (currentGoalDiff >= 3 ? 15 : 8);
    } else if (currentGoalDiff <= -2) {
      // Away leading by 2+ manages tempo, drops back
      homeAttackingWeight += (currentGoalDiff <= -3 ? 15 : 8);
    }

    // Trailing team desperation in final 20 minutes (70'+)
    if (min >= 70) {
      if (currentGoalDiff < 0) {
        homeAttackingWeight += 14; // Home throws kitchen sink
      } else if (currentGoalDiff > 0) {
        homeAttackingWeight -= 14; // Away throws kitchen sink
      }
    }

    // "Bam Bam" Rapid Comeback Surge (Momentum adrenaline spike)
    if (comebackSurgeRemaining > 0 && recentComebackTeamAlias) {
      if (recentComebackTeamAlias === homeTeam.alias) {
        homeAttackingWeight += 20;
      } else if (recentComebackTeamAlias === awayTeam.alias) {
        homeAttackingWeight -= 20;
      }
      comebackSurgeRemaining--;
    }

    const isHomeAttacking = Math.random() * 100 < Math.max(20, Math.min(80, homeAttackingWeight));
    const attTeam = isHomeAttacking ? homeTeam : awayTeam;
    const defTeam = isHomeAttacking ? awayTeam : homeTeam;

    const activeAtt = getActivePlayers(attTeam);
    const activeDef = getActivePlayers(defTeam);

    // Pick active attacker (fallback to mid or def if striker is sent off)
    const striker = attTeam.players.atk.redCards === 0
      ? attTeam.players.atk
      : (activeAtt.find(p => p.position === 'MID') || activeAtt[0]);

    // Pick active attacking midfielder
    const midAtt = attTeam.players.mid.redCards === 0
      ? attTeam.players.mid
      : (activeAtt.find(p => p.position !== 'MID') || activeAtt[0]);

    // Pick active attacking defender
    const defAtt = attTeam.players.def.redCards === 0
      ? attTeam.players.def
      : (activeAtt.find(p => p.position !== 'DEF') || activeAtt[0]);

    // Defending team active players
    const defPlayer = defTeam.players.def.redCards === 0
      ? defTeam.players.def
      : (activeDef.find(p => p.position === 'MID') || activeDef[0]);

    const midDef = defTeam.players.mid.redCards === 0
      ? defTeam.players.mid
      : (activeDef.find(p => p.position !== 'MID') || activeDef[0]);

    const oppStriker = defTeam.players.atk.redCards === 0
      ? defTeam.players.atk
      : (activeDef.find(p => p.position !== 'ATK') || activeDef[0]);

    // Tactical parameters in play
    const attTactics = attTeam.tactics;
    const defTactics = defTeam.tactics;

    const actionRoll = Math.random() * 100;

    // ==========================================
    // SHARED SCORING RESOLUTION HELPER
    // ==========================================
    const resolveGoalAttempt = async (
      targetShooter: MatchPlayer,
      targetAssister?: MatchPlayer,
      isHeader: boolean = false,
      isCounterAttack: boolean = false,
      isLongShot: boolean = false
    ) => {
      targetShooter.shots++;

      // 1. Low-Block Shot Suppression (Heroic Sliding Block)
      if (!isCounterAttack && (defTactics.teamMentality.includes('Defend') || (defTeam.score > attTeam.score && min >= 70))) {
        const blockChance = defTactics.teamMentality === 'Hard Defending' ? 0.30 : 0.20;
        if (Math.random() < blockChance) {
          defPlayer.tackles++;
          await sendIncident({
            minute: min,
            icon: '🛡️',
            eventTitle: 'HEROIC SLIDING BLOCK',
            actor: defPlayer,
            secondaryPlayer: targetShooter,
            narrative: `WHAT A HEROIC BLOCK! ${defPlayer.name} throws his body on the line, producing an astonishing sliding block to divert ${targetShooter.name}'s goalbound shot away from danger!`
          });
          return;
        }
      }

      // 2. Calculate Shooting Power vs Defensive Resistance
      let shooterFinishing: number;
      if (isHeader) {
        shooterFinishing = (targetShooter.hea || 65) * 1.1 + targetShooter.phy * 0.9;
      } else if (isLongShot) {
        shooterFinishing = (targetShooter.pow || 66) * 1.0 + targetShooter.fin * 0.9 + targetShooter.cmp * 0.7;
      } else {
        shooterFinishing = targetShooter.fin * 1.0 + targetShooter.cmp * 0.9 + (targetShooter.playstyle === 'PCH' ? 8 : 0);
      }

      // If counter-attack, defense is stretched and caught upfield
      const defResistance = isCounterAttack
        ? ((defPlayer.tck + defPlayer.int) / 2) * 1.25
        : ((defPlayer.tck + defPlayer.int + defPlayer.phy) / 3) * 1.75;

      let goalProb = isCounterAttack
        ? Math.max(24, Math.min(48, Math.round(34 + (shooterFinishing - defResistance) * 0.22)))
        : Math.max(14, Math.min(38, Math.round(22 + (shooterFinishing - defResistance) * 0.20)));

      // Comeback adrenaline spike (trailing team fighting back)
      if (recentComebackTeamAlias === attTeam.alias) {
        goalProb += 6;
      }

      // Late-game clutch drama (80'+) for trailing or level team
      if (min >= 80 && attTeam.score <= defTeam.score) {
        goalProb += 4;
      }

      if (Math.random() * 100 < goalProb) {
        // ⚽ GOAL SCORED!
        attTeam.score++;
        targetShooter.goals++;
        if (targetAssister) targetAssister.assists++;

        // Trigger comeback surge if team was trailing
        if (attTeam.score <= defTeam.score) {
          recentComebackTeamAlias = attTeam.alias;
          comebackSurgeRemaining = 2; // Next 2 phases get intense comeback surge!
        }

        const scorerEntry = {
          minute: min,
          player: targetShooter.name,
          team: attTeam.name,
          assistBy: targetAssister ? targetAssister.name : undefined
        };
        scorers.push(scorerEntry);

        const chronoText = targetAssister
          ? `⚽ ${min}' Goal -- ${targetShooter.name} ${targetShooter.flag} (assist: ${targetAssister.name} ${targetAssister.flag})`
          : `⚽ ${min}' Goal -- ${targetShooter.name} ${targetShooter.flag} (solo effort)`;
        matchChronology.push(chronoText);

        const goalDetails = isHeader
          ? `${targetAssister ? targetAssister.name + ' delivers the cross and ' : ''}${targetShooter.name} rises in the air to power a bullet header into the net!`
          : isLongShot
          ? `${targetShooter.name} unleashes an absolute thunderbolt screamer from 25 yards that rockets straight into the top postage stamp!`
          : isCounterAttack
          ? `Devastating smash-and-grab counter-attack! ${targetAssister ? targetAssister.name + ' squares it and ' : ''}${targetShooter.name} finishes ruthlessly past the stranded keeper!`
          : targetAssister
          ? (targetShooter.position === 'DEF'
              ? `${targetAssister.name} slides it into the channel and defender ${targetShooter.name} steps onto it with a lethal finish!`
              : targetShooter.position === 'MID'
              ? `${targetAssister.name} lays it off and midfielder ${targetShooter.name} arrives late in the box with a thunderous strike!`
              : `${targetAssister.name} slides it across and ${targetShooter.name} executes with ice-cold finishing into the back of the net!`)
          : `${targetShooter.name} opens his body, beats his marker, and unleashes a glorious solo finish!`;

        const commentary = await generateAiMinuteCommentary({
          minute: min,
          type: 'GOAL',
          homeTeam: homeTeam.name,
          awayTeam: awayTeam.name,
          homeScore: homeTeam.score,
          awayScore: awayTeam.score,
          actorPlayer: `${targetShooter.name} (${targetShooter.playstyle})`,
          actorTeam: attTeam.name,
          secondaryPlayer: targetAssister ? targetAssister.name : defPlayer.name,
          secondaryTeam: targetAssister ? attTeam.name : defTeam.name,
          details: goalDetails
        });

        const goalTitle = targetAssister
          ? `GOAL — ${targetShooter.name} ${targetShooter.flag} (Assist: ${targetAssister.name} ${targetAssister.flag})`
          : `GOAL — ${targetShooter.name} ${targetShooter.flag}`;

        await sendIncident({
          minute: min,
          icon: isLongShot ? '🚀' : '⚽',
          eventTitle: goalTitle,
          actor: targetShooter,
          secondaryPlayer: targetAssister,
          extraMentions: [defPlayer],
          narrative: commentary
        });

        // 📺 VAR Goal Review (15% probability of checking offside/handball)
        if (Math.random() < 0.15) {
          await sleep(2000);
          await sendIncident({
            minute: min,
            icon: '📺',
            eventTitle: 'VAR REVIEW IN PROGRESS — Possible Offside',
            actor: targetShooter,
            secondaryPlayer: targetAssister || defPlayer,
            narrative: `HOLD ON! The referee holds his ear! The VAR room in Stockley Park is drawing lines to check if ${targetShooter.name} was offside in the buildup to the goal!`
          });
          await sleep(2600);

          if (Math.random() < 0.28) {
            // Disallowed!
            attTeam.score--;
            targetShooter.goals--;
            if (targetAssister) targetAssister.assists--;
            scorers.pop();
            matchChronology.push(`🚫 ${min}' Goal Disallowed by VAR (Offside) -- ${targetShooter.name} ${targetShooter.flag}`);

            await sendIncident({
              minute: min,
              icon: '🚫',
              eventTitle: 'VAR DECISION: GOAL DISALLOWED!',
              actor: targetShooter,
              secondaryPlayer: defPlayer,
              narrative: `GOAL DISALLOWED! The semi-automated technology confirms ${targetShooter.name}'s shoulder was mere inches offside when the ball was played! The goal is chalked off! Scoreline resets to ${homeTeam.name} ${homeTeam.score} : ${awayTeam.score} ${awayTeam.name}!`
            });
            return;
          } else {
            // Goal stands!
            await sendIncident({
              minute: min,
              icon: '✅',
              eventTitle: 'VAR DECISION: GOAL STANDS!',
              actor: targetShooter,
              secondaryPlayer: targetAssister || defPlayer,
              narrative: `GOAL CONFIRMED! Replays show the trailing defender's heel played ${targetShooter.name} onside! The goal officially stands! ${homeTeam.name} ${homeTeam.score} : ${awayTeam.score} ${awayTeam.name}`
            });
          }
        }
      } else {
        // Deflection to Corner or Diving Save (35% becomes corner, 65% goal kick / save)
        const isCorner = Math.random() < 0.35;
        if (isCorner) {
          // --- MULTI-PART CORNER SEQUENCE ---
          const cornerTaker = getSpecialist(attTeam, 'CORNER');
          // 1. Awarded
          await sendIncident({
            minute: min,
            icon: '🚩',
            eventTitle: `CORNER AWARDED — ${attTeam.name}`,
            actor: cornerTaker,
            secondaryPlayer: targetShooter,
            narrative: `Goalkeeper parries the stinging effort behind the post! Corner kick awarded to ${attTeam.name}.`
          });
          await sleep(2200);

          // 2. Taken
          await sendIncident({
            minute: min,
            icon: '🎯',
            eventTitle: 'CORNER TAKEN',
            actor: cornerTaker,
            narrative: `${cornerTaker.name} whips an outswinging delivery deep toward the penalty spot!`
          });
          await sleep(2200);

          // 3. Outcome
          const headerCandidates = activeAtt.filter(p => p.name !== cornerTaker.name);
          const headerFinisher = headerCandidates.length > 0
            ? headerCandidates[Math.floor(Math.random() * headerCandidates.length)]
            : cornerTaker;

          const attHeaderStat = (headerFinisher.hea || 68) * 1.1 + headerFinisher.phy;
          const defHeaderStat = (defPlayer.hea || 68) * 1.1 + defPlayer.phy;
          const headerDuelProb = calcDuelWinProb(attHeaderStat, defHeaderStat, 48);

          if (Math.random() * 100 < headerDuelProb && Math.random() < 0.28) {
            attTeam.score++;
            headerFinisher.goals++;
            headerFinisher.shots++;
            cornerTaker.assists++;
            scorers.push({ minute: min, player: headerFinisher.name, team: attTeam.name, assistBy: cornerTaker.name });
            matchChronology.push(`⚽ ${min}' Goal (Corner) -- ${headerFinisher.name} ${headerFinisher.flag} (assist: ${cornerTaker.name} ${cornerTaker.flag})`);

            await sendIncident({
              minute: min,
              icon: '⚽',
              eventTitle: `GOAL (Corner) — ${headerFinisher.name} ${headerFinisher.flag} (Assist: ${cornerTaker.name} ${cornerTaker.flag})`,
              actor: headerFinisher,
              secondaryPlayer: cornerTaker,
              narrative: `BULLET HEADER! ${headerFinisher.name} climbs above the defender and crashes ${cornerTaker.name}'s corner kick into the net! GOAL!`
            });
          } else {
            // Cleared corner! Check for half-volley screamer from edge of box (26% chance)!
            if (Math.random() < 0.26) {
              const volleyCandidate = activeAtt.find(p => p.name !== cornerTaker.name && p.name !== headerFinisher.name) || activeAtt[0];
              attTeam.score++;
              volleyCandidate.goals++;
              volleyCandidate.shots++;
              scorers.push({ minute: min, player: volleyCandidate.name, team: attTeam.name });
              matchChronology.push(`⚽ ${min}' Goal (Corner Half-Volley) -- ${volleyCandidate.name} ${volleyCandidate.flag}`);

              await sendIncident({
                minute: min,
                icon: '🚀',
                eventTitle: `GOAL (Half-Volley) — ${volleyCandidate.name} ${volleyCandidate.flag}`,
                actor: volleyCandidate,
                secondaryPlayer: cornerTaker,
                narrative: `UNSTOPPABLE HALF-VOLLEY SCREAMER! The cleared corner drops 22 yards out, and ${volleyCandidate.name} arrives at pace to strike an absolute rocket into the top corner through a crowd of bodies! WHAT A GOAL!`
              });
            } else {
              await sendIncident({
                minute: min,
                icon: '❌',
                eventTitle: 'CORNER MISSED',
                actor: defPlayer,
                secondaryPlayer: cornerTaker,
                narrative: `${defPlayer.name} rises highest to head the corner kick firmly away from the penalty box.`
              });
            }
          }
        } else {
          // Spectacular Save
          const commentary = await generateAiMinuteCommentary({
            minute: min,
            type: 'SAVE',
            homeTeam: homeTeam.name,
            awayTeam: awayTeam.name,
            homeScore: homeTeam.score,
            awayScore: awayTeam.score,
            actorPlayer: defPlayer.name,
            actorTeam: defTeam.name,
            secondaryPlayer: targetShooter.name,
            secondaryTeam: attTeam.name,
            details: `Acrobatic flying save by ${defPlayer.name} (${defTeam.name}) denies ${targetShooter.name}'s (${attTeam.name}) goalbound strike at full stretch!`
          });

          await sendIncident({
            minute: min,
            icon: '🧤',
            eventTitle: 'SPECTACULAR SAVE',
            actor: defPlayer,
            secondaryPlayer: targetShooter,
            narrative: commentary
          });
        }
      }
    };

    // ==========================================
    // 1. DEFENSIVE TRAP & COUNTER PRESSING INTERVENTIONS
    // ==========================================

    // Scenario A: OFFSIDE TRAP (Triggered if defending team has offside trap ON)
    if (defTactics.offsideTrap === 'On' && actionRoll < 18) {
      const defTrapRating = defPlayer.int * 1.3 + defPlayer.cmp;
      const attPaceRating = striker.pac * 1.1 + striker.vis;
      const trapSuccessProb = calcDuelWinProb(defTrapRating, attPaceRating, 54);

      if (Math.random() * 100 < trapSuccessProb) {
        // Trapped!
        const commentary = await generateAiMinuteCommentary({
          minute: min,
          type: 'OFFSIDE',
          homeTeam: homeTeam.name,
          awayTeam: awayTeam.name,
          homeScore: homeTeam.score,
          awayScore: awayTeam.score,
          actorPlayer: `${striker.name} (${striker.playstyle})`,
          actorTeam: attTeam.name,
          secondaryPlayer: defPlayer.name,
          secondaryTeam: defTeam.name,
          details: `${defTeam.name}'s disciplined backline steps up in unison on the release of the pass, catching ${striker.name} leaning offside.`
        });

        await sendIncident({
          minute: min,
          icon: '🚩',
          eventTitle: 'OFFSIDE',
          actor: striker,
          secondaryPlayer: defPlayer,
          narrative: commentary
        });
        return;
      } else {
        // OFFSIDE TRAP BREACHED! Striker beats the line
        const commentary = await generateAiMinuteCommentary({
          minute: min,
          type: 'DRIBBLE',
          homeTeam: homeTeam.name,
          awayTeam: awayTeam.name,
          homeScore: homeTeam.score,
          awayScore: awayTeam.score,
          actorPlayer: `${striker.name} (${striker.playstyle})`,
          actorTeam: attTeam.name,
          secondaryPlayer: defPlayer.name,
          secondaryTeam: defTeam.name,
          details: `${striker.name} breaks the offside trap with blistering timing, sprinting 1-on-1 past the high line!`
        });

        await sendIncident({
          minute: min,
          icon: '⚠️',
          eventTitle: 'OFFSIDE TRAP BREACHED',
          actor: striker,
          secondaryPlayer: defPlayer,
          narrative: commentary
        });
        await sleep(tickDelay);
        // Breaks into direct 1v1 scoring chance!
        await resolveGoalAttempt(striker, midAtt);
        return;
      }
    }

    // Scenario B: HIGH PRESS TURNOVER (Triggered if defending team has High Press)
    if (defTactics.pressingStyle === 'High' && actionRoll >= 18 && actionRoll < 32) {
      const pressPower = midDef.tck + midDef.wrk * 1.2;
      const attResistance = midAtt.cmp * 1.1 + midAtt.dri;
      const pressSuccessProb = calcDuelWinProb(pressPower, attResistance, 52);

      if (Math.random() * 100 < pressSuccessProb) {
        midDef.tackles++;
        const commentary = await generateAiMinuteCommentary({
          minute: min,
          type: 'TACKLE',
          homeTeam: homeTeam.name,
          awayTeam: awayTeam.name,
          homeScore: homeTeam.score,
          awayScore: awayTeam.score,
          actorPlayer: `${midDef.name} (${midDef.playstyle})`,
          actorTeam: defTeam.name,
          secondaryPlayer: midAtt.name,
          secondaryTeam: attTeam.name,
          details: `Suffocating high press by ${defTeam.name} hounds ${midAtt.name} into an error in their own defensive third, winning the ball cleanly.`
        });

        await sendIncident({
          minute: min,
          icon: '🔥',
          eventTitle: 'HIGH PRESS TURNOVER',
          actor: midDef,
          secondaryPlayer: midAtt,
          narrative: commentary
        });
        return;
      }
    }

    // Scenario C: TACKLING STYLES & FOULS (Hard vs Easy vs Normal)
    if (actionRoll >= 32 && actionRoll < 50) {
      const isHardTackling = defTactics.tacklingStyle === 'Hard';
      const isEasyTackling = defTactics.tacklingStyle === 'Easy';

      if (isEasyTackling) {
        // Disciplined Jockeying / Containment
        const commentary = await generateAiMinuteCommentary({
          minute: min,
          type: 'BUILDUP',
          homeTeam: homeTeam.name,
          awayTeam: awayTeam.name,
          homeScore: homeTeam.score,
          awayScore: awayTeam.score,
          actorPlayer: `${defPlayer.name} (${defPlayer.playstyle})`,
          actorTeam: defTeam.name,
          secondaryPlayer: striker.name,
          secondaryTeam: attTeam.name,
          details: `${defPlayer.name} stays on their feet with disciplined jockeying against ${striker.name}, shutting down the passing angle without committing a foul.`
        });

        await sendIncident({
          minute: min,
          icon: '🛡️',
          eventTitle: 'JOCKEYING & CONTAINMENT',
          actor: defPlayer,
          secondaryPlayer: striker,
          narrative: commentary
        });
        return;
      }

      // Check for foul with Hard Tackling (fatigued late lunges increase foul risk)
      const lateLungeFactor = (min >= 80 && defTeam.score <= attTeam.score + 1) ? 0.12 : 0;
      const foulChance = isHardTackling ? (0.42 + lateLungeFactor) : (0.16 + lateLungeFactor);
      if (Math.random() < foulChance) {
        midDef.fouls++;
        const isYellow = isHardTackling ? Math.random() < 0.5 : Math.random() < 0.2;

        if (isYellow) {
          midDef.yellowCards++;
          cards.push({ minute: min, player: midDef.name, type: 'YELLOW', team: defTeam.name });
          matchChronology.push(`🟨 ${min}' Yellow Card -- ${midDef.name} ${midDef.flag}`);

          // Second yellow check
          if (midDef.yellowCards >= 2) {
            midDef.redCards++;
            cards.push({ minute: min, player: midDef.name, type: 'RED', team: defTeam.name });
            matchChronology.push(`🟥 ${min}' Red Card -- ${midDef.name} ${midDef.flag}`);
          }
        }

        const isPenalty = Math.random() < 0.08; // 8% of fouls inside penalty box (realistic football rate)

        if (isPenalty) {
          // --- MULTI-PART PENALTY SEQUENCE ---
          const penTaker = getSpecialist(attTeam, 'PEN');
          // 1. Awarded
          await sendIncident({
            minute: min,
            icon: '🚩',
            eventTitle: `PENALTY AWARDED — ${attTeam.name}`,
            actor: penTaker,
            secondaryPlayer: midDef,
            narrative: `WHISTLE BLOWS! The referee points straight to the penalty spot! ${midDef.name} brings down the attacker inside the box with a desperate challenge!`
          });
          await sleep(2200);

          // 📺 VAR Penalty Review Check (18% probability of VAR review)
          if (Math.random() < 0.18) {
            await sendIncident({
              minute: min,
              icon: '📺',
              eventTitle: 'VAR REVIEW IN PROGRESS — Penalty Check',
              actor: penTaker,
              secondaryPlayer: midDef,
              narrative: `HOLD ON! The referee holds his ear! The VAR team is reviewing whether ${midDef.name} touched the ball first or if ${penTaker.name} initiated contact!`
            });
            await sleep(2600);

            // 35% chance VAR overturns the penalty
            if (Math.random() < 0.35) {
              matchChronology.push(`🚫 ${min}' Penalty Overturned by VAR`);
              penTaker.yellowCards++;
              cards.push({ minute: min, player: penTaker.name, type: 'YELLOW', team: attTeam.name });
              await sendIncident({
                minute: min,
                icon: '🚫',
                eventTitle: 'VAR DECISION: PENALTY OVERTURNED!',
                actor: penTaker,
                secondaryPlayer: midDef,
                narrative: `PENALTY OVERTURNED! Replays clearly show ${midDef.name} touched the ball cleanly! The referee signals simulation and books ${penTaker.name} with a yellow card! No penalty!`
              });
              return;
            } else {
              await sendIncident({
                minute: min,
                icon: '✅',
                eventTitle: 'VAR DECISION: PENALTY CONFIRMED!',
                actor: penTaker,
                secondaryPlayer: midDef,
                narrative: `DECISION CONFIRMED! Replays show clear knee-on-ankle contact with no ball touched! The spot-kick stands!`
              });
              await sleep(1800);
            }
          }

          // 2. Taken
          const isLatePen = min >= 80;
          await sendIncident({
            minute: min,
            icon: '🎯',
            eventTitle: isLatePen ? 'CLUTCH LATE PENALTY TAKEN' : 'PENALTY TAKEN',
            actor: penTaker,
            narrative: isLatePen
              ? `HEART IN MOUTH! ${penTaker.name} places the ball on the spot in the dying stages with everything on the line... the entire stadium falls deathly silent!`
              : `${penTaker.name} places the ball on the spot, takes four measured steps back, and stares down the goalkeeper... the whistle sounds!`
          });
          await sleep(2200);

          // 3. Outcome (High-stakes clutch conversion: 76-88% late, 70-84% normal)
          const penGoalChance = isLatePen
            ? Math.min(88, Math.max(76, Math.round(penTaker.cmp * 0.4 + penTaker.fin * 0.4 + 32)))
            : Math.min(84, Math.max(68, Math.round(penTaker.cmp * 0.4 + penTaker.fin * 0.4 + 26)));

          if (Math.random() * 100 < penGoalChance) {
            attTeam.score++;
            penTaker.goals++;
            penTaker.shots++;
            if (attTeam.score <= defTeam.score) {
              recentComebackTeamAlias = attTeam.alias;
              comebackSurgeRemaining = 2;
            }
            scorers.push({ minute: min, player: penTaker.name, team: attTeam.name });
            matchChronology.push(`⚽ ${min}' Goal (Penalty) -- ${penTaker.name} ${penTaker.flag}`);

            await sendIncident({
              minute: min,
              icon: '⚽',
              eventTitle: `GOAL (Penalty) — ${penTaker.name} ${penTaker.flag}`,
              actor: penTaker,
              narrative: `ICE IN THE VEINS! ${penTaker.name} sends the goalkeeper the wrong way with a cool, slotted finish into the bottom corner! GOAL for ${attTeam.name}!`
            });
          } else {
            await sendIncident({
              minute: min,
              icon: '🧤',
              eventTitle: 'PENALTY SAVED',
              actor: defPlayer,
              secondaryPlayer: penTaker,
              narrative: `INCREDIBLE REFLEXES! The goalkeeper guesses right and dives full length to push ${penTaker.name}'s spot-kick away from danger!`
            });
          }
          return;
        } else {
          // --- MULTI-PART FREE KICK SEQUENCE ---
          const fkTaker = getSpecialist(attTeam, 'FK');
          const isLateGameFk = min >= 80;

          // 1. Awarded
          await sendIncident({
            minute: min,
            icon: '🚩',
            eventTitle: isLateGameFk ? `LATE FREE KICK DRAMA — ${attTeam.name}` : `FREE KICK AWARDED — ${attTeam.name}`,
            actor: fkTaker,
            secondaryPlayer: midDef,
            narrative: isLateGameFk
              ? `LATE FREE KICK DRAMA! In the dying embers of the match, ${midDef.name} commits a foul in prime shooting territory outside the box! ${fkTaker.name} immediately claims the ball!`
              : `Free kick awarded in dangerous territory outside the 18-yard box! ${midDef.name}'s challenge is deemed illegal. ${fkTaker.name} immediately claims the ball.`
          });
          await sleep(2200);

          // 2. Taken
          await sendIncident({
            minute: min,
            icon: '🎯',
            eventTitle: 'FREE KICK TAKEN',
            actor: fkTaker,
            narrative: `${fkTaker.name} sizes up the wall. He strikes it with dip and swerve toward goal!`
          });
          await sleep(2200);

          // 3. Outcome (Late game dramatic conversion: 35-48%, normal: 14-25%)
          const fkGoalChance = isLateGameFk
            ? Math.min(48, Math.max(34, Math.round(38 + (fkTaker.fin - 50) * 0.25)))
            : Math.min(24, Math.max(12, Math.round(16 + (fkTaker.fin - 50) * 0.22)));

          if (Math.random() * 100 < fkGoalChance) {
            attTeam.score++;
            fkTaker.goals++;
            fkTaker.shots++;
            if (attTeam.score <= defTeam.score) {
              recentComebackTeamAlias = attTeam.alias;
              comebackSurgeRemaining = 2;
            }
            scorers.push({ minute: min, player: fkTaker.name, team: attTeam.name });
            matchChronology.push(`⚽ ${min}' Goal (Free Kick) -- ${fkTaker.name} ${fkTaker.flag}`);

            await sendIncident({
              minute: min,
              icon: '⚽',
              eventTitle: isLateGameFk ? `GOAL AT THE DEATH! — ${fkTaker.name} ${fkTaker.flag}` : `GOAL — ${fkTaker.name} ${fkTaker.flag}`,
              actor: fkTaker,
              narrative: isLateGameFk
                ? `WHAT AN UNBELIEVABLE STUNNER AT THE DEATH! ${fkTaker.name} whips the free kick over the wall and into the top stanchion! BEDLAM IN THE STADIUM!`
                : `WHAT A STUNNER! ${fkTaker.name} whips the free kick over the wall and into the top corner! Absolute perfection!`
            });
          } else {
            await sendIncident({
              minute: min,
              icon: '❌',
              eventTitle: 'FREE KICK MISSED',
              actor: fkTaker,
              secondaryPlayer: defPlayer,
              narrative: `${fkTaker.name}'s free kick gets over the wall, but it dips just inches over the crossbar! Goal kick for ${defTeam.name}.`
            });
          }
          return;
        }
      }

      // Tackler can be Midfielder (45%), Defender (35%), or Attacker pressing high (20%)!
      const tacklerRoll = Math.random() * 100;
      const activeTackler = tacklerRoll < 45 ? midDef : tacklerRoll < 80 ? defPlayer : oppStriker;
      const tackledPlayer = Math.random() < 0.6 ? striker : midAtt;

      // Clean Crunching Challenge
      activeTackler.tackles++;
      const commentary = await generateAiMinuteCommentary({
        minute: min,
        type: 'TACKLE',
        homeTeam: homeTeam.name,
        awayTeam: awayTeam.name,
        homeScore: homeTeam.score,
        awayScore: awayTeam.score,
        actorPlayer: `${activeTackler.name} (${activeTackler.playstyle})`,
        actorTeam: defTeam.name,
        secondaryPlayer: tackledPlayer.name,
        secondaryTeam: attTeam.name,
        details: `${isHardTackling ? 'Bone-crunching enforcer challenge' : 'Timed slide tackle'} by ${activeTackler.name} (${defTeam.name}) dispossesses ${tackledPlayer.name} (${attTeam.name}) cleanly on the pitch.`
      });

      await sendIncident({
        minute: min,
        icon: isHardTackling ? '💥' : '🛡️',
        eventTitle: isHardTackling ? 'CRUNCHING HARD TACKLE' : 'TACKLE WON',
        actor: activeTackler,
        secondaryPlayer: tackledPlayer,
        extraMentions: [tackledPlayer === striker ? midAtt : striker],
        narrative: commentary
      });

      // 📺 VAR Dangerous Challenge / Red Card Check (12% probability on hard tackling)
      if (isHardTackling && Math.random() < 0.12 && activeTackler.redCards === 0) {
        await sleep(2000);
        await sendIncident({
          minute: min,
          icon: '📺',
          eventTitle: 'VAR REVIEW — Serious Foul Play',
          actor: activeTackler,
          secondaryPlayer: tackledPlayer,
          narrative: `The referee stops play! VAR calls for an on-field review to check for serious foul play on ${activeTackler.name}'s studs-up challenge on ${tackledPlayer.name}!`
        });
        await sleep(2600);

        activeTackler.redCards++;
        cards.push({ minute: min, player: activeTackler.name, type: 'RED', team: defTeam.name });
        matchChronology.push(`🟥 ${min}' Red Card Upgraded by VAR -- ${activeTackler.name} ${activeTackler.flag}`);

        await sendIncident({
          minute: min,
          icon: '🟥',
          eventTitle: 'VAR DECISION: STRAIGHT RED CARD',
          actor: activeTackler,
          secondaryPlayer: tackledPlayer,
          narrative: `RED CARD! The referee returns from the pitchside monitor and brandishes a straight red card! Excessive force with studs caught above the ankle—${defTeam.name} are down to 10 men!`
        });
      }
      return;
    }

    // Scenario D: INTERCEPTIONS & SWEEPER CLEARANCE (BPD & Sweeper Playstyles)
    if (actionRoll >= 50 && actionRoll < 60) {
      if (defPlayer.playstyle === 'SWP') {
        const swpDuel = calcDuelWinProb(defPlayer.pac * 1.2 + defPlayer.int, striker.pac * 1.2, 54);
        if (Math.random() * 100 < swpDuel) {
          // Sweeper sliding recovery clearance
          defPlayer.interceptions++;
          const commentary = await generateAiMinuteCommentary({
            minute: min,
            type: 'BUILDUP',
            homeTeam: homeTeam.name,
            awayTeam: awayTeam.name,
            homeScore: homeTeam.score,
            awayScore: awayTeam.score,
            actorPlayer: `${defPlayer.name} (Sweeper)`,
            actorTeam: defTeam.name,
            secondaryPlayer: striker.name,
            secondaryTeam: attTeam.name,
            details: `Sweeper ${defPlayer.name} (${defTeam.name}) uses recovery pace to execute a sliding clearance just as the through ball was arriving for ${striker.name} (${attTeam.name}).`
          });

          await sendIncident({
            minute: min,
            icon: '🧹',
            eventTitle: 'SWEEPER RECOVERY CLEARANCE',
            actor: defPlayer,
            secondaryPlayer: striker,
            narrative: commentary
          });
          return;
        }
      } else {
        // Ball-Playing Defender or Anchor Interception
        const interceptor = defPlayer.playstyle === 'BPD' ? defPlayer : midDef;
        const intDuel = calcDuelWinProb(interceptor.int * 1.2 + interceptor.cmp, midAtt.pas * 1.1 + midAtt.vis, 52);
        if (Math.random() * 100 < intDuel) {
          interceptor.interceptions++;
          const commentary = await generateAiMinuteCommentary({
            minute: min,
            type: 'TACKLE',
            homeTeam: homeTeam.name,
            awayTeam: awayTeam.name,
            homeScore: homeTeam.score,
            awayScore: awayTeam.score,
            actorPlayer: `${interceptor.name} (${interceptor.playstyle})`,
            actorTeam: defTeam.name,
            secondaryPlayer: midAtt.name,
            secondaryTeam: attTeam.name,
            details: `Interception! ${interceptor.name} (${defTeam.name}) reads the passing lane early, cutting out the intended pass for ${midAtt.name} (${attTeam.name}) with effortless composure.`
          });

          await sendIncident({
            minute: min,
            icon: '🛡️',
            eventTitle: 'INTERCEPTION',
            actor: interceptor,
            secondaryPlayer: midAtt,
            narrative: commentary
          });
          return;
        }
      }
    }

    // ==========================================
    // 2. ATTACKING TACTICS & PLAYMAKING SCENARIOS
    // ==========================================

    // Scenario E: LIGHTNING COUNTER-ATTACK (Force Counter ON or Underdog Breakout)
    if ((attTactics.forceCounter === 'On' || (attTeam.score < defTeam.score && Math.random() < 0.35)) && Math.random() < 0.50) {
      const commentary = await generateAiMinuteCommentary({
        minute: min,
        type: 'BUILDUP',
        homeTeam: homeTeam.name,
        awayTeam: awayTeam.name,
        homeScore: homeTeam.score,
        awayScore: awayTeam.score,
        actorPlayer: `${striker.name} (${striker.playstyle})`,
        actorTeam: attTeam.name,
        secondaryPlayer: midAtt.name,
        secondaryTeam: attTeam.name,
        details: `Lightning 3-touch counter-attack transition by ${attTeam.name} springs past ${defTeam.name}'s overcommitted midfield line!`
      });

      await sendIncident({
        minute: min,
        icon: '⚡',
        eventTitle: 'LIGHTNING COUNTER-ATTACK',
        actor: striker,
        secondaryPlayer: midAtt,
        narrative: commentary
      });
      await sleep(tickDelay);

      // 65% chance breaks cleanly through on goal to shoot with counter-attack bonus!
      if (Math.random() < 0.65) {
        await resolveGoalAttempt(striker, midAtt, false, true);
      } else {
        await sendIncident({
          minute: min,
          icon: '🛡️',
          eventTitle: 'RECOVERY CHALLENGE',
          actor: defPlayer,
          secondaryPlayer: striker,
          narrative: `${defPlayer.name} scrambles back with desperate recovery pace to shoulder ${striker.name} off balance, diffusing the counter-attack!`
        });
      }
      return;
    }

    // Scenario H: OVERLAPPING DEFENDER RUN & MIDFIELD VISION (Total Football Plays)
    if (actionRoll >= 60 && actionRoll < 72) {
      const visionScore = midAtt.vis * 1.2 + midAtt.pas;
      const interceptScore = defPlayer.int * 1.2 + defPlayer.tck;
      const passSuccessProb = calcDuelWinProb(visionScore, interceptScore, 58);

      if (Math.random() * 100 < passSuccessProb) {
        defAtt.dribblesWon++;
        midAtt.passesCompleted += 2;
        const isLongScreamer = Math.random() < 0.50;

        const commentary = await generateAiMinuteCommentary({
          minute: min,
          type: 'BUILDUP',
          homeTeam: homeTeam.name,
          awayTeam: awayTeam.name,
          homeScore: homeTeam.score,
          awayScore: awayTeam.score,
          actorPlayer: `${defAtt.name} (${defAtt.playstyle})`,
          actorTeam: attTeam.name,
          secondaryPlayer: midAtt.name,
          secondaryTeam: attTeam.name,
          details: `Total football! Defender ${defAtt.name} makes a galloping overlapping run into the attacking third, spotted by ${midAtt.name}'s laser-precise vision with an exquisite threaded pass!`
        });

        await sendIncident({
          minute: min,
          icon: '🏃💨',
          eventTitle: 'OVERLAPPING DEFENDER RUN',
          actor: defAtt,
          secondaryPlayer: midAtt,
          narrative: commentary
        });
        await sleep(tickDelay);

        if (isLongScreamer) {
          // 25-yard thunderbolt screamer attempt!
          await resolveGoalAttempt(defAtt, midAtt, false, false, true);
        } else {
          // Cut-back inside the box
          await resolveGoalAttempt(defAtt, midAtt, false, false, false);
        }
        return;
      } else {
        defPlayer.interceptions++;
        await sendIncident({
          minute: min,
          icon: '🛡️',
          eventTitle: 'INTERCEPTED OVERLAP',
          actor: defPlayer,
          secondaryPlayer: defAtt,
          narrative: `${defPlayer.name} snuffs out the danger, stepping across to cut out the through-ball intended for ${defAtt.name}'s overlapping charge.`
        });
        return;
      }
    }

    // Scenario F: FOCUS PASSING STYLES (Through The Middle vs Flanks vs Long Ball)
    if (actionRoll >= 72 && actionRoll < 85) {
      if (attTactics.focusPassing === 'Through The Middle') {
        // Central Penetration / Key Pass
        midAtt.passesCompleted += 3;
        midAtt.passesAttempted = (midAtt.passesAttempted || 0) + 3;
        const commentary = await generateAiMinuteCommentary({
          minute: min,
          type: 'BUILDUP',
          homeTeam: homeTeam.name,
          awayTeam: awayTeam.name,
          homeScore: homeTeam.score,
          awayScore: awayTeam.score,
          actorPlayer: `${midAtt.name} (${midAtt.playstyle})`,
          actorTeam: attTeam.name,
          secondaryPlayer: striker.name,
          secondaryTeam: attTeam.name,
          details: `${midAtt.name} slices through ${defTeam.name}'s middle with a surgical vertical pass past the defensive line into the pocket for ${striker.name}.`
        });

        await sendIncident({
          minute: min,
          icon: '🪄',
          eventTitle: 'SLICED THROUGH THE MIDDLE',
          actor: midAtt,
          secondaryPlayer: striker,
          narrative: commentary
        });
        await sleep(tickDelay);

        // 60% chance to unleash 1v1 strike
        if (Math.random() < 0.60) {
          await resolveGoalAttempt(striker, midAtt);
        } else {
          await sendIncident({
            minute: min,
            icon: '🛡️',
            eventTitle: 'DEFENSIVE BLOCK',
            actor: defPlayer,
            secondaryPlayer: striker,
            narrative: `${defPlayer.name} slides in at full stretch to block ${striker.name}'s shot on the turn!`
          });
        }
        return;
      } else if (attTactics.focusPassing.includes('Flank')) {
        // Flank Overload & Cross
        midAtt.passesCompleted += 2;
        const crosser = striker.pac > midAtt.pac ? striker : midAtt;
        const targetAtt = activeAtt.find(p => p.id !== crosser.id) || striker;

        const commentary = await generateAiMinuteCommentary({
          minute: min,
          type: 'BUILDUP',
          homeTeam: homeTeam.name,
          awayTeam: awayTeam.name,
          homeScore: homeTeam.score,
          awayScore: awayTeam.score,
          actorPlayer: `${crosser.name} (${crosser.playstyle})`,
          actorTeam: attTeam.name,
          secondaryPlayer: targetAtt.name,
          secondaryTeam: attTeam.name,
          details: `${crosser.name} beats defender ${defPlayer.name} on the flank and whips an inswinging cross into the box for ${targetAtt.name}!`
        });

        await sendIncident({
          minute: min,
          icon: '👟',
          eventTitle: 'FLANK CROSS & OVERLOAD',
          actor: crosser,
          secondaryPlayer: targetAtt,
          extraMentions: [defPlayer],
          narrative: commentary
        });
        await sleep(tickDelay);

        // 60% chance attacker connects with cross (header/volley attempt)
        if (Math.random() < 0.60) {
          await resolveGoalAttempt(targetAtt, crosser, true);
        } else {
          defPlayer.interceptions++;
          await sendIncident({
            minute: min,
            icon: '🛡️',
            eventTitle: 'AERIAL CLEARANCE',
            actor: defPlayer,
            secondaryPlayer: crosser,
            narrative: `${defPlayer.name} climbs highest in the 6-yard box to nod ${crosser.name}'s cross firmly out of danger!`
          });
        }
        return;
      } else if (attTactics.passingStyle === 'Short') {
        // Tiki-Taka Combination
        midAtt.passesCompleted += 4;
        const partnerAtt = activeAtt.find(p => p.id !== midAtt.id) || defAtt;
        const commentary = await generateAiMinuteCommentary({
          minute: min,
          type: 'BUILDUP',
          homeTeam: homeTeam.name,
          awayTeam: awayTeam.name,
          homeScore: homeTeam.score,
          awayScore: awayTeam.score,
          actorPlayer: `${midAtt.name} (${midAtt.playstyle})`,
          actorTeam: attTeam.name,
          secondaryPlayer: partnerAtt.name,
          secondaryTeam: attTeam.name,
          details: `Hypnotic tiki-taka 1-2 combination by ${attTeam.name} circulates possession effortlessly through midfield.`
        });

        await sendIncident({
          minute: min,
          icon: '✨',
          eventTitle: 'TIKI-TAKA COMBINATION',
          actor: midAtt,
          secondaryPlayer: partnerAtt,
          narrative: commentary
        });
        return;
      } else if (striker.playstyle === 'TGT') {
        // Target Man Aerial Hold-Up
        const commentary = await generateAiMinuteCommentary({
          minute: min,
          type: 'BUILDUP',
          homeTeam: homeTeam.name,
          awayTeam: awayTeam.name,
          homeScore: homeTeam.score,
          awayScore: awayTeam.score,
          actorPlayer: `${striker.name} (Target Man)`,
          actorTeam: attTeam.name,
          secondaryPlayer: defPlayer.name,
          secondaryTeam: defTeam.name,
          details: `Target Man ${striker.name} bullies defender ${defPlayer.name} in the air, bringing down a direct aerial ball on his chest and laying off.`
        });

        await sendIncident({
          minute: min,
          icon: '🦘',
          eventTitle: 'AERIAL HOLD-UP & FLICK-ON',
          actor: striker,
          secondaryPlayer: defPlayer,
          narrative: commentary
        });
        await sleep(tickDelay);

        if (Math.random() < 0.55 && midAtt.redCards === 0) {
          await resolveGoalAttempt(midAtt, striker);
        }
        return;
      }
    }

    // Scenario G: MOMENTUM SHIFTS & RALLYING CRY
    if (actionRoll >= 85 && actionRoll < 90) {
      if (attTeam.score < defTeam.score && Math.random() < 0.5) {
        // Rallying Cry from leader
        const leader = attTeam.players.mid;
        await sendIncident({
          minute: min,
          icon: '📣',
          eventTitle: 'RALLYING CRY',
          actor: leader,
          secondaryPlayer: striker,
          narrative: `${leader.name} rallies his squad with arms outstretched! "Lift it up! Focus on the next ball!" The tempo spikes with renewed energy!`
        });
      } else {
        // Momentum Shift
        await sendIncident({
          minute: min,
          icon: '🔄',
          eventTitle: 'MOMENTUM SHIFT',
          actor: striker,
          secondaryPlayer: midAtt,
          narrative: `${attTeam.name} are turning the screw! Sustained territorial pressure forces ${defTeam.name} into their own penalty box!`
        });
      }
      return;
    }

    // ==========================================
    // 3. SCORING CHANCES & GOAL ATTEMPTS (90+)
    // ==========================================
    // Dynamic shooter selection: Strikers lead the line, but Midfielders arrive from deep and Defenders push forward!
    const shooterRoll = Math.random() * 100;
    let shooter: MatchPlayer;
    let assister: MatchPlayer | undefined;

    if (shooterRoll < 55 && striker.redCards === 0) {
      shooter = striker;
      const possibleAssisters = activeAtt.filter(p => p.id !== shooter.id);
      if (possibleAssisters.length > 0 && Math.random() < 0.85) {
        assister = possibleAssisters[Math.floor(Math.random() * possibleAssisters.length)];
      } else {
        assister = undefined;
      }
    } else if (shooterRoll < 85 && midAtt.redCards === 0) {
      shooter = midAtt;
      const possibleAssisters = activeAtt.filter(p => p.id !== shooter.id);
      if (possibleAssisters.length > 0 && Math.random() < 0.85) {
        assister = possibleAssisters[Math.floor(Math.random() * possibleAssisters.length)];
      } else {
        assister = undefined;
      }
    } else {
      shooter = defAtt.redCards === 0 ? defAtt : activeAtt[0];
      const possibleAssisters = activeAtt.filter(p => p.id !== shooter.id);
      if (possibleAssisters.length > 0 && Math.random() < 0.85) {
        assister = possibleAssisters[Math.floor(Math.random() * possibleAssisters.length)];
      } else {
        assister = undefined;
      }
    }

    await resolveGoalAttempt(shooter, assister);
  };

  // ==========================================
  // FIRST HALF
  // ==========================================
  for (const minute of half1Minutes) {
    await simulateTacticalPhase(minute);
    await sleep(tickDelay);
  }

  // ==========================================
  // HALF TIME INTERMISSION (45')
  // ==========================================
  matchChronology.push(`⏸️ 45' Halftime`);

  const halfTimeEmbed = new EmbedBuilder()
    .setColor('#1e293b')
    .setAuthor({ name: "HT' 🕒" })
    .setTitle('⏸️ HALF TIME')
    .setDescription(
      `### ${homeTeam.name} ${homeTeam.score} : ${awayTeam.score} ${awayTeam.name}\n\n` +
      `The referee blows the whistle for half time! Both squads head to the dressing rooms after a grueling 45 minutes of tactical warfare.\n\n` +
      `${formatMention(homeTeam.players.atk)} ${formatMention(awayTeam.players.atk)}`
    );

  if (client.user?.displayAvatarURL()) {
    halfTimeEmbed.setThumbnail(client.user.displayAvatarURL());
  }

  await channel.send({ embeds: [halfTimeEmbed] });

  await channel.send({
    content:
      `@${homeTeam.name} @${awayTeam.name}\n` +
      `⏸️ **Half time. Tactics, substitutions, lineup position shuffling, and set pieces are available for 3 minutes.**`
  });

  logger.info(`⏸️ Half time reached (${homeTeam.score}-${awayTeam.score}). Pausing for ${halfTimePause / 1000}s...`);
  await sleep(halfTimePause);

  await channel.send({
    content:
      `@${homeTeam.name} @${awayTeam.name}\n` +
      `▶️ **Second half is underway!**`
  });
  await sleep(2500);

  // ==========================================
  // SECOND HALF
  // ==========================================
  for (const minute of half2Minutes) {
    await simulateTacticalPhase(minute);
    await sleep(tickDelay);
  }

  // Stoppage Time Drama (90+3') if match is on a knife edge (within 1 goal)
  if (Math.abs(homeTeam.score - awayTeam.score) <= 1 && Math.random() < 0.70) {
    await channel.send({
      content: `⏱️ **+3' Stoppage time signaled by the fourth official! Knife-edge drama to the death!**`
    });
    await sleep(2000);
    await simulateTacticalPhase(93);
    await sleep(tickDelay);
  }

  matchChronology.push(`🏁 90+5' Fulltime`);

  // ==========================================
  // FINAL SCOREBOARD & RATINGS
  // ==========================================
  const homeWon = homeTeam.score > awayTeam.score;
  const awayWon = awayTeam.score > homeTeam.score;
  const homeCleanSheet = awayTeam.score === 0;
  const awayCleanSheet = homeTeam.score === 0;

  homeTeam.players.atk.rating = calculatePlayerRating(homeTeam.players.atk, homeWon, awayCleanSheet);
  homeTeam.players.mid.rating = calculatePlayerRating(homeTeam.players.mid, homeWon, awayCleanSheet);
  homeTeam.players.def.rating = calculatePlayerRating(homeTeam.players.def, homeWon, homeCleanSheet);

  awayTeam.players.atk.rating = calculatePlayerRating(awayTeam.players.atk, awayWon, homeCleanSheet);
  awayTeam.players.mid.rating = calculatePlayerRating(awayTeam.players.mid, awayWon, homeCleanSheet);
  awayTeam.players.def.rating = calculatePlayerRating(awayTeam.players.def, awayWon, awayCleanSheet);

  const allPlayers = [
    homeTeam.players.atk, homeTeam.players.mid, homeTeam.players.def,
    awayTeam.players.atk, awayTeam.players.mid, awayTeam.players.def
  ];
  allPlayers.sort((a, b) => b.rating - a.rating);
  const motm = allPlayers[0];
  const motmTeam = (motm.flag === homeTeam.flag) ? homeTeam : awayTeam;

  await channel.send({
    content:
      `@${homeTeam.name.toLowerCase()} @${awayTeam.name.toLowerCase()}\n` +
      `🏁 **Full time: ${homeTeam.name} ${homeTeam.score} - ${awayTeam.score} ${awayTeam.name}**`
  });

  const scoreboardEmbed = new EmbedBuilder()
    .setColor('#1e293b')
    .setTitle(`${homeTeam.name} ${homeTeam.score} : ${awayTeam.score} ${awayTeam.name}`)
    .setDescription(
      `**Full Time**\n\n` +
      `**MOTM 👑**\n` +
      `${motm.name} ${motm.flag}\n\n` +
      `**Possession**\n` +
      `${homeTeam.name} ${homeTeam.possession}% : ${awayTeam.possession}% ${awayTeam.name}\n\n` +
      `**${homeTeam.name} Ratings**\n` +
      `${homeTeam.players.atk.name} ${homeTeam.players.atk.flag} (ATK) ▶️ ${homeTeam.players.atk.rating.toFixed(1)}\n` +
      `${homeTeam.players.mid.name} ${homeTeam.players.mid.flag} (MID) ▶️ ${homeTeam.players.mid.rating.toFixed(1)}\n` +
      `${homeTeam.players.def.name} ${homeTeam.players.def.flag} (DEF) ▶️ ${homeTeam.players.def.rating.toFixed(1)}\n\n` +
      `**${awayTeam.name} Ratings**\n` +
      `${awayTeam.players.atk.name} ${awayTeam.players.atk.flag} (ATK) ▶️ ${awayTeam.players.atk.rating.toFixed(1)}\n` +
      `${awayTeam.players.mid.name} ${awayTeam.players.mid.flag} (MID) ▶️ ${awayTeam.players.mid.rating.toFixed(1)}\n` +
      `${awayTeam.players.def.name} ${awayTeam.players.def.flag} (DEF) ▶️ ${awayTeam.players.def.rating.toFixed(1)}\n\n` +
      `**Match Events**\n` +
      `${matchChronology.join('\n')}`
    );

  if (client.user?.displayAvatarURL()) {
    scoreboardEmbed.setThumbnail(client.user.displayAvatarURL());
  }

  // Generate authentic broadcast-grade match scorecard graphic
  const scorecardBuf = await generateMatchScorecardGraphic({
    homeTeam: homeTeam.name,
    awayTeam: awayTeam.name,
    homeScore: homeTeam.score,
    awayScore: awayTeam.score,
    homePossession: homeTeam.possession,
    awayPossession: awayTeam.possession,
    motmName: motm.name,
    motmRating: motm.rating,
    homeFlag: homeTeam.flag,
    awayFlag: awayTeam.flag,
    homeColor: homeTeam.color,
    awayColor: awayTeam.color
  });

  const scorecardAttachment = new AttachmentBuilder(scorecardBuf, { name: 'match_scorecard.png' });
  scoreboardEmbed.setImage('attachment://match_scorecard.png');

  // Generate authentic possession pie chart based on real possession
  const pieChartBuf = generatePossessionPieChart(
    homeTeam.name,
    homeTeam.possession,
    homeTeam.color,
    awayTeam.name,
    awayTeam.possession,
    awayTeam.color
  );

  const chartAttachment = new AttachmentBuilder(pieChartBuf, { name: 'possession_chart.png' });

  const chartEmbed = new EmbedBuilder()
    .setColor('#1e293b')
    .setImage('attachment://possession_chart.png')
    .setFooter({ text: 'Beyond The Final Whistle • Match Analytics Bureau' })
    .setTimestamp();

  await channel.send({
    embeds: [scoreboardEmbed, chartEmbed],
    files: [scorecardAttachment, chartAttachment]
  });

  logger.info(`✅ Match completed: ${homeTeam.name} ${homeTeam.score} - ${awayTeam.score} ${awayTeam.name}`);
  await sleep(2500);

  // ==========================================
  // DISPATCH AI GAZETTE TO #NEWS (WITH DYNAMIC SCORECARD GRAPHIC)
  // ==========================================
  try {
    const newsChannel = (client.channels.cache.get(newsChannelId) ||
      client.channels.cache.find(c => (c as any).name?.includes('news'))) as TextChannel;

    if (newsChannel && newsChannel.isTextBased()) {
      const newsArticle = await generateAiNewsArticle({
        homeTeam: homeTeam.name,
        awayTeam: awayTeam.name,
        homeScore: homeTeam.score,
        awayScore: awayTeam.score,
        homePossession: homeTeam.possession,
        awayPossession: awayTeam.possession,
        scorers,
        cards,
        motm: {
          player: motm.name,
          team: motmTeam.name,
          rating: motm.rating,
          stats: `${motm.goals} Goal(s), ${motm.assists} Assist(s), ${motm.tackles} Tackle(s)`
        }
      });

      const newsAttachment = new AttachmentBuilder(scorecardBuf, { name: 'match_scorecard.png' });

      const newspaperEmbed = new EmbedBuilder()
        .setColor('#f59e0b')
        .setTitle('📰 THE DAILY WHISTLE — MATCHDAY GAZETTE & REPORT')
        .setDescription(
          `>>> ${newsArticle}\n\n` +
          `───────────────────────────\n` +
          `- # 📡 Published by the AI Sports Journalism Bureau • Beyond The Final Whistle`
        )
        .setImage('attachment://match_scorecard.png')
        .setFooter({ text: 'AI Sports Journalism Engine • Beyond The Final Whistle' })
        .setTimestamp();

      await newsChannel.send({
        content: '📢 **@News Ping**',
        embeds: [newspaperEmbed],
        files: [newsAttachment]
      });
      logger.info(`✅ Match gazette dispatched with dynamic scorecard graphic to #${newsChannel.name}`);
    }
  } catch (err: any) {
    logger.error({ err }, 'Failed to dispatch AI news article');
  }

  return {
    homeScore: homeTeam.score,
    awayScore: awayTeam.score,
    homePossession: homeTeam.possession,
    awayPossession: awayTeam.possession,
    motmPlayerName: motm.name,
    motmRating: motm.rating
  };
}
