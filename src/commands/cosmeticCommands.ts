import { Message, EmbedBuilder } from 'discord.js';
import { prisma } from '../database/prisma.js';
import {
  COSMETIC_CATALOG,
  PROFILE_THEMES,
  getActiveMonthlyCosmetics,
  getCurrentMonthKey
} from '../config/constants.js';
import { acquireMonthlyCosmetic, equipOwnedCosmetic, setPlayerProfileTheme } from '../engines/cosmeticEngine.js';
import { formatK } from '../utils/formatHelper.js';
import { getEmoji } from '../utils/emojiHelper.js';
import { THEME_COLORS, UI, subtext } from '../utils/themeHelper.js';

export async function handleAvatarCommand(message: Message) {
  const player = await prisma.player.findUnique({
    where: { id: message.author.id },
    include: { cosmetics: true }
  });

  const ownedKeys = new Set((player?.cosmetics || []).map(c => c.cosmeticKey));
  const monthKey = getCurrentMonthKey();
  const activeCatalog = getActiveMonthlyCosmetics();
  const coinEmoji = getEmoji(message.guild, 'coin');
  const isVip = (player?.vipTier ?? 0) >= 1;
  const vipPassStatus = !isVip
    ? '🔒 VIP Only (1 Free/month)'
    : player?.lastVipCosmeticMonth === monthKey
      ? '✅ Claimed this month'
      : '🎁 **1 Free Claim Ready!** (`-avatarclaim <alias>`)';

  const avatars = activeCatalog.filter(c => c.kind === 'AVATAR');
  const banners = activeCatalog.filter(c => c.kind === 'BANNER');

  const formatLine = (c: typeof activeCatalog[number]) => {
    const owned = ownedKeys.has(c.key);
    const equipped = player?.equippedAvatar === c.key || player?.equippedBanner === c.key;
    const tag = equipped ? '⭐ Equipped' : owned ? '✅ Owned' : `**${formatK(c.cost)}** ${coinEmoji}`;
    return `${c.emoji} **${c.name}** \`[ alias: ${c.key} | #${c.jerseyNumber} ]\` — ${tag}`;
  };

  const ownedExtras = (player?.cosmetics || [])
    .filter(owned => !activeCatalog.some(a => a.key === owned.cosmeticKey))
    .map(owned => {
      const def = COSMETIC_CATALOG.find(c => c.key === owned.cosmeticKey);
      return `\`${owned.cosmeticKey}\` (${def?.name || owned.name})`;
    });

  const embed = new EmbedBuilder()
    .setColor(THEME_COLORS.PURPLE)
    .setTitle(`🎨 Monthly Avatar & Banner Boutique — ${monthKey} Drop`)
    .setDescription(
      `Spend surplus wealth inside **🛍️ Global Market (\`-travel gm\`)** on rotating monthly footballer editions!\n` +
      `👑 **VIP Monthly Pass:** ${vipPassStatus}\n\n` +
      `### 👤 Profile Badge Avatars (750k Coins)\n` +
      avatars.map(formatLine).join('\n') +
      `\n\n### 🖼️ Full Profile Banners (3,000k High-Roller Sink)\n` +
      banners.map(formatLine).join('\n') +
      (ownedExtras.length > 0 ? `\n\n🎒 **Vaulted Locker Items:** ${ownedExtras.join(', ')}` : '') +
      `\n\n${UI.DIVIDER}\n` +
      subtext('💡 At Global Market (`-travel gm`): `-avatarbuy <alias>` • VIPs: `-avatarclaim <alias>` • Anywhere: `-equip <alias>`')
    )
    .setFooter({ text: 'Beyond The Final Whistle • 8 Footballers Rotated Monthly' })
    .setTimestamp();

  await message.reply({ embeds: [embed] });
}

export async function handleAvatarBuyCommand(message: Message, args: string[]) {
  const alias = args.join(' ').trim();
  if (!alias) {
    return await message.reply('❌ Usage: `-avatarbuy <alias>` (e.g. `-avatarbuy zidane` or `-avatarbuy rodri`). Browse with `-avatar`.');
  }
  const result = await acquireMonthlyCosmetic(message.author.id, alias, 'buy');
  await message.reply(result.message);
}

export async function handleAvatarClaimCommand(message: Message, args: string[]) {
  const alias = args.join(' ').trim();
  if (!alias) {
    return await message.reply('❌ Usage: `-avatarclaim <alias>` to claim your 1 free monthly VIP Avatar or Banner!');
  }
  const result = await acquireMonthlyCosmetic(message.author.id, alias, 'claim');
  await message.reply(result.message);
}

export async function handleEquipCommand(message: Message, args: string[]) {
  const alias = args.join(' ').trim();
  if (!alias) {
    return await message.reply('❌ Usage: `-equip <alias>` (or `-equip none` to clear).');
  }
  const result = await equipOwnedCosmetic(message.author.id, alias);
  await message.reply(result.message);
}

export async function handleThemeCommand(message: Message, args: string[]) {
  const themeArg = args.join(' ').trim();
  if (!themeArg) {
    const player = await prisma.player.findUnique({ where: { id: message.author.id } });
    const active = player?.profileTheme || 'obsidian';

    const list = PROFILE_THEMES.map((t, i) => {
      const marker = t.key === active ? ' ⭐ **(Active)**' : '';
      return `**${i + 1}.** \`${t.key}\` — **${t.name}**${marker}`;
    }).join('\n');

    const embed = new EmbedBuilder()
      .setColor(THEME_COLORS.PRIMARY)
      .setTitle('🖼️ Generative Profile Visual Themes (20 Stadium Backdrops)')
      .setDescription(
        'Customize your `-profile` canvas header card with any of 20 generative stadium palettes:\n\n' +
        list +
        `\n\n${UI.DIVIDER}\n` +
        subtext('💡 Switch anytime: `-theme <alias>` (e.g. `-theme champions_gold` or `-theme emerald_pitch`).')
      )
      .setFooter({ text: 'Beyond The Final Whistle • Canvas Profile Studio' })
      .setTimestamp();

    return await message.reply({ embeds: [embed] });
  }

  const result = await setPlayerProfileTheme(message.author.id, themeArg);
  await message.reply(result.message);
}
