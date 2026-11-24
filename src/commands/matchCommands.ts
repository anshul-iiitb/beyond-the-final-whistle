import { Message, EmbedBuilder, AttachmentBuilder, TextChannel } from 'discord.js';
import path from 'path';
import fs from 'fs';
import { simulateFullMatch } from '../engines/matchSimulationEngine.js';
import { runLiveEpisodicMatch, MatchTeam } from '../engines/liveMatchEngine.js';
import { prisma } from '../database/prisma.js';
import { getEmoji } from '../utils/emojiHelper.js';
import { THEME_COLORS, UI, makeDualProgressBar, subtext } from '../utils/themeHelper.js';
import { logger } from '../utils/logger.js';

export async function handleMatchCommand(message: Message, args: string[]) {
  if (args[0]?.toLowerCase() === 'live') {
    return await handleLiveMatchCommand(message, args.slice(1));
  }

  const opponent = message.mentions.users.first();
  const loading = await message.reply('🏟️ **Kickoff whistle blowing! Simulating 90 minutes of high-intensity tactical football...**');

  try {
    const result = await simulateFullMatch(message.author.id, opponent?.id);

    // 1. Post Match Commentary Highlights Embed
    const motmEmoji = getEmoji(message.guild, 'motm');
    const highlightLines = result.commentaryEvents.map(e => `**[${e.minute}'] ${e.header}**\n${e.text}`);
    const possBar = makeDualProgressBar(result.homePossession, result.awayPossession, 10);

    const matchEmbed = new EmbedBuilder()
      .setColor(THEME_COLORS.TURF)
      .setTitle(`⚽ FULL TIME: ${result.homeTeamName} ${result.homeScore} – ${result.awayScore} ${result.awayTeamName}`)
      .setDescription(
        `📊 **Match Possession:**\n` +
        `**${result.homeTeamName}** \`${result.homePossession}%\` ${possBar} \`${result.awayPossession}%\` **${result.awayTeamName}**\n\n` +
        `${motmEmoji} **Player of the Match:** **${result.motmPlayerName}** \`[ Rating: ${result.motmRating} ]\`\n\n` +
        `${UI.DIVIDER}\n` +
        `### ⚡ KEY MATCHDAY HIGHLIGHTS\n\n` +
        highlightLines.slice(0, 5).join('\n\n')
      )
      .setFooter({ text: 'Beyond The Final Whistle • Match Engine' })
      .setTimestamp();

    await loading.edit({ content: '', embeds: [matchEmbed] });

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

    const newsFiles: AttachmentBuilder[] = [];
    const newsImgPath = path.resolve(process.cwd(), 'assets/match_news.png');
    if (fs.existsSync(newsImgPath)) {
      newsFiles.push(new AttachmentBuilder(newsImgPath, { name: 'match_news.png' }));
      newsEmbed.setImage('attachment://match_news.png');
    }

    await (message.channel as any).send({
      content: '📢 **@News Ping**',
      embeds: [newsEmbed],
      files: newsFiles
    });
  } catch (err: any) {
    await loading.edit(`❌ Match simulation error: ${err.message}`);
  }
}

export async function handleIntStatsCommand(message: Message, args: string[]) {
  const targetUser = message.mentions.users.first() || message.author;
  const player = await prisma.player.findUnique({
    where: { id: targetUser.id },
    include: { nation: true }
  });

  if (!player) {
    return await message.reply('❌ Player not found.');
  }

  const motmEmoji = getEmoji(message.guild, 'motm');

  const embed = new EmbedBuilder()
    .setColor(THEME_COLORS.COBALT)
    .setTitle(`🌍 ${player.username}'s International Career Record`)
    .setDescription(
      `Representing: **${player.nation?.flag || '🏴'} ${player.nation?.name || 'Free Agent'}**\n` +
      `${UI.DIVIDER}\n\n` +
      `• **International Caps (Matches):** \`${player.matchesPlayed}\` 🎯\n` +
      `• **International Goals:** \`${player.goalsScored}\` ⚽\n` +
      `• **International Assists:** \`${player.assists}\` 👟\n` +
      `• **MOTM Accolades:** \`${player.motmCount}\` ${motmEmoji}\n` +
      `• **Discipline:** \`${player.yellowCards}\` 🟨 Yellows  •  \`${player.redCards}\` 🟥 Reds\n` +
      `• **Clean Sheets:** \`${player.cleanSheets}\` 🧤`
    )
    .setFooter({ text: 'Beyond The Final Whistle • International Federation' })
    .setTimestamp();

  await message.reply({ embeds: [embed] });
}

