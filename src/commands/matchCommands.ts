import { Message, EmbedBuilder, AttachmentBuilder } from 'discord.js';
import path from 'path';
import fs from 'fs';
import { simulateFullMatch } from '../engines/matchSimulationEngine.js';
import { prisma } from '../database/prisma.js';
import { getEmoji } from '../utils/emojiHelper.js';
import { THEME_COLORS, UI, makeDualProgressBar, subtext } from '../utils/themeHelper.js';

export async function handleMatchCommand(message: Message, args: string[]) {
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
