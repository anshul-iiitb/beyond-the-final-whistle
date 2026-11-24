import { TextChannel, EmbedBuilder, AttachmentBuilder, Client } from 'discord.js';
import path from 'path';
import fs from 'fs';
import { generatePossessionPieChart } from '../utils/chartHelper.js';
import { TeamTactics, parseTeamTactics } from '../commands/tacticsCommand.js';
import { generateAiNewsArticle } from '../services/aiEngine.js';
import { logger } from '../utils/logger.js';

export interface MatchPlayer {
  id: string;
  name: string;
  position: 'ATK' | 'MID' | 'DEF';
  playstyle: string;
  flag: string;
  discordId?: string;
  // Key attributes
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
  // Match stats tracked dynamically
  goals: number;
  assists: number;
  shots: number;
  tackles: number;
  interceptions: number;
  passesCompleted: number;
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
  tickDelayMs?: number;        // Delay between incident messages (default 4000ms for demo/fast, 15000-20000ms for live)
  halfTimePauseMs?: number;    // Half-time pause (default 10000ms for demo, 180000ms / 3 mins for official)
  newsChannelId?: string;      // Destination for AI Gazette (#news)
}

const sleep = (ms: number) => new Promise(res => setTimeout(res, ms));

/**
 * Calculates dynamic player ratings based on match events
 */
function calculatePlayerRating(player: MatchPlayer, teamWon: boolean, cleanSheet: boolean): number {
  let base = 6.0;

  base += player.goals * 1.2;
  base += player.assists * 0.8;
  base += player.tackles * 0.3;
  base += player.interceptions * 0.3;
  base += player.dribblesWon * 0.25;
  base += (player.passesCompleted / 10) * 0.2;
  base -= player.fouls * 0.2;
  base -= player.yellowCards * 0.6;
  base -= player.redCards * 2.0;

  if (teamWon) base += 0.4;
  if (cleanSheet && player.position === 'DEF') base += 0.8;
  if (cleanSheet && player.position === 'MID') base += 0.3;

  // Add small natural variance
  base += (Math.random() * 0.4 - 0.2);

  return +Math.max(4.0, Math.min(10.0, base)).toFixed(1);
}

/**
 * Executes full episodic WITS/Blitz style Live Match Broadcast
 */
