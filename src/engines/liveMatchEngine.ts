import { TextChannel, EmbedBuilder, AttachmentBuilder, Client } from 'discord.js';
import path from 'path';
import fs from 'fs';
import { generatePossessionPieChart } from '../utils/chartHelper.js';
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
  tickDelayMs?: number;        // Delay between incident messages (default 3500ms)
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
  base += player.tackles * 0.3;
  base += player.interceptions * 0.3;
  base += player.dribblesWon * 0.25;
  base += (player.passesCompleted / 10) * 0.15;
  base -= player.fouls * 0.2;
  base -= player.yellowCards * 0.6;
  base -= player.redCards * 2.0;

  if (teamWon) base += 0.4;
  if (cleanSheet && player.position === 'DEF') base += 0.8;
  if (cleanSheet && player.position === 'MID') base += 0.3;

  base += (Math.random() * 0.4 - 0.2);
  return +Math.max(4.0, Math.min(10.0, base)).toFixed(1);
}

/**
 * Executes a full AI-driven, dynamically rolled football match simulation
 */
export async function runLiveEpisodicMatch(
  client: Client,
  channel: TextChannel,
  homeTeam: MatchTeam,
  awayTeam: MatchTeam,
  options: LiveMatchOptions = {}
) {
  const tickDelay = options.tickDelayMs ?? 3500;
  const halfTimePause = options.halfTimePauseMs ?? 8000;
  const newsChannelId = options.newsChannelId ?? '1574439119227064402'; // #๑•📰│btfw-news

  logger.info(`⚽ Launching dynamic AI match engine: ${homeTeam.name} vs ${awayTeam.name} in #${channel.name}`);

  // 1. Calculate dynamic baseline possession from midfield battle + tactics
  const homeMidScore = (homeTeam.players.mid.pas * 2 + homeTeam.players.mid.vis + homeTeam.players.mid.cmp + homeTeam.players.mid.wrk) / 5;
  const awayMidScore = (awayTeam.players.mid.pas * 2 + awayTeam.players.mid.vis + awayTeam.players.mid.cmp + awayTeam.players.mid.wrk) / 5;
  let homePossBonus = (homeMidScore - awayMidScore) * 0.6;

  // Tactical possession adjustments
  if (homeTeam.tactics.passingStyle === 'Short') homePossBonus += 6;
  if (homeTeam.tactics.passingStyle === 'Long') homePossBonus -= 5;
  if (homeTeam.tactics.pressingStyle === 'High') homePossBonus += 4;
  if (awayTeam.tactics.passingStyle === 'Long') homePossBonus += 4;
  if (homeTeam.tactics.teamMentality === 'Attacking' || homeTeam.tactics.teamMentality === 'Hard Attacking') homePossBonus += 4;

  const calculatedHomePoss = Math.max(30, Math.min(75, Math.round(50 + homePossBonus + (Math.random() * 6 - 3))));
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
    const mentions = [formatMention(data.actor)];
    if (data.secondaryPlayer) mentions.push(formatMention(data.secondaryPlayer));
    if (data.extraMentions) {
      for (const p of data.extraMentions) {
        if (!mentions.includes(formatMention(p))) mentions.push(formatMention(p));
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

  // Build match schedule: discrete phases across 90 minutes
  // Half 1: 5-7 events between 1' and 45'
  // Half 2: 5-7 events between 46' and 90'
  const half1Minutes = [
    Math.floor(Math.random() * 4) + 1,    // 1-4'
    Math.floor(Math.random() * 6) + 7,    // 7-12'
    Math.floor(Math.random() * 6) + 16,   // 16-21'
    Math.floor(Math.random() * 6) + 26,   // 26-31'
    Math.floor(Math.random() * 6) + 34,   // 34-39'
    Math.floor(Math.random() * 3) + 43    // 43-45'
  ];

  const half2Minutes = [
    Math.floor(Math.random() * 4) + 48,   // 48-51'
    Math.floor(Math.random() * 6) + 54,   // 54-59'
    Math.floor(Math.random() * 6) + 64,   // 64-69'
    Math.floor(Math.random() * 6) + 73,   // 73-78'
    Math.floor(Math.random() * 6) + 82,   // 82-87'
    Math.floor(Math.random() * 3) + 89    // 89-90'
  ];

  // Helper to pick set piece specialist
  const getSpecialist = (team: MatchTeam, type: 'FK' | 'CORNER' | 'PEN'): MatchPlayer => {
    const name = type === 'FK' ? team.freeKickTakerName : type === 'CORNER' ? team.cornerTakerName : team.penaltyTakerName;
    if (team.players.atk.name.toLowerCase() === name.toLowerCase()) return team.players.atk;
    if (team.players.mid.name.toLowerCase() === name.toLowerCase()) return team.players.mid;
    return team.players.def;
  };

  /**
   * Simulates a single tactical incident dynamically based on real attributes
   */
  const simulatePhase = async (min: number) => {
    // Determine attacking team based on possession roll
    const isHomeAttacking = Math.random() * 100 < homeTeam.possession;
    const attTeam = isHomeAttacking ? homeTeam : awayTeam;
    const defTeam = isHomeAttacking ? awayTeam : homeTeam;

    const striker = attTeam.players.atk;
    const midAtt = attTeam.players.mid;
    const defAtt = attTeam.players.def;

    const defPlayer = defTeam.players.def;
    const midDef = defTeam.players.mid;
    const oppStriker = defTeam.players.atk;

    const roll = Math.random() * 100;

    // SCENARIO 1: Offside Trap Check (If defending team has Offside Trap ON)
    if (defTeam.tactics.offsideTrap === 'On' && roll < 24) {
      const defTrapRating = defPlayer.int * 1.3 + defPlayer.cmp;
      const attBeatTrapRating = striker.pac * 1.2 + striker.vis;

      if (defTrapRating >= attBeatTrapRating || Math.random() < 0.65) {
        // Offside trap successfully springs!
        const commentary = await generateAiMinuteCommentary({
          minute: min,
          type: 'OFFSIDE',
          homeTeam: homeTeam.name,
          awayTeam: awayTeam.name,
          homeScore: homeTeam.score,
          awayScore: awayTeam.score,
          actorPlayer: `${striker.name} (${striker.playstyle})`,
          secondaryPlayer: defPlayer.name,
          details: `${defTeam.name}'s disciplined offside trap snaps in unison, leaving ${striker.name} caught leaning offside before the pass is struck.`
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
      }
      // If trap beaten, continue to scoring chance!
    }

    // SCENARIO 2: Hard Tackling / High Press / Foul roll
    if (roll < 45) {
      const isHighPress = defTeam.tactics.pressingStyle === 'High';
      const isHardTackling = defTeam.tactics.tacklingStyle === 'Hard';

      const defPower = midDef.tck * 1.3 + midDef.phy + (isHardTackling ? 15 : 0) + (isHighPress ? 10 : 0);
      const attResist = midAtt.dri + midAtt.cmp * 1.2;

      // Check for foul
      const foulChance = isHardTackling ? 0.38 : 0.12;
      if (Math.random() < foulChance) {
        // FOUL COMMITTED!
        midDef.fouls++;
        const isYellow = isHardTackling ? Math.random() < 0.45 : Math.random() < 0.15;
        if (isYellow) {
          midDef.yellowCards++;
          cards.push({ minute: min, player: midDef.name, type: 'YELLOW', team: defTeam.name });
          matchChronology.push(`🟨 ${min}' Yellow Card -- ${midDef.name} ${midDef.flag}`);
        }

        const isPenalty = Math.random() < 0.18; // 18% of fouls inside penalty box

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
            narrative: `WHISTLE BLOWS! The referee points straight to the penalty spot! ${midDef.name} brings down the attacker inside the box with a desperate slide!`
          });
          await sleep(2200);

          // 2. Taken
          await sendIncident({
            minute: min,
            icon: '🎯',
            eventTitle: 'PENALTY TAKEN',
            actor: penTaker,
            narrative: `${penTaker.name} places the ball on the spot, takes four measured steps back, and stares down the goalkeeper... the whistle sounds!`
          });
          await sleep(2200);

          // 3. Outcome
          const penGoalChance = Math.min(88, Math.max(50, penTaker.cmp * 0.6 + penTaker.fin * 0.4));
          if (Math.random() * 100 < penGoalChance) {
            attTeam.score++;
            penTaker.goals++;
            penTaker.shots++;
            scorers.push({ minute: min, player: penTaker.name, team: attTeam.name });
            matchChronology.push(`⚽ ${min}' Goal (Penalty) -- ${penTaker.name} ${penTaker.flag}`);

            await sendIncident({
              minute: min,
              icon: '⚽',
              eventTitle: `GOAL (Penalty) — ${penTaker.name} ${penTaker.flag}`,
              actor: penTaker,
              narrative: `ICE IN THE VEINS! ${penTaker.name} sends the goalkeeper the wrong way with a cool, slotted finish right into the corner! GOAL for ${attTeam.name}!`
            });
          } else {
            await sendIncident({
              minute: min,
              icon: '🧤',
              eventTitle: 'PENALTY SAVED',
              actor: defPlayer,
              secondaryPlayer: penTaker,
              narrative: `INCREDIBLE REFLEXES! The goalkeeper guesses right and dives full length to push ${penTaker.name}'s penalty away from the bottom corner!`
            });
          }
          return;
        } else {
          // --- MULTI-PART FREE KICK SEQUENCE ---
          const fkTaker = getSpecialist(attTeam, 'FK');
          // 1. Awarded
          await sendIncident({
            minute: min,
            icon: '🚩',
            eventTitle: `FREE KICK AWARDED — ${attTeam.name}`,
            actor: fkTaker,
            secondaryPlayer: midDef,
            narrative: `Free kick awarded in a dangerous position outside the 18-yard box! ${midDef.name}'s challenge is deemed illegal. ${fkTaker.name} immediately claims the ball.`
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

          // 3. Outcome
          const fkGoalChance = Math.min(65, Math.max(20, (fkTaker.fin + (fkTaker.pow || 70)) / 2 - 25));
          if (Math.random() * 100 < fkGoalChance) {
            attTeam.score++;
            fkTaker.goals++;
            fkTaker.shots++;
            scorers.push({ minute: min, player: fkTaker.name, team: attTeam.name });
            matchChronology.push(`⚽ ${min}' Goal (Free Kick) -- ${fkTaker.name} ${fkTaker.flag}`);

            await sendIncident({
              minute: min,
              icon: '⚽',
              eventTitle: `GOAL — ${fkTaker.name} ${fkTaker.flag}`,
              actor: fkTaker,
              narrative: `WHAT A STUNNER! ${fkTaker.name} whips the free kick over the wall and into the top corner! Absolute perfection!`
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

      // Clean Tackle won
      if (defPower >= attResist) {
        midDef.tackles++;
        const commentary = await generateAiMinuteCommentary({
          minute: min,
          type: 'TACKLE',
          homeTeam: homeTeam.name,
          awayTeam: awayTeam.name,
          homeScore: homeTeam.score,
          awayScore: awayTeam.score,
          actorPlayer: `${midDef.name} (${midDef.playstyle})`,
          secondaryPlayer: midAtt.name,
          details: `${isHighPress ? 'Suffocating high press' : 'Decisive tackling challenge'} dispossesses ${midAtt.name} cleanly near the midfield circle.`
        });

        await sendIncident({
          minute: min,
          icon: '🛡️',
          eventTitle: isHighPress ? 'HIGH PRESS TURNOVER' : 'TACKLE WON',
          actor: midDef,
          secondaryPlayer: midAtt,
          narrative: commentary
        });
        return;
      }
    }

    // SCENARIO 3: Playmaking, Key Passes & Dribbles
    if (roll < 72) {
      const isThroughMiddle = attTeam.tactics.focusPassing === 'Through The Middle';
      const isShortPassing = attTeam.tactics.passingStyle === 'Short';

      if (Math.random() < 0.5) {
        // Dribble
        striker.dribblesWon++;
        const commentary = await generateAiMinuteCommentary({
          minute: min,
          type: 'DRIBBLE',
          homeTeam: homeTeam.name,
          awayTeam: awayTeam.name,
          homeScore: homeTeam.score,
          awayScore: awayTeam.score,
          actorPlayer: `${striker.name} (${striker.playstyle})`,
          secondaryPlayer: defPlayer.name,
          details: `Explosive agility leaves the defender behind with quick footwork in the attacking channel.`
        });

        await sendIncident({
          minute: min,
          icon: '⚡',
          eventTitle: 'DRIBBLE',
          actor: striker,
          secondaryPlayer: defPlayer,
          narrative: commentary
        });
      } else {
        // Key Pass / Buildup
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
          secondaryPlayer: striker.name,
          details: `${isThroughMiddle ? 'Incisive vertical through ball through the middle' : 'Crisp passing combination'} creating an attacking lane.`
        });

        await sendIncident({
          minute: min,
          icon: isShortPassing ? '🪄' : '🔑',
          eventTitle: isShortPassing ? 'TIKI-TAKA COMBINATION' : 'KEY PASS',
          actor: midAtt,
          secondaryPlayer: striker,
          narrative: commentary
        });
      }
      return;
    }

    // SCENARIO 4: Direct Scoring Chance on Goal!
    striker.shots++;
    const strikerFinishing = striker.fin * 1.5 + striker.cmp + (striker.playstyle === 'PCH' ? 12 : 0);
    const defResistance = defPlayer.tck + defPlayer.int + defPlayer.phy;
    const goalProb = Math.max(25, Math.min(80, 48 + Math.round((strikerFinishing - defResistance) * 0.4)));

    if (Math.random() * 100 < goalProb) {
      // ⚽ GOAL SCORED!
      attTeam.score++;
      striker.goals++;
      midAtt.assists++;
      scorers.push({ minute: min, player: striker.name, team: attTeam.name, assistBy: midAtt.name });
      matchChronology.push(`⚽ ${min}' Goal -- ${striker.name} ${striker.flag} (assist: ${midAtt.name} ${midAtt.flag})`);

      const commentary = await generateAiMinuteCommentary({
        minute: min,
        type: 'GOAL',
        homeTeam: homeTeam.name,
        awayTeam: awayTeam.name,
        homeScore: homeTeam.score,
        awayScore: awayTeam.score,
        actorPlayer: `${striker.name} (${striker.playstyle})`,
        secondaryPlayer: midAtt.name,
        details: `${midAtt.name} tees up ${striker.name}, who executes with clinical precision past the keeper.`
      });

      await sendIncident({
        minute: min,
        icon: '⚽',
        eventTitle: `GOAL — ${striker.name} ${striker.flag} (Assist: ${midAtt.name} ${midAtt.flag})`,
        actor: striker,
        secondaryPlayer: midAtt,
        extraMentions: [defPlayer],
        narrative: commentary
      });
    } else {
      // Save or Deflected to Corner
      const isDeflectedToCorner = Math.random() < 0.6;
      if (isDeflectedToCorner) {
        // --- MULTI-PART CORNER SEQUENCE ---
        const cornerTaker = getSpecialist(attTeam, 'CORNER');
        // 1. Awarded
        await sendIncident({
          minute: min,
          icon: '🚩',
          eventTitle: `CORNER AWARDED — ${attTeam.name}`,
          actor: cornerTaker,
          secondaryPlayer: striker,
          narrative: `Goalkeeper parries the venomous strike behind the post! Corner kick awarded to ${attTeam.name}.`
        });
        await sleep(2200);

        // 2. Taken
        await sendIncident({
          minute: min,
          icon: '🎯',
          eventTitle: 'CORNER TAKEN',
          actor: cornerTaker,
          narrative: `${cornerTaker.name} whips a curling delivery deep into the mixer toward the penalty spot!`
        });
        await sleep(2200);

        // 3. Outcome (Header Duel)
        const headerRoll = (striker.hea || 75) * 1.2 + striker.phy;
        const defHeaderRoll = (defPlayer.hea || 70) + defPlayer.phy;

        if (headerRoll > defHeaderRoll && Math.random() < 0.45) {
          attTeam.score++;
          striker.goals++;
          striker.shots++;
          cornerTaker.assists++;
          scorers.push({ minute: min, player: striker.name, team: attTeam.name, assistBy: cornerTaker.name });
          matchChronology.push(`⚽ ${min}' Goal (Corner) -- ${striker.name} ${striker.flag} (assist: ${cornerTaker.name} ${cornerTaker.flag})`);

          await sendIncident({
            minute: min,
            icon: '⚽',
            eventTitle: `GOAL (Corner) — ${striker.name} ${striker.flag} (Assist: ${cornerTaker.name} ${cornerTaker.flag})`,
            actor: striker,
            secondaryPlayer: cornerTaker,
            narrative: `THUNDEROUS HEADER! ${striker.name} rises above the defensive wall and hammers the corner kick into the back of the net! GOAL!`
          });
        } else {
          await sendIncident({
            minute: min,
            icon: '❌',
            eventTitle: 'CORNER MISSED',
            actor: defPlayer,
            secondaryPlayer: cornerTaker,
            narrative: `${defPlayer.name} towers above the attacker to clear the corner kick safely away from the danger zone.`
          });
        }
      } else {
        // Direct Save
        const commentary = await generateAiMinuteCommentary({
          minute: min,
          type: 'SAVE',
          homeTeam: homeTeam.name,
          awayTeam: awayTeam.name,
          homeScore: homeTeam.score,
          awayScore: awayTeam.score,
          actorPlayer: defPlayer.name,
          secondaryPlayer: striker.name,
          details: `Reflex save keeps out ${striker.name}'s goalbound shot.`
        });

        await sendIncident({
          minute: min,
          icon: '🧤',
          eventTitle: 'SPECTACULAR SAVE',
          actor: defPlayer,
          secondaryPlayer: striker,
          narrative: commentary
        });
      }
    }
  };

  // ==========================================
  // 1. FIRST HALF SIMULATION LOOP
  // ==========================================
  for (const minute of half1Minutes) {
    await simulatePhase(minute);
    await sleep(tickDelay);
  }

  // ==========================================
  // 2. HALF TIME INTERMISSION (45')
  // ==========================================
  matchChronology.push(`⏸️ 45' Halftime`);

  const halfTimeEmbed = new EmbedBuilder()
    .setColor('#1e293b')
    .setAuthor({ name: "HT' 🕒" })
    .setTitle('⏸️ HALF TIME')
    .setDescription(
      `### ${homeTeam.name} ${homeTeam.score} : ${awayTeam.score} ${awayTeam.name}\n\n` +
      `The referee blows for half time! Both squads head to the dressing rooms after a high-octane 45 minutes.\n\n` +
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
  // 3. SECOND HALF SIMULATION LOOP
  // ==========================================
  for (const minute of half2Minutes) {
    await simulatePhase(minute);
    await sleep(tickDelay);
  }

  matchChronology.push(`🏁 90+5' Fulltime`);

  // ==========================================
  // 4. POST-MATCH PERFORMANCE RATINGS & SCOREBOARD
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

  // Highest rated player on pitch is MOTM
  const allPlayers = [
    homeTeam.players.atk, homeTeam.players.mid, homeTeam.players.def,
    awayTeam.players.atk, awayTeam.players.mid, awayTeam.players.def
  ];
  allPlayers.sort((a, b) => b.rating - a.rating);
  const motm = allPlayers[0];
  const motmTeam = (motm.flag === homeTeam.flag) ? homeTeam : awayTeam;

  // Full-time notification
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
    files: [chartAttachment]
  });

  logger.info(`✅ Match completed: ${homeTeam.name} ${homeTeam.score} - ${awayTeam.score} ${awayTeam.name}`);
  await sleep(2500);

  // ==========================================
  // 5. DISPATCH REAL AI GAZETTE TO #NEWS
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

      const newspaperEmbed = new EmbedBuilder()
        .setColor('#f59e0b')
        .setTitle('📰 THE DAILY WHISTLE — MATCHDAY GAZETTE & REPORT')
        .setDescription(
          `>>> ${newsArticle}\n\n` +
          `───────────────────────────\n` +
          `- # 📡 Published by the AI Sports Journalism Bureau • Beyond The Final Whistle`
        )
        .setFooter({ text: 'AI Sports Journalism Engine • Beyond The Final Whistle' })
        .setTimestamp();

      const newsFiles: AttachmentBuilder[] = [];
      const newsImgPath = path.resolve(process.cwd(), 'assets/match_news.png');
      if (fs.existsSync(newsImgPath)) {
        newsFiles.push(new AttachmentBuilder(newsImgPath, { name: 'match_news.png' }));
        newspaperEmbed.setImage('attachment://match_news.png');
      }

      await newsChannel.send({
        content: '📢 **@News Ping**',
        embeds: [newspaperEmbed],
        files: newsFiles
      });
      logger.info(`✅ Match gazette dispatched to #${newsChannel.name}`);
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
