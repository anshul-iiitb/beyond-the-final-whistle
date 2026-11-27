import { Message, EmbedBuilder, AttachmentBuilder, TextChannel } from 'discord.js';
import path from 'path';
import fs from 'fs';
import { simulateFullMatch } from '../engines/matchSimulationEngine.js';
import { runLiveEpisodicMatch, MatchTeam } from '../engines/liveMatchEngine.js';
import { generateMatchScorecardGraphic } from '../utils/chartHelper.js';
import { buildPlayerStatCardAttachment } from './playerCommands.js';
import { prisma } from '../database/prisma.js';
import { getEmoji } from '../utils/emojiHelper.js';
import { THEME_COLORS, UI, makeDualProgressBar, subtext } from '../utils/themeHelper.js';
import { logger } from '../utils/logger.js';
import { sendThinkingMessage, updateLoadingMessage } from '../utils/loadingHelper.js';

export async function handleFriendlyCommand(message: Message, args: string[]) {
  return await runSimulatedMatchCommand(message, args, true);
}

export async function handleMatchCommand(message: Message, args: string[]) {
  const sub = args[0]?.toLowerCase();
  if (sub === 'live') {
    return await handleLiveMatchCommand(message, args.slice(1));
  }
  if (sub === 'batch' || sub === 'many') {
    return await handleBatchMatchCommand(message, args.slice(1));
  }
  if (sub === 'friendly' || sub === 'exhibition' || sub === 'allstar') {
    return await runSimulatedMatchCommand(message, args.slice(1), true);
  }
  return await runSimulatedMatchCommand(message, args, false);
}

async function runSimulatedMatchCommand(message: Message, args: string[], isExhibition: boolean) {
  const opponent = message.mentions.users.first();
  const thinkingMsg = await sendThinkingMessage(
    message,
    isExhibition
      ? 'Scheduling VIP All-Star Exhibition Match (Zero Risk)...'
      : 'Simulating 90 minutes of tactical football...'
  );

  try {
    const result = await simulateFullMatch(message.author.id, opponent?.id, { isExhibition });

    // 1. Post Match Commentary Highlights Embed
    const motmEmoji = getEmoji(message.guild, 'motm');
    const highlightLines = result.commentaryEvents.map(e => `**[${e.minute}'] ${e.header}**\n${e.text}`);
    const possBar = makeDualProgressBar(result.homePossession, result.awayPossession, 10);

    const boostLine = result.motmBoost
      ? `\n🌟 **All-Star Exhibition MOTM Boost:** **${result.motmBoost.playerName}** gained **+${result.motmBoost.delta} ${result.motmBoost.attrKey}** (\`${result.motmBoost.oldVal}\` ➔ **\`${result.motmBoost.newVal}\`**) — *Zero stat deduction guarantee!*`
      : result.isExhibition
        ? `\n🛡️ **Zero-Risk Guarantee:** Exhibition match completed with no negative attribute deductions.`
        : '';

    const matchEmbed = new EmbedBuilder()
      .setColor(isExhibition ? THEME_COLORS.GOLD : THEME_COLORS.TURF)
      .setTitle(
        isExhibition
          ? `👑 VIP EXHIBITION FULL TIME: ${result.homeTeamName} ${result.homeScore} – ${result.awayScore} ${result.awayTeamName}`
          : `⚽ FULL TIME: ${result.homeTeamName} ${result.homeScore} – ${result.awayScore} ${result.awayTeamName}`
      )
      .setDescription(
        `📊 **Match Possession:**\n` +
        `**${result.homeTeamName}** \`${result.homePossession}%\` ${possBar} \`${result.awayPossession}%\` **${result.awayTeamName}**\n\n` +
        `${motmEmoji} **Player of the Match:** **${result.motmPlayerName}** \`[ Rating: ${result.motmRating} ]\`${boostLine}\n\n` +
        `${UI.DIVIDER}\n` +
        `### ⚡ KEY MATCHDAY HIGHLIGHTS\n\n` +
        highlightLines.slice(0, 5).join('\n\n')
      )
      .setFooter({ text: isExhibition ? 'Beyond The Final Whistle • VIP All-Star Exhibition' : 'Beyond The Final Whistle • Match Engine' })
      .setTimestamp();

    await updateLoadingMessage(thinkingMsg, { content: '', embeds: [matchEmbed], files: [] });

    // 2. Post sensational AI Newspaper Story with @News Ping and Match Infographic
    const newsEmbed = new EmbedBuilder()
      .setColor(THEME_COLORS.GOLD)
      .setTitle('📰 THE DAILY WHISTLE — MATCHDAY GAZETTE & REPORT')
      .setDescription(
        `>>> ${result.newsArticle}\n\n` +
        `${UI.SUB_DIVIDER}\n` +
        subtext('📡 Published by the AI Sports Journalism Bureau • Beyond The Final Whistle')
      )
      .setFooter({ text: 'AI Sports Journalism Engine • Beyond The Final Whistle' })
      .setTimestamp();

    // Dynamic Matchday Telemetry Graphic
    const scorecardBuf = await generateMatchScorecardGraphic({
      homeTeam: result.homeTeamName,
      awayTeam: result.awayTeamName,
      homeScore: result.homeScore,
      awayScore: result.awayScore,
      homePossession: result.homePossession,
      awayPossession: result.awayPossession,
      motmName: result.motmPlayerName,
      motmRating: result.motmRating
    });

    const newsAttachment = new AttachmentBuilder(scorecardBuf, { name: 'match_scorecard.png' });
    newsEmbed.setImage('attachment://match_scorecard.png');

    await (message.channel as any).send({
      content: '📢 **@News Ping**',
      embeds: [newsEmbed],
      files: [newsAttachment]
    });
  } catch (err: any) {
    await updateLoadingMessage(thinkingMsg, `❌ Match simulation error: ${err.message}`);
  }
}