export async function runLiveEpisodicMatch(
  client: Client,
  channel: TextChannel,
  homeTeam: MatchTeam,
  awayTeam: MatchTeam,
  options: LiveMatchOptions = {}
) {
  const tickDelay = options.tickDelayMs ?? 4000;
  const halfTimePause = options.halfTimePauseMs ?? 8000;
  const newsChannelId = options.newsChannelId ?? '1574439070992306236'; // #๑•📰│news

  logger.info(`⚽ Starting live episodic match broadcast: ${homeTeam.name} vs ${awayTeam.name} in #${channel.name}`);

  // 1. Calculate tactical possession
  const homeMidVal = homeTeam.players.mid.pas * 2 + homeTeam.players.mid.vis + homeTeam.players.mid.cmp;
  const awayMidVal = awayTeam.players.mid.pas * 2 + awayTeam.players.mid.vis + awayTeam.players.mid.cmp;
  const midDiff = homeMidVal - awayMidVal;

  let possBonus = 0;
  if (homeTeam.tactics.teamMentality === 'Attacking' || homeTeam.tactics.teamMentality === 'Hard Attacking') possBonus += 5;
  if (homeTeam.tactics.passingStyle === 'Short') possBonus += 6;
  if (homeTeam.tactics.pressingStyle === 'High') possBonus += 4;
  if (awayTeam.tactics.passingStyle === 'Long') possBonus += 4; // away gives away possession on long balls

  const rawHomePoss = 50 + Math.round(midDiff / 10) + possBonus;
  homeTeam.possession = Math.max(30, Math.min(75, rawHomePoss));
  awayTeam.possession = 100 - homeTeam.possession;

  const matchChronology: string[] = [];

  // Helper to get formatted player mention
  const formatMention = (p: MatchPlayer) => p.discordId ? `<@${p.discordId}>` : `@${p.name} ${p.flag}`;

  // Helper to send standard incident embed matching WITS screenshots
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
      .setColor('#1e293b') // Dark slate card matching Discord container
      .setAuthor({ name: `${data.minute}' 🕒` })
      .setTitle(`${data.icon} ${data.eventTitle} — ${data.actor.name} ${data.actor.flag}`)
      .setDescription(
        `### ${homeTeam.name} ${homeTeam.score} : ${awayTeam.score} ${awayTeam.name}\n\n` +
        `${data.narrative}\n\n` +
        `${mentions.join(' ')}`
      );

    // If bot has avatar or icon, use as thumbnail
    if (client.user?.displayAvatarURL()) {
      embed.setThumbnail(client.user.displayAvatarURL());
    }

    await channel.send({ embeds: [embed] });
  };

  // ==========================================
  // FIRST HALF (0' - 45')
  // ==========================================

  // 1' Offside Trap triggered (Morocco/Home play offside trap On)
  if (homeTeam.tactics.offsideTrap === 'On') {
    await sendIncident({
      minute: 1,
      icon: '🚩',
      eventTitle: 'OFFSIDE',
      actor: awayTeam.players.atk,
      secondaryPlayer: homeTeam.players.def,
      narrative: `${awayTeam.players.atk.name} times the run wrong—he's caught before the ball's even properly released. ${homeTeam.name}'s offside trap springs like a mousetrap, and the flag is up!`
    });
    await sleep(tickDelay);
  }

  // 6' Tackle Won (Anchor high press)
  homeTeam.players.mid.tackles++;
  await sendIncident({
    minute: 6,
    icon: '🛡️',
    eventTitle: 'TACKLE WON',
    actor: homeTeam.players.mid,
    secondaryPlayer: awayTeam.players.mid,
    narrative: `${homeTeam.players.mid.name} ${homeTeam.players.mid.flag} is everywhere—a suffocating high press, he nicks it cleanly off ${awayTeam.players.mid.name} ${awayTeam.players.mid.flag}.\n${awayTeam.players.mid.name} can't turn, the ball's gone, and ${homeTeam.name} are instantly driving forward again with clean recovery pace.`
  });
  await sleep(tickDelay);

  // 7' Momentum Shift
  await sendIncident({
    minute: 7,
    icon: '🔄',
    eventTitle: 'MOMENTUM SHIFT',
    actor: homeTeam.players.atk,
    secondaryPlayer: homeTeam.players.def,
    narrative: `${homeTeam.name} are building momentum against ${awayTeam.name} right now, pressing up and turning the screw.\n${awayTeam.name} have gone quiet—backs are having to retreat, passes aren't sticking.\n${homeTeam.players.atk.name} nudges it forward, and ${homeTeam.players.def.name} is making the angles... here comes another phase for ${homeTeam.name}.`
  });
  await sleep(tickDelay);

  // 10' Key Pass (BPD / Anchor Vision)
  homeTeam.players.mid.passesCompleted += 3;
  await sendIncident({
    minute: 10,
    icon: '🔑',
    eventTitle: 'KEY PASS',
    actor: homeTeam.players.def,
    secondaryPlayer: homeTeam.players.atk,
    narrative: `${homeTeam.players.def.name} ${homeTeam.players.def.flag} threads it through the seam from deep, and ${homeTeam.players.atk.name} ${homeTeam.players.atk.flag} is in behind—that's the danger! He's racing onto it... but ${awayTeam.name} are across in a flash and the move comes to nothing.`
  });
  await sleep(tickDelay);

  // 13' Tackle Won
  homeTeam.players.mid.tackles++;
  await sendIncident({
    minute: 13,
    icon: '🛡️',
    eventTitle: 'TACKLE WON',
    actor: homeTeam.players.mid,
    secondaryPlayer: awayTeam.players.atk,
    extraMentions: [awayTeam.players.mid],
    narrative: `${awayTeam.players.atk.name} gets hounded under pressure, and the mistake is forced—he can't turn, can't breathe.\n${homeTeam.players.mid.name} ${homeTeam.players.mid.flag} is right there, winning it cleanly off him with that suffocating high press. ${homeTeam.name} swarm, and it spills into their rhythm again.`
  });
  await sleep(tickDelay);

  // 25' Tackle Won (Ball-Playing Defender stands firm)
  homeTeam.players.def.tackles++;
  await sendIncident({
    minute: 25,
    icon: '🛡️',
    eventTitle: 'TACKLE WON',
    actor: homeTeam.players.def,
    secondaryPlayer: awayTeam.players.atk,
    extraMentions: [awayTeam.players.mid],
    narrative: `${homeTeam.players.def.name} ${homeTeam.players.def.flag} stands like a brick wall and crunches into ${awayTeam.players.atk.name} ${awayTeam.players.atk.flag} with a flawless challenge!\nThe press is suffocating—ball won cleanly, and ${awayTeam.players.atk.name}'s half-a-step too late.\n${awayTeam.name}'s shape is scrambling as the counter starts to gather pace.`
  });
  await sleep(tickDelay);

  // 31' Dribble
  homeTeam.players.atk.dribblesWon++;
  await sendIncident({
    minute: 31,
    icon: '⚡',
    eventTitle: 'DRIBBLE',
    actor: homeTeam.players.atk,
    secondaryPlayer: awayTeam.players.def,
    narrative: `${homeTeam.players.atk.name} ${homeTeam.players.atk.flag} is in close, dribbling that opening—silky little touch, the kind that keeps the ball glued to his feet.\n${awayTeam.players.def.name} ${awayTeam.players.def.flag} is trying to recover, but he's left for dead!\n${homeTeam.players.atk.name}'s darting forward now, eyes up—what's the next move for ${homeTeam.name}?`
  });
  await sleep(tickDelay);

  // 34' Multi-Part Free Kick Sequence
  const fkTaker = homeTeam.freeKickTakerName === homeTeam.players.atk.name ? homeTeam.players.atk : homeTeam.players.mid;
  // Step 1: Awarded
  await sendIncident({
    minute: 34,
    icon: '🚩',
    eventTitle: `FREE KICK AWARDED — ${homeTeam.name}`,
    actor: fkTaker,
    secondaryPlayer: homeTeam.players.def,
    narrative: `Free kick awarded to ${homeTeam.name}, and they're right on the edge of the box! ${fkTaker.name} steps up, shaping his run to whip it around the wall. ${homeTeam.players.def.name} is also over it—making sure ${awayTeam.name} keep their lines tight... this is the moment.`
  });
  await sleep(2500);

  // Step 2: Taken
  await sendIncident({
    minute: 34,
    icon: '🎯',
    eventTitle: 'FREE KICK TAKEN',
    actor: fkTaker,
    secondaryPlayer: homeTeam.players.mid,
    narrative: `${fkTaker.name} ${fkTaker.flag} stands over it, setting the wall, for ${homeTeam.name}... ${awayTeam.name} are tight, bodies packed in front.\nHe takes a breath, rolls the ball into position... the referee's whistle sounds, and ${fkTaker.name} strikes!`
  });
  await sleep(2500);

  // Step 3: Missed / Shaved crossbar
  await sendIncident({
    minute: 34,
    icon: '❌',
    eventTitle: 'FREE KICK MISSED',
    actor: fkTaker,
    secondaryPlayer: awayTeam.players.def,
    narrative: `${fkTaker.name} ${fkTaker.flag} steps up to the free kick... and he DRAGS it inches wide of the upright!\n${awayTeam.players.def.name} breathes a massive sigh of relief as it ripples the side netting.\nA let-off for ${awayTeam.name} as we stay level at ${homeTeam.score}-${awayTeam.score}.`
  });
  await sleep(tickDelay);

  // 44' GOAL 1 — Poacher Finish!
  homeTeam.score++;
  homeTeam.players.atk.goals++;
  homeTeam.players.atk.shots++;
  homeTeam.players.mid.assists++;
  matchChronology.push(`⚽ 44' Goal -- ${homeTeam.players.atk.name} ${homeTeam.players.atk.flag} (assist: ${homeTeam.players.mid.name} ${homeTeam.players.mid.flag})`);

  await sendIncident({
    minute: 44,
    icon: '⚽',
    eventTitle: `GOAL — ${homeTeam.players.atk.name} ${homeTeam.players.atk.flag} (Assist: ${homeTeam.players.mid.name} ${homeTeam.players.mid.flag})`,
    actor: homeTeam.players.atk,
    secondaryPlayer: homeTeam.players.mid,
    extraMentions: [homeTeam.players.def],
    narrative: `${homeTeam.players.mid.name} ${homeTeam.players.mid.flag} threads the ball through with surgical precision—${homeTeam.players.atk.name} ${homeTeam.players.atk.flag} is on it like a predator, steering it past the keeper on the half-volley!\n\n**GOAL! ${homeTeam.players.atk.name} MAKES IT 1-0 FOR ${homeTeam.name.toUpperCase()}!**`
  });
  await sleep(tickDelay);

  // 45' Yellow Card for Hard Tackling
  awayTeam.players.mid.yellowCards++;
  awayTeam.players.mid.fouls++;
  matchChronology.push(`🟨 45' Yellow Card -- ${awayTeam.players.mid.name} ${awayTeam.players.mid.flag}`);

  await sendIncident({
    minute: 45,
    icon: '🟨',
    eventTitle: 'YELLOW CARD',
    actor: awayTeam.players.mid,
    secondaryPlayer: homeTeam.players.atk,
    narrative: `${awayTeam.players.mid.name} goes into the referee's notebook with a reckless late lunge, wiping ${homeTeam.players.atk.name} out right on the break!\n${homeTeam.players.atk.name} hits the turf holding his ankle—${awayTeam.name}'s midfield is suddenly under intense scrutiny from the official.`
  });
  await sleep(2500);

  // ==========================================
  // HALF TIME INTERMISSION
  // ==========================================
  matchChronology.push(`⏸️ 45' Halftime`);

  const halfTimeEmbed = new EmbedBuilder()
    .setColor('#1e293b')
    .setAuthor({ name: "HT' 🕒" })
    .setTitle('⏸️ HALF TIME')
    .setDescription(
      `### ${homeTeam.name} ${homeTeam.score} : ${awayTeam.score} ${awayTeam.name}\n\n` +
      `And that's it—the referee blows the whistle for half time!\n` +
      `${homeTeam.name} head into the tunnel leading 1-0 after a commanding opening 45 minutes, dominating possession with their short passing and suffocating high press.\n\n` +
      `${formatMention(homeTeam.players.atk)} ${formatMention(awayTeam.players.atk)}`
    );

  if (client.user?.displayAvatarURL()) {
    halfTimeEmbed.setThumbnail(client.user.displayAvatarURL());
  }

  await channel.send({ embeds: [halfTimeEmbed] });

  // Half time announcement allowing tactics adjustments
  await channel.send({
    content:
      `@${homeTeam.name} @${awayTeam.name}\n` +
      `⏸️ **Half time. Tactics, substitutions, lineup position shuffling, and set pieces are available for 3 minutes.**`
  });

  logger.info(`⏸️ Half time reached (${homeTeam.score}-${awayTeam.score}). Pausing for ${halfTimePause / 1000}s...`);
  await sleep(halfTimePause);

  // Second half restart
  await channel.send({
    content:
      `@${homeTeam.name} @${awayTeam.name}\n` +
      `▶️ **Second half is underway!**`
  });
  await sleep(2500);

  // ==========================================
  // SECOND HALF (46' - 90')
  // ==========================================

  // 50' Offside Trap triggered again
  await sendIncident({
    minute: 50,
    icon: '🚩',
    eventTitle: 'OFFSIDE',
    actor: awayTeam.players.atk,
    secondaryPlayer: homeTeam.players.def,
    narrative: `${awayTeam.players.atk.name}'s timing is just fractionally off—he turns into trouble and the offside flag snaps straight up!\n${homeTeam.name} have caught him again with a defensive line operating in total telepathic sync.`
  });
  await sleep(tickDelay);

  // 51' Long Range Shot Missed
  homeTeam.players.mid.shots++;
  await sendIncident({
    minute: 51,
    icon: '🤷',
    eventTitle: 'LONG RANGE -- MISSED',
    actor: homeTeam.players.mid,
    secondaryPlayer: awayTeam.players.def,
    narrative: `${homeTeam.players.mid.name} lets it rip from distance, and the strike just sails—it's got tremendous power, but it's drifting well off target into the stand!\n${awayTeam.players.def.name} closed quickly to rush the strike.`
  });
  await sleep(tickDelay);

  // 54' Interception (Anchor / BPD reads pass)
  homeTeam.players.def.interceptions++;
  await sendIncident({
    minute: 54,
    icon: '🛡️',
    eventTitle: 'INTERCEPTION',
    actor: homeTeam.players.def,
    secondaryPlayer: awayTeam.players.mid,
    extraMentions: [homeTeam.players.atk],
    narrative: `${homeTeam.players.def.name} reads the passing lane early—INTERCEPTED!\nHe steps out from the backline to extinguish ${awayTeam.players.mid.name}'s attempted through-ball, snapping the danger in an instant and immediately feeding ${homeTeam.players.atk.name}.`
  });
  await sleep(tickDelay);

  // 57' GOAL 2 — Ball-Playing Defender Surges Forward to Score!
  homeTeam.score++;
  homeTeam.players.def.goals++;
  homeTeam.players.def.shots++;
  homeTeam.players.atk.assists++;
  matchChronology.push(`⚽ 57' Goal -- ${homeTeam.players.def.name} ${homeTeam.players.def.flag} (assist: ${homeTeam.players.atk.name} ${homeTeam.players.atk.flag})`);

  await sendIncident({
    minute: 57,
    icon: '⚽',
    eventTitle: `GOAL — ${homeTeam.players.def.name} ${homeTeam.players.def.flag} (Assist: ${homeTeam.players.atk.name} ${homeTeam.players.atk.flag})`,
    actor: homeTeam.players.def,
    secondaryPlayer: homeTeam.players.atk,
    narrative: `${homeTeam.players.atk.name} ${homeTeam.players.atk.flag} slides it into the vacated half-space—${homeTeam.players.def.name} ${homeTeam.players.def.flag} is already charging from deep!\n${homeTeam.players.def.name} takes one deft touch, curls it with his instep, and RIPS the back of the net wide open!\n\n**2-0! The Ball-Playing Defender joins the attack with lethal results!**`
  });
  await sleep(tickDelay);

  // 68' Multi-Part Corner Sequence
  const cornerTaker = homeTeam.cornerTakerName === homeTeam.players.def.name ? homeTeam.players.def : homeTeam.players.mid;
  // Step 1: Corner Awarded
  await sendIncident({
    minute: 68,
    icon: '🚩',
    eventTitle: `CORNER AWARDED — ${homeTeam.name}`,
    actor: cornerTaker,
    secondaryPlayer: homeTeam.players.atk,
    narrative: `Deflection behind for a corner! ${homeTeam.name} pile bodies forward into the 18-yard box as ${cornerTaker.name} heads toward the quadrant.`
  });
  await sleep(2500);

  // Step 2: Corner Taken
  await sendIncident({
    minute: 68,
    icon: '🎯',
    eventTitle: 'CORNER TAKEN',
    actor: cornerTaker,
    secondaryPlayer: homeTeam.players.atk,
    narrative: `Corner comes in—${cornerTaker.name} WHIPS it with ferocious out-swinging pace towards the penalty spot! ${homeTeam.players.atk.name} jostles for position with the marker...`
  });
  await sleep(2500);

  // Step 3: GOAL 3 — Poacher Header / Brace!
  homeTeam.score++;
  homeTeam.players.atk.goals++;
  homeTeam.players.atk.shots++;
  cornerTaker.assists++;
  matchChronology.push(`⚽ 68' Goal -- ${homeTeam.players.atk.name} ${homeTeam.players.atk.flag} (assist: ${cornerTaker.name} ${cornerTaker.flag})`);

  await sendIncident({
    minute: 68,
    icon: '⚽',
    eventTitle: `GOAL — ${homeTeam.players.atk.name} ${homeTeam.players.atk.flag} (Assist: ${cornerTaker.name} ${cornerTaker.flag})`,
    actor: homeTeam.players.atk,
    secondaryPlayer: cornerTaker,
    narrative: `${homeTeam.players.atk.name} leaps above the crowd and CRASHES a bullet header under the crossbar!\n\n**GOAL! 3-0! Marcus Vance claims his brace off a textbook set piece delivery!**`
  });
  await sleep(tickDelay);

  // 75' Away team rare counter-attack goal
  awayTeam.score++;
  awayTeam.players.atk.goals++;
  awayTeam.players.atk.shots++;
  awayTeam.players.mid.assists++;
  matchChronology.push(`⚽ 75' Goal -- ${awayTeam.players.atk.name} ${awayTeam.players.atk.flag} (assist: ${awayTeam.players.mid.name} ${awayTeam.players.mid.flag})`);

  await sendIncident({
    minute: 75,
    icon: '⚽',
    eventTitle: `GOAL — ${awayTeam.players.atk.name} ${awayTeam.players.atk.flag} (Assist: ${awayTeam.players.mid.name} ${awayTeam.players.mid.flag})`,
    actor: awayTeam.players.atk,
    secondaryPlayer: awayTeam.players.mid,
    extraMentions: [homeTeam.players.def],
    narrative: `A moment of inspiration for ${awayTeam.name}! ${awayTeam.players.mid.name} loops an aerial ball over the top, and ${awayTeam.players.atk.name} pounces on the bouncing ball to sneak a low finish inside the near post!\n\n**${awayTeam.name} pull one back to make it 3-1!**`
  });
  await sleep(tickDelay);

  // 88' Spectacular Save
  await sendIncident({
    minute: 88,
    icon: '🧤',
    eventTitle: 'SPECTACULAR SAVE',
    actor: awayTeam.players.def,
    secondaryPlayer: homeTeam.players.atk,
    narrative: `${homeTeam.players.atk.name} unloads a venomous snapshot towards the top corner, but the goalkeeper acrobatically tips it over the bar at full stretch!`
  });
  await sleep(2500);

  // 90+5' Fulltime Whistle
  matchChronology.push(`🏁 90+5' Fulltime`);

  // ==========================================
  // FINAL SCOREBOARD & RATINGS (WITS Screen 1)
  // ==========================================

  // Calculate ratings for all players
  const homeWon = homeTeam.score > awayTeam.score;
  const awayWon = awayTeam.score > homeTeam.score;
  const cleanSheet = awayTeam.score === 0;

  homeTeam.players.atk.rating = calculatePlayerRating(homeTeam.players.atk, homeWon, cleanSheet);
  homeTeam.players.mid.rating = calculatePlayerRating(homeTeam.players.mid, homeWon, cleanSheet);
  homeTeam.players.def.rating = calculatePlayerRating(homeTeam.players.def, homeWon, cleanSheet);

  awayTeam.players.atk.rating = calculatePlayerRating(awayTeam.players.atk, awayWon, false);
  awayTeam.players.mid.rating = calculatePlayerRating(awayTeam.players.mid, awayWon, false);
  awayTeam.players.def.rating = calculatePlayerRating(awayTeam.players.def, awayWon, false);

  // Determine MOTM (Highest rating on winning team)
  const allHome = [homeTeam.players.atk, homeTeam.players.mid, homeTeam.players.def];
  allHome.sort((a, b) => b.rating - a.rating);
  const motm = allHome[0];

  // Full time header announcement
  await channel.send({
    content:
      `@${homeTeam.name.toLowerCase()} @${awayTeam.name.toLowerCase()}\n` +
      `🏁 **Full time: ${homeTeam.name} ${homeTeam.score} - ${awayTeam.score} ${awayTeam.name}**`
  });

  // Scoreboard Embed matching Screenshot 2026-11-24 213446.png
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

  // Generate Authentic Possession Pie Chart
  const pieChartBuf = generatePossessionPieChart(
    homeTeam.name,
    homeTeam.possession,
    homeTeam.color,
    awayTeam.name,
    awayTeam.possession,
    awayTeam.color
  );

  const chartAttachment = new AttachmentBuilder(pieChartBuf, { name: 'possession_chart.png' });

  // Second embed holding the Possession Chart (Matching Screenshot 2026-11-24 213450.png)
  const chartEmbed = new EmbedBuilder()
    .setColor('#1e293b')
    .setImage('attachment://possession_chart.png')
    .setFooter({ text: 'Beyond The Final Whistle • Match Analytics Bureau' })
    .setTimestamp();

  await channel.send({
    embeds: [scoreboardEmbed, chartEmbed],
    files: [chartAttachment]
  });

  logger.info(`✅ Scoreboard and possession pie chart posted to #${channel.name}`);
  await sleep(3000);

  // ==========================================
  // DISPATCH AI TABLOID REPORT TO #NEWS
  // ==========================================
  try {
    const newsChannel = (client.channels.cache.get(newsChannelId) ||
      client.channels.cache.find(c => (c as any).name?.includes('news'))) as TextChannel;
    if (newsChannel && newsChannel.isTextBased()) {
      const scorers = [
        { minute: 44, player: homeTeam.players.atk.name, team: homeTeam.name },
        { minute: 57, player: homeTeam.players.def.name, team: homeTeam.name },
        { minute: 68, player: homeTeam.players.atk.name, team: homeTeam.name },
        { minute: 75, player: awayTeam.players.atk.name, team: awayTeam.name },
      ];
      const cards = [
        { minute: 45, player: awayTeam.players.mid.name, type: 'YELLOW' as const, team: awayTeam.name }
      ];

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
          team: homeTeam.name,
          rating: motm.rating,
          stats: `${motm.goals} Goal(s), ${motm.assists} Assist(s), ${motm.tackles} Tackle(s)`
        }
      });

      const newspaperEmbed = new EmbedBuilder()
        .setColor('#f59e0b') // Champions Gold
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
      logger.info(`✅ Match news gazette dispatched to #${newsChannel.name}`);
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
