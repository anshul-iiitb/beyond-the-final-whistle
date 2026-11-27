import { Message, EmbedBuilder, AttachmentBuilder } from 'discord.js';
import path from 'path';
import { prisma } from '../database/prisma.js';
import {
  COSMETIC_CATALOG,
  PROFILE_THEMES,
  VEHICLE_CATALOG,
  getActiveMonthlyCosmetics,
  getCurrentMonthKey
} from '../config/constants.js';
import { acquireMonthlyCosmetic, equipOwnedCosmetic, setPlayerProfileTheme } from '../engines/cosmeticEngine.js';
import { resolveCosmeticAssetPath } from '../utils/themeRenderers.js';
import { formatK, getNationFlag } from '../utils/formatHelper.js';
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
    return await message.reply(
      '❌ Usage: `-equip <alias>`, `-equip avatar none`, `-equip banner none`, or `-equip none`.\nCheck owned items with `-inv`.'
    );
  }
  const result = await equipOwnedCosmetic(message.author.id, alias);
  await message.reply(result.message);
}

export async function handleInventoryCommand(message: Message, args: string[] = []) {
  const targetUser = message.mentions.users.first() || message.author;
  const player = await prisma.player.findUnique({
    where: { id: targetUser.id },
    include: { cosmetics: true, vehicles: true, inventory: true, nation: true }
  });

  if (!player) {
    return await message.reply(
      targetUser.id === message.author.id
        ? '❌ You have not registered yet. Run `-profile` first!'
        : '❌ That player has not registered on Beyond The Final Whistle yet.'
    );
  }

  const flag = getNationFlag(player.nation);
  const ownedAvatars = player.cosmetics.filter(c => c.kind === 'AVATAR');
  const ownedBanners = player.cosmetics.filter(c => c.kind === 'BANNER');
  const eqAvatarDef = COSMETIC_CATALOG.find(c => c.key === player.equippedAvatar);
  const eqBannerDef = COSMETIC_CATALOG.find(c => c.key === player.equippedBanner);
  const themeObj = PROFILE_THEMES.find(t => t.key === player.profileTheme) || PROFILE_THEMES[0];

  const formatCosmeticList = (items: typeof player.cosmetics, equippedKey: string | null) => {
    if (items.length === 0) return '*None owned yet (`-travel gm` ➔ `-avatar`)*';
    return items
      .map(c => {
        const def = COSMETIC_CATALOG.find(d => d.key === c.cosmeticKey);
        const tag = equippedKey === c.cosmeticKey ? ' ⭐ **Equipped**' : '';
        return `▸ ${def?.emoji || '🎭'} **${def?.name || c.name}** \`[ alias: ${c.cosmeticKey} ]\`${tag}`;
      })
      .join('\n');
  };

  const vehicleLines = player.vehicles.length > 0
    ? player.vehicles.map(v => {
        const def = VEHICLE_CATALOG.find(d => d.key === v.vehicleKey);
        return `▸ ${def?.emoji || '🚗'} **${v.name}** (\`${v.cooldownMinutes}m\` CD)`;
      }).join('\n')
    : '*None yet (`-showroom`)*';

  const relicLines = player.inventory.length > 0
    ? player.inventory.map(i => `▸ ${i.emoji} **${i.name}**`).join('\n')
    : '*None yet (`-gm` & `-ah`)*';

  const files: AttachmentBuilder[] = [];
  let thumbUrl = targetUser.displayAvatarURL();
  const customAvatarPath = resolveCosmeticAssetPath('AVATAR', player.equippedAvatar);
  if (customAvatarPath) {
    const fname = `inv_avatar${path.extname(customAvatarPath) || '.png'}`;
    files.push(new AttachmentBuilder(customAvatarPath, { name: fname }));
    thumbUrl = `attachment://${fname}`;
  }

  const embed = new EmbedBuilder()
    .setColor(THEME_COLORS.PURPLE)
    .setTitle(`🎒 ${player.username} ${flag}'s Locker & Inventory`)
    .setThumbnail(thumbUrl)
    .setDescription(
      `### ⭐ Currently Equipped\n` +
      `**Avatar :** ${eqAvatarDef ? `${eqAvatarDef.emoji} ${eqAvatarDef.name} (\`${eqAvatarDef.key}\`)` : 'Discord Default'}\n` +
      `**Banner :** ${eqBannerDef ? `${eqBannerDef.emoji} ${eqBannerDef.name} (\`${eqBannerDef.key}\`)` : 'Stadium Hero Card'}\n` +
      `**Theme :** 🎨 ${themeObj.name} (\`${themeObj.key}\`)\n\n` +
      `### 🖼️ Owned Avatars (${ownedAvatars.length})\n` +
      `${formatCosmeticList(ownedAvatars, player.equippedAvatar)}\n\n` +
      `### 🚩 Owned Banners (${ownedBanners.length})\n` +
      `${formatCosmeticList(ownedBanners, player.equippedBanner)}\n\n` +
      `### 🏎️ Owned Vehicles (${player.vehicles.length})\n` +
      `${vehicleLines}\n\n` +
      `### 🏆 Trophies, Relics & Gear (${player.inventory.length})\n` +
      `${relicLines}\n\n` +
      `${UI.DIVIDER}\n` +
      subtext('💡 Equip anytime: `-equip <alias>` • Clear: `-equip avatar none` / `-equip banner none`')
    )
    .setFooter({
      text: 'Beyond The Final Whistle • Player Inventory',
      iconURL: message.client.user?.displayAvatarURL() || undefined
    })
    .setTimestamp();

  await message.reply({ embeds: [embed], files });
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