export async function handleIntStatsCommand(message: Message, args: string[]) {
  const targetUser = message.mentions.users.first() || message.author;
  const thinkingMsg = await sendThinkingMessage(message, 'Generating International Career Card...');

  const player = await prisma.player.findUnique({
    where: { id: targetUser.id },
    include: { nation: true, club: true, inventory: true }
  });

  if (!player) {
    return await updateLoadingMessage(thinkingMsg, '❌ Player not found.');
  }

  const motmEmoji = getEmoji(message.guild, 'motm');
  const cardAttachment = await buildPlayerStatCardAttachment(player, targetUser, 'int');

  const embed = new EmbedBuilder()
    .setColor(THEME_COLORS.COBALT)
    .setTitle(`🌍 ${player.username}'s International Career Record`)
    .setDescription(
      `Representing: **${player.nation?.flag || '🏴'} ${player.nation?.name || 'Free Agent'}**\n` +
      `• **Caps:** \`${player.matchesPlayed}\` 🎯 • **Goals:** \`${player.goalsScored}\` ⚽ • **Assists:** \`${player.assists}\` 👟 • **MOTM:** \`${player.motmCount}\` ${motmEmoji}`
    )
    .setImage('attachment://player_stat_card.png')
    .setFooter({ text: 'Beyond The Final Whistle • International Federation' })
    .setTimestamp();

  await updateLoadingMessage(thinkingMsg, { embeds: [embed], files: [cardAttachment] });
}

export async function handleClubStatsCommand(message: Message, args: string[]) {
  const targetUser = message.mentions.users.first() || message.author;
  const thinkingMsg = await sendThinkingMessage(message, 'Generating Club Franchise Career Card...');

  const player = await prisma.player.findUnique({
    where: { id: targetUser.id },
    include: { nation: true, club: true, inventory: true }
  });

  if (!player) {
    return await updateLoadingMessage(thinkingMsg, '❌ Player not found.');
  }

  const motmEmoji = getEmoji(message.guild, 'motm');
  const cardAttachment = await buildPlayerStatCardAttachment(player, targetUser, 'club');

  const embed = new EmbedBuilder()
    .setColor(THEME_COLORS.PRIMARY)
    .setTitle(`🏟️ ${player.username}'s Club Franchise Record`)
    .setDescription(
      `Franchise: **${player.club?.name || 'Free Agent'}**\n` +
      `• **Apps:** \`${player.matchesPlayed}\` 🎯 • **Goals:** \`${player.goalsScored}\` ⚽ • **Assists:** \`${player.assists}\` 👟 • **MOTM:** \`${player.motmCount}\` ${motmEmoji}`
    )
    .setImage('attachment://player_stat_card.png')
    .setFooter({ text: 'Beyond The Final Whistle • Club Roster' })
    .setTimestamp();

  await updateLoadingMessage(thinkingMsg, { embeds: [embed], files: [cardAttachment] });
}

