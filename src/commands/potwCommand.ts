import { Message, EmbedBuilder } from 'discord.js';
import { prisma } from '../database/prisma.js';
import { calculateDerivedRatings } from '../engines/matchSimulationEngine.js';
import { formatK } from '../utils/formatHelper.js';
import { THEME_COLORS, UI, subtext } from '../utils/themeHelper.js';

export async function handlePotwCommand(message: Message) {
  // Query players sorted by weeklyFormPoints
  const contenders = await prisma.player.findMany({
    where: { weeklyFormPoints: { gt: 0 } },
    orderBy: { weeklyFormPoints: 'desc' },
    take: 10,
    include: { nation: true, club: true }
  });

  const caller = await prisma.player.findUnique({
    where: { id: message.author.id }
  });

  const lines = contenders.map((p, i) => {
    const medal = ['🥇', '🥈', '🥉'][i] || `\`#${i + 1}\``;
    const isCaller = p.id === message.author.id ? ' **(YOU)**' : '';
    const teamTag = `${p.nation?.name || p.club?.name || 'Free Agent'}`;
    return `${medal} **${p.username}**${isCaller} \`[${teamTag}]\` — **${p.weeklyFormPoints} Form Pts** (${p.goalsScored}G • ${p.assists}A • ${p.motmCount} MVP)`;
  });

  const embed = new EmbedBuilder()
    .setColor(THEME_COLORS.GOLD)
    .setTitle('🌟 PLAYER OF THE WEEK (POTW) — OFFICIAL RACE')
    .setDescription(
      [
        'Weekly form leaderboard evaluated across match telemetry (Goals, Assists, Tackles, Clean Sheets & MOTM awards).',
        `👑 **Sunday Grand Prize:** Winner receives **Player of the Week Prestige Badge** + **+100,000 coins**!`,
        `### 🏆 Current Form Standings\n` +
        (lines.length > 0 ? lines.join('\n') : '*No form points logged yet this week. Play matches to earn form points!*'),
        `${UI.DIVIDER}\n` +
        `👤 **Your Weekly Form:** \`${caller?.weeklyFormPoints || 0} Points\`\n` +
        subtext('Form points reset every Sunday at 00:00 UTC.')
      ].join(UI.SPACER)
    )
    .setFooter({ text: 'Beyond The Final Whistle • Awards Bureau' })
    .setTimestamp();

  await message.reply({ embeds: [embed] });
}
