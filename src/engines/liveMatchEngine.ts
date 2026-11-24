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
  let homePossBonus = (homeMidScore - awayMidScore) * 0.6;

  // Tactical possession adjustments
  if (homeTeam.tactics.passingStyle === 'Short') homePossBonus += 7;
  if (homeTeam.tactics.passingStyle === 'Long') homePossBonus -= 6;
  if (homeTeam.tactics.pressingStyle === 'High') homePossBonus += 4;
  if (awayTeam.tactics.passingStyle === 'Long') homePossBonus += 5;
  if (homeTeam.tactics.teamMentality === 'Attacking' || homeTeam.tactics.teamMentality === 'Hard Attacking') homePossBonus += 5;
  if (awayTeam.tactics.teamMentality === 'Hard Defending') homePossBonus += 6;

  const calculatedHomePoss = Math.max(25, Math.min(78, Math.round(50 + homePossBonus + (Math.random() * 6 - 3))));
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

  // Helper to pick set piece specialist
  const getSpecialist = (team: MatchTeam, type: 'FK' | 'CORNER' | 'PEN'): MatchPlayer => {
    const name = (type === 'FK' ? team.freeKickTakerName : type === 'CORNER' ? team.cornerTakerName : team.penaltyTakerName) || '';
    if (team.players.atk.name.toLowerCase() === name.toLowerCase()) return team.players.atk;
    if (team.players.mid.name.toLowerCase() === name.toLowerCase()) return team.players.mid;
    return team.players.def;
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
    secondaryPlayer: homeTeam.players.atk.name,
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

  // Generate 7-8 discrete phases for each half
  const half1Minutes = [3, 8, 14, 21, 28, 35, 41, 45];
  const half2Minutes = [49, 56, 62, 70, 77, 83, 88, 90];

  /**
   * Executes a rich, tactical simulation phase selecting from 30+ interaction events
   */
  const simulateTacticalPhase = async (min: number) => {
    // 1. Determine attacking team based on possession roll + mentality modifiers
    let homeAttackingWeight = homeTeam.possession;
    if (homeTeam.tactics.teamMentality === 'Hard Attacking') homeAttackingWeight += 12;
    if (homeTeam.tactics.teamMentality === 'Attacking') homeAttackingWeight += 6;
    if (homeTeam.tactics.teamMentality === 'Hard Defending') homeAttackingWeight -= 15;
    if (awayTeam.tactics.teamMentality === 'Hard Attacking') homeAttackingWeight -= 12;

    const isHomeAttacking = Math.random() * 100 < Math.max(20, Math.min(80, homeAttackingWeight));
    const attTeam = isHomeAttacking ? homeTeam : awayTeam;
    const defTeam = isHomeAttacking ? awayTeam : homeTeam;

    const striker = attTeam.players.atk;
    const midAtt = attTeam.players.mid;
    const defAtt = attTeam.players.def;

    const defPlayer = defTeam.players.def;
    const midDef = defTeam.players.mid;
    const oppStriker = defTeam.players.atk;

    // Tactical parameters in play
    const attTactics = attTeam.tactics;
    const defTactics = defTeam.tactics;

    const actionRoll = Math.random() * 100;

    // ==========================================
    // 1. DEFENSIVE TRAP & COUNTER PRESSING INTERVENTIONS
    // ==========================================

    // Scenario A: OFFSIDE TRAP (Triggered if defending team has offside trap ON)
    if (defTactics.offsideTrap === 'On' && actionRoll < 20) {
      const defTrapRating = defPlayer.int * 1.4 + defPlayer.cmp;
      const attPaceRating = striker.pac * 1.2 + striker.vis;

      if (defTrapRating >= attPaceRating || Math.random() < 0.6) {
        // Trapped!
        const commentary = await generateAiMinuteCommentary({
          minute: min,
          type: 'OFFSIDE',
          homeTeam: homeTeam.name,
          awayTeam: awayTeam.name,
          homeScore: homeTeam.score,
          awayScore: awayTeam.score,
          actorPlayer: `${striker.name} (${striker.playstyle})`,
          secondaryPlayer: defPlayer.name,
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
          secondaryPlayer: defPlayer.name,
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
        // Cascades directly into a massive scoring chance below!
      }
    }

    // Scenario B: HIGH PRESS TURNOVER (Triggered if defending team has High Press)
    if (defTactics.pressingStyle === 'High' && actionRoll >= 20 && actionRoll < 35) {
      const pressPower = midDef.tck + midDef.wrk * 1.3;
      const attResistance = midAtt.cmp * 1.2 + midAtt.dri;

      if (pressPower > attResistance) {
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
          details: `Suffocating high press hounds ${midAtt.name} into an error in their own defensive third, winning the ball cleanly.`
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
    if (actionRoll >= 35 && actionRoll < 55) {
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
          secondaryPlayer: striker.name,
          details: `${defPlayer.name} stays on their feet with disciplined jockeying, shutting down the passing angle without committing a foul.`
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

      // Check for foul with Hard Tackling
      const foulChance = isHardTackling ? 0.42 : 0.15;
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

        const isPenalty = Math.random() < 0.22; // 22% of fouls inside penalty box

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
          // 1. Awarded
          await sendIncident({
            minute: min,
            icon: '🚩',
            eventTitle: `FREE KICK AWARDED — ${attTeam.name}`,
            actor: fkTaker,
            secondaryPlayer: midDef,
            narrative: `Free kick awarded in dangerous territory outside the 18-yard box! ${midDef.name}'s challenge is deemed illegal. ${fkTaker.name} immediately claims the ball.`
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
          const fkGoalChance = Math.min(65, Math.max(18, (fkTaker.fin + (fkTaker.pow || 70)) / 2 - 25));
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
        secondaryPlayer: tackledPlayer.name,
        details: `${isHardTackling ? 'Bone-crunching enforcer challenge' : 'Timed slide tackle'} dispossesses ${tackledPlayer.name} cleanly on the pitch.`
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
          eventTitle: `VAR DECISION: STRAIGHT RED CARD — ${activeTackler.name} ${activeTackler.flag}`,
          actor: activeTackler,
          secondaryPlayer: tackledPlayer,
          narrative: `RED CARD! The referee returns from the pitchside monitor and brandishes a straight red card! Excessive force with studs caught above the ankle—${defTeam.name} are down to 10 men!`
        });
      }
      return;
    }

    // Scenario D: INTERCEPTIONS & SWEEPER CLEARANCE (BPD & Sweeper Playstyles)
    if (actionRoll >= 55 && actionRoll < 68) {
      if (defPlayer.playstyle === 'SWP') {
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
          secondaryPlayer: striker.name,
          details: `Sweeper uses recovery pace to execute a sliding clearance just as the through ball was arriving.`
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
      } else {
        // Ball-Playing Defender or Anchor Interception
        const interceptor = defPlayer.playstyle === 'BPD' ? defPlayer : midDef;
        interceptor.interceptions++;
        const commentary = await generateAiMinuteCommentary({
          minute: min,
          type: 'TACKLE',
          homeTeam: homeTeam.name,
          awayTeam: awayTeam.name,
          homeScore: homeTeam.score,
          awayScore: awayTeam.score,
          actorPlayer: `${interceptor.name} (${interceptor.playstyle})`,
          secondaryPlayer: midAtt.name,
          details: `Interception! Reads the passing lane early, cutting out the intended pass with effortless composure.`
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

    // ==========================================
    // 2. ATTACKING TACTICS & PLAYMAKING SCENARIOS
    // ==========================================

    // Scenario E: LIGHTNING COUNTER-ATTACK (Force Counter ON)
    if (attTactics.forceCounter === 'On' && defTactics.teamMentality.includes('Attack') && Math.random() < 0.45) {
      striker.shots++;
      const commentary = await generateAiMinuteCommentary({
        minute: min,
        type: 'BUILDUP',
        homeTeam: homeTeam.name,
        awayTeam: awayTeam.name,
        homeScore: homeTeam.score,
        awayScore: awayTeam.score,
        actorPlayer: `${striker.name} (${striker.playstyle})`,
        secondaryPlayer: midAtt.name,
        details: `Lightning 3-touch counter-attack transition springs past the opponent's overcommitted midfield line!`
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
      // Cascades into direct scoring chance below
    }

    // Scenario F: FOCUS PASSING STYLES (Through The Middle vs Flanks vs Long Ball)
    if (actionRoll >= 68 && actionRoll < 82) {
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
          secondaryPlayer: striker.name,
          details: `Slices through the middle with a surgical vertical pass past the defensive line into the pocket.`
        });

        await sendIncident({
          minute: min,
          icon: '🪄',
          eventTitle: 'SLICED THROUGH THE MIDDLE',
          actor: midAtt,
          secondaryPlayer: striker,
          narrative: commentary
        });
        return;
      } else if (attTactics.focusPassing.includes('Flank')) {
        // Flank Overload & Cross
        midAtt.passesCompleted += 2;
        const commentary = await generateAiMinuteCommentary({
          minute: min,
          type: 'BUILDUP',
          homeTeam: homeTeam.name,
          awayTeam: awayTeam.name,
          homeScore: homeTeam.score,
          awayScore: awayTeam.score,
          actorPlayer: `${striker.name} (${striker.playstyle})`,
          secondaryPlayer: defPlayer.name,
          details: `Flank overload! Beats marker down the touchline and whips an inswinging cross into the danger zone.`
        });

        await sendIncident({
          minute: min,
          icon: '👟',
          eventTitle: 'FLANK CROSS & OVERLOAD',
          actor: striker,
          secondaryPlayer: defPlayer,
          narrative: commentary
        });
        return;
      } else if (attTactics.passingStyle === 'Short') {
        // Tiki-Taka Combination
        midAtt.passesCompleted += 4;
        const commentary = await generateAiMinuteCommentary({
          minute: min,
          type: 'BUILDUP',
          homeTeam: homeTeam.name,
          awayTeam: awayTeam.name,
          homeScore: homeTeam.score,
          awayScore: awayTeam.score,
          actorPlayer: `${midAtt.name} (${midAtt.playstyle})`,
          secondaryPlayer: defAtt.name,
          details: `Hypnotic tiki-taka 1-2 combination circulates possession effortlessly through midfield.`
        });

        await sendIncident({
          minute: min,
          icon: '✨',
          eventTitle: 'TIKI-TAKA COMBINATION',
          actor: midAtt,
          secondaryPlayer: defAtt,
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
          secondaryPlayer: defPlayer.name,
          details: `Target Man bullies the defender in the air, bringing down a direct aerial ball on his chest and laying off.`
        });

        await sendIncident({
          minute: min,
          icon: '🦘',
          eventTitle: 'AERIAL HOLD-UP & FLICK-ON',
          actor: striker,
          secondaryPlayer: defPlayer,
          narrative: commentary
        });
        return;
      }
    }

    // Scenario G: MOMENTUM SHIFTS & RALLYING CRY
    if (actionRoll >= 82 && actionRoll < 88) {
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
    // 3. SCORING CHANCES & GOAL ATTEMPTS (88+)
    // ==========================================
    // Dynamic shooter selection: Strikers lead the line, but Midfielders arrive from deep and Defenders push forward!
    const shooterRoll = Math.random() * 100;
    let shooter: MatchPlayer;
    let assister: MatchPlayer | undefined;

    if (shooterRoll < 55) {
      shooter = striker;
      const assistRoll = Math.random() * 100;
      if (assistRoll < 55) assister = midAtt;
      else if (assistRoll < 85) assister = defAtt; // Defender overlapping assist!
      else assister = undefined; // Solo unassisted
    } else if (shooterRoll < 85) {
      shooter = midAtt; // Midfielder box-to-box run or long-range screamer!
      const assistRoll = Math.random() * 100;
      if (assistRoll < 60) assister = striker; // Striker hold-up / layoff assist!
      else if (assistRoll < 85) assister = defAtt; // Defender 50-yard through-ball!
      else assister = undefined; // Solo run
    } else {
      shooter = defAtt; // Overlapping full-back or center-back stepping into attack!
      const assistRoll = Math.random() * 100;
      if (assistRoll < 55) assister = striker;
      else if (assistRoll < 90) assister = midAtt;
      else assister = undefined; // Solo finish
    }

    shooter.shots++;
    const shooterFinishing = shooter.fin * 1.4 + shooter.cmp + (shooter.playstyle === 'PCH' ? 14 : 0);
    const defResistance = defPlayer.tck + defPlayer.int + defPlayer.phy;
    const goalProb = Math.max(22, Math.min(82, 46 + Math.round((shooterFinishing - defResistance) * 0.4)));

    if (Math.random() * 100 < goalProb) {
      // ⚽ GOAL SCORED!
      attTeam.score++;
      shooter.goals++;
      if (assister) assister.assists++;

      const scorerEntry = {
        minute: min,
        player: shooter.name,
        team: attTeam.name,
        assistBy: assister ? assister.name : undefined
      };
      scorers.push(scorerEntry);

      const chronoText = assister
        ? `⚽ ${min}' Goal -- ${shooter.name} ${shooter.flag} (assist: ${assister.name} ${assister.flag})`
        : `⚽ ${min}' Goal -- ${shooter.name} ${shooter.flag} (solo effort)`;
      matchChronology.push(chronoText);

      const goalDetails = assister
        ? (shooter.position === 'DEF'
            ? `${assister.name} slides it into the channel and defender ${shooter.name} steps onto it with a lethal finish!`
            : shooter.position === 'MID'
            ? `${assister.name} lays it off and midfielder ${shooter.name} arrives late in the box with a thunderous strike!`
            : `${assister.name} slides it across and ${shooter.name} executes with ice-cold finishing into the back of the net!`)
        : `${shooter.name} opens his body, beats his marker, and unleashes a glorious solo finish!`;

      const commentary = await generateAiMinuteCommentary({
        minute: min,
        type: 'GOAL',
        homeTeam: homeTeam.name,
        awayTeam: awayTeam.name,
        homeScore: homeTeam.score,
        awayScore: awayTeam.score,
        actorPlayer: `${shooter.name} (${shooter.playstyle})`,
        secondaryPlayer: assister ? assister.name : defPlayer.name,
        details: goalDetails
      });

      const goalTitle = assister
        ? `GOAL — ${shooter.name} ${shooter.flag} (Assist: ${assister.name} ${assister.flag})`
        : `GOAL — ${shooter.name} ${shooter.flag}`;

      await sendIncident({
        minute: min,
        icon: '⚽',
        eventTitle: goalTitle,
        actor: shooter,
        secondaryPlayer: assister,
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
          actor: shooter,
          secondaryPlayer: assister || defPlayer,
          narrative: `HOLD ON! The referee holds his ear! The VAR room in Stockley Park is drawing lines to check if ${shooter.name} was offside in the buildup to the goal!`
        });
        await sleep(2600);

        if (Math.random() < 0.28) {
          // Disallowed!
          attTeam.score--;
          shooter.goals--;
          if (assister) assister.assists--;
          scorers.pop();
          matchChronology.push(`🚫 ${min}' Goal Disallowed by VAR (Offside) -- ${shooter.name} ${shooter.flag}`);

          await sendIncident({
            minute: min,
            icon: '🚫',
            eventTitle: 'VAR DECISION: GOAL DISALLOWED!',
            actor: shooter,
            secondaryPlayer: defPlayer,
            narrative: `GOAL DISALLOWED! The semi-automated technology confirms ${shooter.name}'s shoulder was mere inches offside when the ball was played! The goal is chalked off! Scoreline resets to ${homeTeam.name} ${homeTeam.score} : ${awayTeam.score} ${awayTeam.name}!`
          });
          return;
        } else {
          // Goal stands!
          await sendIncident({
            minute: min,
            icon: '✅',
            eventTitle: 'VAR DECISION: GOAL STANDS!',
            actor: shooter,
            secondaryPlayer: assister || defPlayer,
            narrative: `GOAL CONFIRMED! Replays show the trailing defender's heel played ${shooter.name} onside! The goal officially stands! ${homeTeam.name} ${homeTeam.score} : ${awayTeam.score} ${awayTeam.name}`
          });
        }
      }
    } else {
      // Deflection to Corner or Diving Save
      const isCorner = Math.random() < 0.65;
      if (isCorner) {
        // --- MULTI-PART CORNER SEQUENCE ---
        const cornerTaker = getSpecialist(attTeam, 'CORNER');
        // 1. Awarded
        await sendIncident({
          minute: min,
          icon: '🚩',
          eventTitle: `CORNER AWARDED — ${attTeam.name}`,
          actor: cornerTaker,
          secondaryPlayer: shooter,
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

        // 3. Outcome (Towering Defender Header vs Striker vs Midfielder)
        const headerFinisher = (Math.random() < 0.45 && defAtt.name !== cornerTaker.name)
          ? defAtt // Defender header!
          : (Math.random() < 0.7 ? striker : midAtt);

        const headerRoll = (headerFinisher.hea || 75) * 1.2 + headerFinisher.phy;
        const defHeaderRoll = (defPlayer.hea || 70) + defPlayer.phy;

        if (headerRoll > defHeaderRoll && Math.random() < 0.45) {
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
          await sendIncident({
            minute: min,
            icon: '❌',
            eventTitle: 'CORNER MISSED',
            actor: defPlayer,
            secondaryPlayer: cornerTaker,
            narrative: `${defPlayer.name} rises highest to head the corner kick firmly away from the penalty box.`
          });
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
          secondaryPlayer: shooter.name,
          details: `Acrobatic flying save denies ${shooter.name}'s goalbound strike at full stretch!`
        });

        await sendIncident({
          minute: min,
          icon: '🧤',
          eventTitle: 'SPECTACULAR SAVE',
          actor: defPlayer,
          secondaryPlayer: shooter,
          narrative: commentary
        });
      }
    }
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

      // Generate dynamic match scorecard graphic for THIS specific match
      const scorecardBuf = generateMatchScorecardGraphic({
        homeTeam: homeTeam.name,
        awayTeam: awayTeam.name,
        homeScore: homeTeam.score,
        awayScore: awayTeam.score,
        homePossession: homeTeam.possession,
        awayPossession: awayTeam.possession,
        motmName: motm.name,
        motmRating: motm.rating
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