export async function handleRosterCommand(message: Message, args: string[]) {
  const alias = args[0]?.toLowerCase();
  if (!alias) {
    return await message.reply('❌ Please provide a nation or club alias. Example: `-roster ger` or `-roster por`');
  }

  const nation = await prisma.nationalTeam.findUnique({
    where: { alias },
    include: { players: true }
  });

  if (!nation) {
    return await message.reply(`❌ Team with alias \`${alias}\` not found.`);
  }

  const lines = nation.players.map((p, i) => `**${i + 1}. ${p.username}** — \`${p.position}\` (\`${p.playstyle}\`) | OVR: \`${Math.round((p.fin + p.pas + p.tck) / 3)}\``);

  const embed = new EmbedBuilder()
    .setColor(THEME_COLORS.TURF)
    .setTitle(`${nation.flag} ${nation.name} Official Squad Roster`)
    .setDescription(
      `Tactical Philosophy: **${nation.tactics}**\n` +
      `Competitive Record: **${nation.wins}W - ${nation.draws}D - ${nation.losses}L** (\`${nation.points} pts\`)\n` +
      `${UI.DIVIDER}\n\n` +
      (lines.length > 0 ? lines.join('\n') : '*No signed players currently on roster.*')
    )
    .setFooter({ text: 'Beyond The Final Whistle • Team Roster' })
    .setTimestamp();

  await message.reply({ embeds: [embed] });
}

export function getBalancedMorocco(): MatchTeam {
  return {
    name: 'Morocco',
    alias: 'mor',
    flag: '🇲🇦',
    penaltyTakerName: 'Shane',
    freeKickTakerName: 'Shane',
    cornerTakerName: 'Mercking',
    tactics: {
      teamMentality: 'Attacking',
      focusPassing: 'Through The Middle',
      passingStyle: 'Short',
      forceCounter: 'On',
      pressingStyle: 'High',
      tacklingStyle: 'Hard',
      markingStyle: 'Man-To-Man',
      offsideTrap: 'On'
    },
    color: [16, 185, 129], // Emerald
    score: 0,
    possession: 55,
    players: {
      atk: {
        id: 'mor-1',
        name: 'Shane',
        position: 'ATK',
        playstyle: 'PCH',
        flag: '🇲🇦',
        fin: 59, pas: 57, tck: 55, dri: 59, int: 56, pac: 59, cmp: 58, vis: 57, phy: 58, wrk: 58, hea: 58, pow: 58,
        goals: 0, assists: 0, shots: 0, tackles: 0, interceptions: 0, passesCompleted: 24, dribblesWon: 0, fouls: 0, yellowCards: 0, redCards: 0, rating: 6.0
      },
      mid: {
        id: 'mor-2',
        name: 'Idkunknown',
        position: 'MID',
        playstyle: 'ANC',
        flag: '🇲🇦',
        fin: 56, pas: 59, tck: 59, dri: 57, int: 58, pac: 57, cmp: 58, vis: 59, phy: 58, wrk: 59, hea: 57, pow: 58,
        goals: 0, assists: 0, shots: 0, tackles: 0, interceptions: 0, passesCompleted: 35, dribblesWon: 0, fouls: 0, yellowCards: 0, redCards: 0, rating: 6.0
      },
      def: {
        id: 'mor-3',
        name: 'Mercking',
        position: 'DEF',
        playstyle: 'BPD',
        flag: '🇲🇦',
        fin: 55, pas: 58, tck: 59, dri: 56, int: 59, pac: 58, cmp: 57, vis: 57, phy: 59, wrk: 58, hea: 59, pow: 59,
        goals: 0, assists: 0, shots: 0, tackles: 0, interceptions: 0, passesCompleted: 42, dribblesWon: 0, fouls: 0, yellowCards: 0, redCards: 0, rating: 6.0
      }
    }
  };
}

