import { Message, EmbedBuilder, AttachmentBuilder } from 'discord.js';
import path from 'path';
import fs from 'fs';
import { simulateFullMatch } from '../engines/matchSimulationEngine.js';
import { prisma } from '../database/prisma.js';

export async function handleMatchCommand(message: Message, args: string[]) {
  const opponent = message.mentions.users.first();
  const loading = await message.reply('🏟️ **Kickoff whistle blowing! Simulating 90 minutes with AI match intelligence...**');

  try {
    const result = await simulateFullMatch(message.author.id, opponent?.id);

    // 1. Post Match Commentary Highlights Embed
    const highlightLines = result.commentaryEvents.map(e => `**[${e.minute}'] ${e.header}**\n${e.text}`);
    const matchEmbed = new EmbedBuilder()
      .setColor('#16a34a')
      .setTitle(`⚽ FULL TIME: ${result.homeTeamName} ${result.homeScore} – ${result.awayScore} ${result.awayTeamName}`)
      .setDescription(
        `📊 **Possession:** ${result.homeTeamName} \`${result.homePossession}%\` | \`${result.awayPossession}%\` ${result.awayTeamName}\n` +
        `👑 **MOTM:** **${result.motmPlayerName}** (\`${result.motmRating} Rating\`)\n\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        highlightLines.slice(0, 5).join('\n\n')
      )
      .setFooter({ text: 'Beyond The Final Whistle • Match Engine' })
      .setTimestamp();

    await loading.edit({ content: '', embeds: [matchEmbed] });

    // 2. Post sensational AI Newspaper Story with @News Ping and Match Infographic
    const newsEmbed = new EmbedBuilder()
      .setColor('#f59e0b')
      .setTitle('📰 THE DAILY WHISTLE — MATCHDAY TELEMETRY & REPORT')
      .setDescription(result.newsArticle)
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

  const embed = new EmbedBuilder()
    .setColor('#0284c7')
    .setTitle(`🌍 ${player.username}'s International Career Record`)
    .setDescription(`Representing: **${player.nation?.flag || '🏴'} ${player.nation?.name || 'Free Agent'}**`)
    .addFields(
      { name: '⚽ Goals', value: `\`${player.goalsScored}\``, inline: true },
      { name: '👟 Assists', value: `\`${player.assists}\``, inline: true },
      { name: '🎯 Caps (Matches)', value: `\`${player.matchesPlayed}\``, inline: true },
      { name: '👑 MOTM Honors', value: `\`${player.motmCount}\``, inline: true },
      { name: '🟨 Discipline', value: `Yellow: \`${player.yellowCards}\` | Red: \`${player.redCards}\``, inline: true },
      { name: '🧤 Clean Sheets', value: `\`${player.cleanSheets}\``, inline: true }
    )
    .setFooter({ text: 'Beyond The Final Whistle • International Federation' });

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

  const embed = new EmbedBuilder()
    .setColor('#9333ea')
    .setTitle(`🏟️ ${player.username}'s Club Career Record`)
    .setDescription(`Signed with: **${player.club?.name || 'Free Agent'}**`)
    .addFields(
      { name: '⚽ Club Goals', value: `\`${player.goalsScored}\``, inline: true },
      { name: '👟 Club Assists', value: `\`${player.assists}\``, inline: true },
      { name: '🎯 Appearances', value: `\`${player.matchesPlayed}\``, inline: true },
      { name: '👑 MOTM Trophies', value: `\`${player.motmCount}\``, inline: true }
    )
    .setFooter({ text: 'Beyond The Final Whistle • Club Roster' });

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

  const lines = nation.players.map((p, i) => `**${i + 1}. ${p.username}** — ${p.position} (\`${p.playstyle}\`) | OVR: \`${Math.round((p.fin + p.pas + p.tck) / 3)}\``);

  const embed = new EmbedBuilder()
    .setColor('#059669')
    .setTitle(`${nation.flag} ${nation.name} Official Roster`)
    .setDescription(
      `Tactics: **${nation.tactics}**\n` +
      `Record: **${nation.wins}W - ${nation.draws}D - ${nation.losses}L** (${nation.points} pts)\n\n` +
      (lines.length > 0 ? lines.join('\n') : '*No signed players currently on roster.*')
    );

  await message.reply({ embeds: [embed] });
}