export async function handleClubStatsCommand(message: Message, args: string[]) {
  const targetUser = message.mentions.users.first() || message.author;
  const player = await prisma.player.findUnique({
    where: { id: targetUser.id },
    include: { club: true }
  });

  if (!player) {
    return await message.reply('❌ Player not found.');
  }

  const motmEmoji = getEmoji(message.guild, 'motm');

  const embed = new EmbedBuilder()
    .setColor(THEME_COLORS.PRIMARY)
    .setTitle(`🏟️ ${player.username}'s Club Franchise Record`)
    .setDescription(
      `Franchise: **${player.club?.name || 'Free Agent'}**\n` +
      `${UI.DIVIDER}\n\n` +
      `• **Appearances:** \`${player.matchesPlayed}\` 🎯\n` +
      `• **Club Goals:** \`${player.goalsScored}\` ⚽\n` +
      `• **Club Assists:** \`${player.assists}\` 👟\n` +
      `• **MOTM Awards:** \`${player.motmCount}\` ${motmEmoji}`
    )
    .setFooter({ text: 'Beyond The Final Whistle • Club Roster' })
    .setTimestamp();

  await message.reply({ embeds: [embed] });
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

  // Setup Team 1: Morocco (Poacher + Anchor + Ball-Playing Def) with Deep Tactics
  const team1: MatchTeam = {
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
    possession: 57,
    players: {
      atk: {
        id: 'mor-1',
        name: 'Shane',
        position: 'ATK',
        playstyle: 'PCH',
        flag: '🇲🇦',
        fin: 88, pas: 74, tck: 52, dri: 84, int: 50, pac: 86, cmp: 86, vis: 76, phy: 78, wrk: 82,
        goals: 0, assists: 0, shots: 0, tackles: 0, interceptions: 0, passesCompleted: 24, dribblesWon: 0, fouls: 0, yellowCards: 0, redCards: 0, rating: 6.0
      },
      mid: {
        id: 'mor-2',
        name: 'Idkunknown',
        position: 'MID',
        playstyle: 'ANC',
        flag: '🇲🇦',
        fin: 68, pas: 84, tck: 88, dri: 76, int: 86, pac: 80, cmp: 84, vis: 82, phy: 85, wrk: 88,
        goals: 0, assists: 0, shots: 0, tackles: 0, interceptions: 0, passesCompleted: 35, dribblesWon: 0, fouls: 0, yellowCards: 0, redCards: 0, rating: 6.0
      },
      def: {
        id: 'mor-3',
        name: 'Mercking',
        position: 'DEF',
        playstyle: 'BPD',
        flag: '🇲🇦',
        fin: 60, pas: 86, tck: 85, dri: 72, int: 88, pac: 78, cmp: 86, vis: 85, phy: 84, wrk: 82,
        goals: 0, assists: 0, shots: 0, tackles: 0, interceptions: 0, passesCompleted: 42, dribblesWon: 0, fouls: 0, yellowCards: 0, redCards: 0, rating: 6.0
      }
    }
  };

  // Setup Team 2: Mexico (Base 50 Rookies) with Defensive Tactics
  const team2: MatchTeam = {
    name: 'Mexico',
    alias: 'mex',
    flag: '🇲🇽',
    penaltyTakerName: 'Darkvoid',
    freeKickTakerName: 'Shaquib',
    cornerTakerName: 'Shaquib',
    tactics: {
      teamMentality: 'Defensive',
      focusPassing: 'Down Both Flanks',
      passingStyle: 'Long',
      forceCounter: 'Off',
      pressingStyle: 'Low',
      tacklingStyle: 'Normal',
      markingStyle: 'Zonal',
      offsideTrap: 'Off'
    },
    color: [4, 120, 87], // Dark Forest Green
    score: 0,
    possession: 43,
    players: {
      atk: {
        id: 'mex-1',
        name: 'Darkvoid',
        position: 'ATK',
        playstyle: 'ATT',
        flag: '🇲🇽',
        fin: 50, pas: 50, tck: 50, dri: 50, int: 50, pac: 50, cmp: 50, vis: 50, phy: 50, wrk: 50,
        goals: 0, assists: 0, shots: 0, tackles: 0, interceptions: 0, passesCompleted: 12, dribblesWon: 0, fouls: 0, yellowCards: 0, redCards: 0, rating: 6.0
      },
      mid: {
        id: 'mex-2',
        name: 'Shaquib',
        position: 'MID',
        playstyle: 'MID',
        flag: '🇲🇽',
        fin: 50, pas: 50, tck: 50, dri: 50, int: 50, pac: 50, cmp: 50, vis: 50, phy: 50, wrk: 50,
        goals: 0, assists: 0, shots: 0, tackles: 0, interceptions: 0, passesCompleted: 15, dribblesWon: 0, fouls: 0, yellowCards: 0, redCards: 0, rating: 6.0
      },
      def: {
        id: 'mex-3',
        name: 'Theexampleofmiracle',
        position: 'DEF',
        playstyle: 'DEF',
        flag: '🇲🇽',
        fin: 50, pas: 50, tck: 50, dri: 50, int: 50, pac: 50, cmp: 50, vis: 50, phy: 50, wrk: 50,
        goals: 0, assists: 0, shots: 0, tackles: 0, interceptions: 0, passesCompleted: 16, dribblesWon: 0, fouls: 0, yellowCards: 0, redCards: 0, rating: 6.0
      }
    }
  };

  try {
    await runLiveEpisodicMatch(message.client, liveChannel, team1, team2, {
      tickDelayMs: tickDelay,
      halfTimePauseMs: halfTimePause,
      newsChannelId: '1574439070992306236'
    });
  } catch (err: any) {
    logger.error({ err }, 'Error during live match broadcast');
    await (message.channel as any).send(`❌ Error running live match simulation: ${err.message}`);
  }
}