export function getBalancedMexico(): MatchTeam {
  return {
    name: 'Mexico',
    alias: 'mex',
    flag: '🇲🇽',
    penaltyTakerName: 'Shaquib',
    freeKickTakerName: 'Shaquib',
    cornerTakerName: 'Theexampleofmiracle',
    tactics: {
      teamMentality: 'Defensive',
      focusPassing: 'Down Both Flanks',
      passingStyle: 'Long',
      forceCounter: 'On',
      pressingStyle: 'Low',
      tacklingStyle: 'Hard',
      markingStyle: 'Zonal',
      offsideTrap: 'Off'
    },
    color: [5, 150, 105], // Green
    score: 0,
    possession: 45,
    players: {
      atk: {
        id: 'mex-1',
        name: 'Shaquib',
        position: 'ATK',
        playstyle: 'TGT',
        flag: '🇲🇽',
        fin: 52, pas: 50, tck: 50, dri: 51, int: 50, pac: 52, cmp: 51, vis: 50, phy: 52, wrk: 51, hea: 52, pow: 52,
        goals: 0, assists: 0, shots: 0, tackles: 0, interceptions: 0, passesCompleted: 15, dribblesWon: 0, fouls: 0, yellowCards: 0, redCards: 0, rating: 6.0
      },
      mid: {
        id: 'mex-2',
        name: 'Darkvoid',
        position: 'MID',
        playstyle: 'DLP',
        flag: '🇲🇽',
        fin: 50, pas: 52, tck: 51, dri: 50, int: 51, pac: 50, cmp: 51, vis: 52, phy: 51, wrk: 52, hea: 50, pow: 51,
        goals: 0, assists: 0, shots: 0, tackles: 0, interceptions: 0, passesCompleted: 22, dribblesWon: 0, fouls: 0, yellowCards: 0, redCards: 0, rating: 6.0
      },
      def: {
        id: 'mex-3',
        name: 'Theexampleofmiracle',
        position: 'DEF',
        playstyle: 'SWP',
        flag: '🇲🇽',
        fin: 50, pas: 50, tck: 52, dri: 50, int: 52, pac: 51, cmp: 50, vis: 50, phy: 52, wrk: 51, hea: 51, pow: 51,
        goals: 0, assists: 0, shots: 0, tackles: 0, interceptions: 0, passesCompleted: 16, dribblesWon: 0, fouls: 0, yellowCards: 0, redCards: 0, rating: 6.0
      }
    }
  };
}

/**
 * Executes a full WITS/Blitz style Live Episodic Match in #live-match
 */
export async function handleLiveMatchCommand(message: Message, args: string[]) {
  const guild = message.guild;
  if (!guild) return;

  // Locate #live-match channel (ID: 1574439115783409845 or by name)
  let liveChannel = (guild.channels.cache.get('1574439115783409845') ||
    guild.channels.cache.find(c => c.name.includes('live-match'))) as TextChannel;

  if (!liveChannel || !liveChannel.isTextBased()) {
    liveChannel = message.channel as TextChannel;
  }

  const isFullBroadcast = args.includes('full') || args.includes('broadcast');
  const tickDelay = isFullBroadcast ? 15000 : 3500;
  const halfTimePause = isFullBroadcast ? 180000 : 8000;

  await message.reply(
    `🏟️ **Live Match Broadcast initialized!**\n` +
    `⚡ Setting up tactical clash in ${liveChannel.toString()} — grab your seats!`
  );

  const team1 = getBalancedMorocco();
  const team2 = getBalancedMexico();

  try {
    await runLiveEpisodicMatch(message.client, liveChannel, team1, team2, {
      tickDelayMs: tickDelay,
      halfTimePauseMs: halfTimePause,
      newsChannelId: '1574439119227064402'
    });
  } catch (err: any) {
    logger.error({ err }, 'Error during live match broadcast');
    await (message.channel as any).send(`❌ Error running live match simulation: ${err.message}`);
  }
}

/**
 * Executes a Grand Batch Simulation of N matches (default 40), records all telemetry,
 * and exports the final CSV dataset directly into #live-match and the command channel.
 */
