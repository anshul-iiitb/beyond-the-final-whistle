import { Message, EmbedBuilder } from 'discord.js';
import { prisma } from '../database/prisma.js';
import { formatK } from '../utils/formatHelper.js';
import { THEME_COLORS, UI, subtext } from '../utils/themeHelper.js';

interface StadiumTier {
  level: number;
  capacity: number;
  upgradeCost: bigint;
  name: string;
  bonus: string;
}

const STADIUM_TIERS: Record<number, StadiumTier> = {
  1: { level: 1, capacity: 15000, upgradeCost: 0n, name: 'Local Community Ground', bonus: '+1.5 Home Advantage' },
  2: { level: 2, capacity: 25000, upgradeCost: 2500000n, name: 'Municipal Arena', bonus: '+3.0 Home Advantage' },
  3: { level: 3, capacity: 45000, upgradeCost: 5000000n, name: 'Championship Colosseum', bonus: '+4.5 Home Advantage' },
  4: { level: 4, capacity: 65000, upgradeCost: 10000000n, name: 'Grand Continental Stadium', bonus: '+5.5 Home Advantage' },
  5: { level: 5, capacity: 90000, upgradeCost: 20000000n, name: 'Iconic Global Cathedral', bonus: '+6.0 Max Home Advantage' }
};

export async function handleStadiumCommand(message: Message, args: string[]) {
  const player = await prisma.player.findUnique({
    where: { id: message.author.id },
    include: { club: true, nation: true }
  });

  const club = player?.club;
  if (!club) {
    return await message.reply('❌ You must be signed to a **Club Franchise** to inspect or upgrade club stadium facilities.');
  }

  const sub = args[0]?.toLowerCase();

  // 1. Upgrade Stadium Action
  if (sub === 'upgrade') {
    const isLeader = club.captainId === message.author.id || message.member?.permissions.has('Administrator');
    if (!isLeader) {
      return await message.reply('❌ Only the **Club Captain** or an Administrator can authorize stadium infrastructure capital upgrades.');
    }

    const currentLevel = club.stadiumLevel || 1;
    if (currentLevel >= 5) {
      return await message.reply('🏟️ Your club stadium is already at **Max Level 5 (Iconic Global Cathedral)**!');
    }

    const nextTier = STADIUM_TIERS[currentLevel + 1];
    if (club.vault < nextTier.upgradeCost) {
      return await message.reply(
        `🪙 **Insufficient Club Vault Funds!**\n` +
        `Upgrading to **Level ${nextTier.level} (${nextTier.name})** requires **${formatK(nextTier.upgradeCost)} coins** from the club vault.\n` +
        `Current Club Vault: \`${formatK(club.vault)} coins\`.`
      );
    }

    await prisma.footballClub.update({
      where: { id: club.id },
      data: {
        vault: { decrement: nextTier.upgradeCost },
        stadiumLevel: nextTier.level,
        stadiumCapacity: nextTier.capacity
      }
    });

    return await message.reply(
      `🏟️ **STADIUM UPGRADE COMPLETED!**\n\n` +
      `**${club.name}** expanded facilities to **Level ${nextTier.level} (${nextTier.name})**!\n` +
      `• **Capacity:** \`${nextTier.capacity.toLocaleString()} seats\`\n` +
      `• **Home Advantage Surge:** \`${nextTier.bonus}\`\n` +
      `• **Vault Deduction:** \`-${formatK(nextTier.upgradeCost)} coins\`\n` +
      `• **Remaining Club Vault:** \`${formatK(club.vault - nextTier.upgradeCost)} coins\``
    );
  }

  // 2. Rename Stadium Action
  if (sub === 'name' || sub === 'rename') {
    const isLeader = club.captainId === message.author.id || message.member?.permissions.has('Administrator');
    if (!isLeader) {
      return await message.reply('❌ Only the **Club Captain** can rename the home stadium.');
    }

    const newName = args.slice(1).join(' ').trim();
    if (!newName || newName.length < 3 || newName.length > 40) {
      return await message.reply('❌ Usage: `-stadium name <stadium name>` (3 to 40 characters).');
    }

    await prisma.footballClub.update({
      where: { id: club.id },
      data: { stadiumName: newName }
    });

    return await message.reply(`🏟️ **${club.name}**'s home stadium has been officially christened: **${newName}**!`);
  }

  // 3. Inspect Stadium Overview
  const currentLevel = club.stadiumLevel || 1;
  const currentTier = STADIUM_TIERS[currentLevel];
  const nextTier = STADIUM_TIERS[currentLevel + 1];

  const stadiumDisplayName = club.stadiumName || `${club.name} Arena`;

  const embed = new EmbedBuilder()
    .setColor(THEME_COLORS.TURF)
    .setTitle(`🏟️ ${stadiumDisplayName} — ${club.name}`)
    .setDescription(
      [
        `Home venue of **${club.name}** \`${club.badge}\` • Club Vault: **${formatK(club.vault)} coins**`,
        `### 📐 Infrastructure Overview\n` +
        `• **Stadium Tier:** Level \`${currentLevel}/5\` (${currentTier.name})\n` +
        `• **Seating Capacity:** \`${(club.stadiumCapacity || currentTier.capacity).toLocaleString()} seats\`\n` +
        `• **Home Crowd Advantage:** \`${currentTier.bonus}\` to matchday ratings & possession`,
        nextTier
          ? `### 🏗️ Next Expansion: Level ${nextTier.level} (${nextTier.name})\n` +
            `• **Capacity:** \`${nextTier.capacity.toLocaleString()} seats\`\n` +
            `• **Home Advantage Surge:** \`${nextTier.bonus}\`\n` +
            `• **Construction Cost:** **${formatK(nextTier.upgradeCost)} coins** *(Paid from Club Vault)*\n` +
            `• **Command:** \`-stadium upgrade\``
          : `### 🌟 Maximum Infrastructure Achieved!\nYour stadium is at maximum capacity with world-class facilities.`,
        `${UI.DIVIDER}\n` +
        subtext('💡 Leaders: Use `-stadium upgrade` to expand or `-stadium name <name>` to rebrand!')
      ].join(UI.SPACER)
    )
    .setFooter({ text: 'Beyond The Final Whistle • Stadium Infrastructure Bureau' })
    .setTimestamp();

  await message.reply({ embeds: [embed] });
}