export async function handleBatchMatchCommand(message: Message, args: string[]) {
  const guild = message.guild;
  if (!guild) return;

  const rawCount = parseInt(args[0], 10);
  const totalMatches = isNaN(rawCount) || rawCount <= 0 ? 40 : Math.min(100, rawCount);

  // Locate #live-match channel (ID: 1574439115783409845 or by name)
  let liveChannel = (guild.channels.cache.get('1574439115783409845') ||
    guild.channels.cache.find(c => c.name.includes('live-match'))) as TextChannel;

  if (!liveChannel || !liveChannel.isTextBased()) {
    liveChannel = message.channel as TextChannel;
  }

  const isFullSpeed = args.includes('full') || args.includes('broadcast');
  const tickDelay = isFullSpeed ? 3500 : 650;
  const halfTimePause = isFullSpeed ? 8000 : 1500;

  const loadingMsg = await sendThinkingMessage(
    message,
    `Initializing ${totalMatches}-match grand simulation in ${liveChannel.name}...`
  );

  await liveChannel.send({
    content:
      `🚨 **GRAND TOURNAMENT SIMULATION INITIALIZED: ${totalMatches} MATCHES** 🚨\n` +
      `⚔️ **Morocco 🇲🇦 (57–59 Stats) vs Mexico 🇲🇽 (50–52 Stats)**\n` +
      `📊 Every match will be broadcast live with authentic matchday incidents, scorecards, and possession analytics.\n` +
      `📁 Complete tournament dataset will be exported as a CSV report upon completion!`
  });

  const records: Array<{
    matchId: number;
    homeTeam: string;
    homeScore: number;
    awayScore: number;
    awayTeam: string;
    outcome: string;
    margin: number;
    homePoss: number;
    awayPoss: number;
    homeShots: number;
    awayShots: number;
    homeTackles: number;
    awayTackles: number;
    homeInterceptions: number;
    awayInterceptions: number;
    motmPlayer: string;
    motmRating: number;
    scorersSummary: string;
  }> = [];

  const goalscorersTally: Record<string, number> = {};

  for (let i = 1; i <= totalMatches; i++) {
    const team1 = getBalancedMorocco();
    const team2 = getBalancedMexico();

    try {
      await liveChannel.send({
        content: `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n🏟️ **[MATCH ${i}/${totalMatches}] KICKOFF — Morocco 🇲🇦 vs Mexico 🇲🇽**`
      });

      const res = await runLiveEpisodicMatch(message.client, liveChannel, team1, team2, {
        tickDelayMs: tickDelay,
        halfTimePauseMs: halfTimePause,
        newsChannelId: '1574439119227064402'
      });

      const homeGoals = res.homeScore;
      const awayGoals = res.awayScore;
      const margin = Math.abs(homeGoals - awayGoals);
      const outcome = homeGoals > awayGoals ? 'Morocco Win' : awayGoals > homeGoals ? 'Mexico Win' : 'Draw';

      // Collect scorers
      const scorerList: string[] = [];
      for (const p of [team1.players.atk, team1.players.mid, team1.players.def, team2.players.atk, team2.players.mid, team2.players.def]) {
        if (p.goals > 0) {
          scorerList.push(`${p.name} (${p.goals})`);
          goalscorersTally[p.name] = (goalscorersTally[p.name] || 0) + p.goals;
        }
      }

      records.push({
        matchId: i,
        homeTeam: 'Morocco',
        homeScore: homeGoals,
        awayScore: awayGoals,
        awayTeam: 'Mexico',
        outcome,
        margin,
        homePoss: res.homePossession,
        awayPoss: res.awayPossession,
        homeShots: team1.players.atk.shots + team1.players.mid.shots + team1.players.def.shots,
        awayShots: team2.players.atk.shots + team2.players.mid.shots + team2.players.def.shots,
        homeTackles: team1.players.atk.tackles + team1.players.mid.tackles + team1.players.def.tackles,
        awayTackles: team2.players.atk.tackles + team2.players.mid.tackles + team2.players.def.tackles,
        homeInterceptions: team1.players.atk.interceptions + team1.players.mid.interceptions + team1.players.def.interceptions,
        awayInterceptions: team2.players.atk.interceptions + team2.players.mid.interceptions + team2.players.def.interceptions,
        motmPlayer: res.motmPlayerName,
        motmRating: res.motmRating,
        scorersSummary: scorerList.join('; ') || 'None'
      });
    } catch (err: any) {
      logger.error({ err }, `Error during batch simulation match ${i}`);
    }

    // Small breather between broadcasts
    await new Promise(r => setTimeout(r, 1500));
  }

  // 1. Generate CSV
  const csvHeaders = 'Match_ID,Home_Team,Home_Score,Away_Score,Away_Team,Outcome,Margin,Home_Possession,Away_Possession,Home_Shots,Away_Shots,Home_Tackles,Away_Tackles,Home_Interceptions,Away_Interceptions,MOTM_Player,MOTM_Rating,Goal_Summary\n';
  const csvRows = records.map(r =>
    `${r.matchId},"${r.homeTeam}",${r.homeScore},${r.awayScore},"${r.awayTeam}","${r.outcome}",${r.margin},${r.homePoss},${r.awayPoss},${r.homeShots},${r.awayShots},${r.homeTackles},${r.awayTackles},${r.homeInterceptions},${r.awayInterceptions},"${r.motmPlayer}",${r.motmRating},"${r.scorersSummary}"`
  ).join('\n');

  const csvContent = csvHeaders + csvRows;
  const outDir = path.join(process.cwd(), 'data');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const csvFileName = `simulation_results_${totalMatches}_matches_${Date.now()}.csv`;
  const csvFilePath = path.join(outDir, csvFileName);
  fs.writeFileSync(csvFilePath, csvContent, 'utf-8');

  const csvAttachment = new AttachmentBuilder(Buffer.from(csvContent, 'utf-8'), { name: `simulation_results_${totalMatches}_matches.csv` });

  // 2. Compute tournament aggregates
  const moroccoWins = records.filter(r => r.outcome === 'Morocco Win').length;
  const mexicoWins = records.filter(r => r.outcome === 'Mexico Win').length;
  const draws = records.filter(r => r.outcome === 'Draw').length;
  const blowouts = records.filter(r => r.margin >= 4).length;
  const normalWins = records.filter(r => r.margin >= 1 && r.margin <= 2).length;
  const totalGoals = records.reduce((acc, r) => acc + r.homeScore + r.awayScore, 0);
  const avgMoroccoGoals = (records.reduce((acc, r) => acc + r.homeScore, 0) / (records.length || 1)).toFixed(2);
  const avgMexicoGoals = (records.reduce((acc, r) => acc + r.awayScore, 0) / (records.length || 1)).toFixed(2);

  // Top Scorer
  const sortedScorers = Object.entries(goalscorersTally).sort((a, b) => b[1] - a[1]);
  const goldenBoot = sortedScorers.length > 0 ? `${sortedScorers[0][0]} (${sortedScorers[0][1]} goals)` : 'N/A';

  const summaryEmbed = new EmbedBuilder()
    .setColor('#f59e0b')
    .setTitle(`🏆 GRAND TOURNAMENT REPORT: ${totalMatches} MATCHES COMPLETED`)
    .setDescription(
      `### Morocco 🇲🇦 (57–59) vs Mexico 🇲🇽 (50–52)\n\n` +
      `• **Morocco Wins (Favorite):** \`${moroccoWins}\` (${((moroccoWins / (records.length || 1)) * 100).toFixed(1)}%)\n` +
      `• **Mexico Upset Wins (Underdog):** \`${mexicoWins}\` (${((mexicoWins / (records.length || 1)) * 100).toFixed(1)}%)\n` +
      `• **Competitive Draws:** \`${draws}\` (${((draws / (records.length || 1)) * 100).toFixed(1)}%)\n` +
      `• **Normal Competitive Scorelines (1-0, 2-0, 2-1, 3-1):** \`${normalWins}\` (${((normalWins / (records.length || 1)) * 100).toFixed(1)}%)\n` +
      `• **Blowouts (Margin ≥ 4):** \`${blowouts}\` (${((blowouts / (records.length || 1)) * 100).toFixed(1)}%)\n\n` +
      `📊 **Average Match Scoreline:** \`${avgMoroccoGoals} – ${avgMexicoGoals}\`\n` +
      `⚽ **Total Goals Scored:** \`${totalGoals}\`\n` +
      `🥇 **Tournament Golden Boot:** **${goldenBoot}**\n\n` +
      `📁 **Telemetry Dataset Attached Below:** \`simulation_results_${totalMatches}_matches.csv\``
    )
    .setFooter({ text: 'Beyond The Final Whistle • Match Telemetry Bureau' })
    .setTimestamp();

  await liveChannel.send({
    content: `📢 **@Tournament Ping** — All ${totalMatches} matches have concluded!`,
    embeds: [summaryEmbed],
    files: [csvAttachment]
  });

  const responseAttachment = new AttachmentBuilder(Buffer.from(csvContent, 'utf-8'), { name: `simulation_results_${totalMatches}_matches.csv` });
  await updateLoadingMessage(
    loadingMsg,
    {
      content: `✅ **Batch Simulation of ${totalMatches} matches completed successfully!** All telemetry logged and CSV exported.`,
      embeds: [summaryEmbed],
      files: [responseAttachment]
    }
  );
}
