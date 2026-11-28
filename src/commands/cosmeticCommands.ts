import { Message, EmbedBuilder, AttachmentBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, Guild } from 'discord.js';
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
import { getEffectivePrice, loadConfigCache } from '../services/configService.js';
import { resolveCosmeticAssetPath, renderCosmeticShopCanvas, CosmeticShopCardItem } from '../utils/themeRenderers.js';
import { sendThinkingMessage, updateLoadingMessage } from '../utils/loadingHelper.js';
import { formatK, getNationFlag } from '../utils/formatHelper.js';
import { getEmoji } from '../utils/emojiHelper.js';
import { THEME_COLORS, UI, subtext } from '../utils/themeHelper.js';

export function buildCosmeticShopPageRow(activePage: number) {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('avatar_page_1')
      .setLabel('Custom Avatars (5)')
      .setEmoji('👤')
      .setStyle(activePage === 1 ? ButtonStyle.Primary : ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('avatar_page_2')
      .setLabel('Legend Banners (5)')
      .setEmoji('🖼️')
      .setStyle(activePage === 2 ? ButtonStyle.Primary : ButtonStyle.Secondary)
  );
}

export async function buildCosmeticShopPayload(userId: string, page = 1, guild?: Guild | null) {
  await loadConfigCache();
  const safePage = page === 2 ? 2 : 1;
  const player = await prisma.player.findUnique({
    where: { id: userId },
    include: { cosmetics: true }
  });

  const ownedKeys = new Set((player?.cosmetics || []).map(c => c.cosmeticKey));
  const monthKey = getCurrentMonthKey();
  const activeCatalog = getActiveMonthlyCosmetics();
  const coinEmoji = getEmoji(guild, 'coin');
  const isVip = (player?.vipTier ?? 0) >= 1;
  const isReferralVip = Boolean(player?.referralVipOnly);
  const vipPassShort = !isVip
    ? 'VIP Only (1 Free/mo)'
    : isReferralVip
      ? 'Referral VIP (Pass Only)'
      : player?.lastVipCosmeticMonth === monthKey
        ? 'VIP Claim Used'
        : '1 Free VIP Claim Ready';
  const vipPassLine = !isVip
    ? '🔒 VIP Only (1 Free/month)'
    : isReferralVip
      ? 'ℹ️ **Referral VIP Active** *(Free monthly claims reserved for full VIP)*'
      : player?.lastVipCosmeticMonth === monthKey
        ? '✅ Claimed this month'
        : '🎁 **1 Free Claim Ready!** (`-avatarclaim <alias>`)';

  const targetKind = safePage === 1 ? 'AVATAR' : 'BANNER';
  const pageItems = activeCatalog.filter(c => c.kind === targetKind);
  const eqAvatarDef = COSMETIC_CATALOG.find(c => c.key === player?.equippedAvatar);
  const eqBannerDef = COSMETIC_CATALOG.find(c => c.key === player?.equippedBanner);

  const canvasItems: CosmeticShopCardItem[] = pageItems.map(c => ({
    key: c.key,
    name: c.name,
    kind: c.kind,
    jerseyNumber: c.jerseyNumber,
    price: getEffectivePrice(c.key, c.cost),
    accentHex: c.accentHex,
    owned: ownedKeys.has(c.key),
    equipped: player?.equippedAvatar === c.key || player?.equippedBanner === c.key
  }));

  const pageTitle = safePage === 1
    ? 'Custom Profile Avatars — 5 Collector Icons'
    : 'Legend Profile Banners — 5 Collector Posters';

  const canvasBuf = await renderCosmeticShopCanvas({
    pageTitle,
    page: safePage,
    totalPages: 2,
    vipStatusText: vipPassShort,
    walletCoins: player?.coins ?? 0n,
    equippedSummary: `Avatar: ${eqAvatarDef?.key || 'Default'} | Banner: ${eqBannerDef?.key || 'None'}`,
    items: canvasItems,
    themeKey: player?.profileTheme
  });
  const file = new AttachmentBuilder(canvasBuf, { name: 'cosmetic_boutique.png' });

  const quickAliases = pageItems
    .map(c => {
      const owned = ownedKeys.has(c.key);
      const eq = player?.equippedAvatar === c.key || player?.equippedBanner === c.key;
      const badge = eq ? '⭐' : owned ? '✅' : `${formatK(getEffectivePrice(c.key, c.cost))} ${coinEmoji}`;
      return `${c.emoji} \`${c.key}\` (${badge})`;
    })
    .join('\n');

  const botIcon = guild?.client?.user?.displayAvatarURL?.() || undefined;
  const embed = new EmbedBuilder()
    .setColor(THEME_COLORS.PURPLE)
    .setTitle(`🎨 Cosmetic Boutique — ${safePage === 1 ? 'Custom Avatars (5)' : 'Legend Banners (5)'}`)
    .setDescription(
      [
        `👑 **VIP Pass:** ${vipPassLine}\n💰 **Wallet:** \`${formatK(player?.coins ?? 0n)}\` ${coinEmoji}`,
        `**Items on Page ${safePage}:**\n${quickAliases}`,
        subtext('💡 At `-travel gm`: `-avatarbuy <alias>` or `-avatarclaim <alias>` • Equip: `-equip avatar <name>` / `-equip <alias>`')
      ].join(UI.SPACER)
    )
    .setImage('attachment://cosmetic_boutique.png')
    .setFooter({ text: `Page ${safePage}/2 • Cosmetic Boutique (${monthKey}) • Beyond The Final Whistle`, iconURL: botIcon })
    .setTimestamp();

  return {
    embed,
    files: [file],
    components: [buildCosmeticShopPageRow(safePage)]
  };
}

export async function handleAvatarCommand(message: Message, args: string[] = []) {
  const argLower = (args[0] || '').toLowerCase();
  const page = argLower === '2' || argLower.startsWith('banner') ? 2 : 1;
  const thinkingMsg = await sendThinkingMessage(message, 'Opening Global Market Cosmetic Boutique...');

  try {
    const payload = await buildCosmeticShopPayload(message.author.id, page, message.guild);
    await updateLoadingMessage(thinkingMsg, {
      embeds: [payload.embed],
      files: payload.files,
      components: payload.components
    });
  } catch {
    await updateLoadingMessage(thinkingMsg, {
      content: '❌ Failed to load the Cosmetic Boutique.',
      embeds: [],
      files: []
    });
  }
}

export async function handleAvatarBuyCommand(message: Message, args: string[]) {
  const alias = args.join(' ').trim();
  if (!alias) {
    return await message.reply('❌ Usage: `-avatarbuy <alias>` (e.g. `-avatarbuy zidane` or `-avatarbuy messi`). Browse with `-avatar`.');
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
      '❌ Usage: `-equip avatar <name>`, `-equip banner <name>`, `-equip <alias>`, `-equip avatar none`, `-equip banner none`, or `-equip none`.\nCheck owned items with `-inv`.'
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

  const invSections = [
    `### ⭐ Currently Equipped\n` +
    `**Avatar :** ${eqAvatarDef ? `${eqAvatarDef.emoji} ${eqAvatarDef.name} (\`${eqAvatarDef.key}\`)` : 'Discord Default'}\n` +
    `**Banner :** ${eqBannerDef ? `${eqBannerDef.emoji} ${eqBannerDef.name} (\`${eqBannerDef.key}\`)` : 'None Equipped'}\n` +
    `**Theme :** 🎨 ${themeObj.name} (\`${themeObj.key}\`)`,
    `### 🖼️ Owned Avatars (${ownedAvatars.length})\n` +
    `${formatCosmeticList(ownedAvatars, player.equippedAvatar)}`,
    `### 🚩 Owned Banners (${ownedBanners.length})\n` +
    `${formatCosmeticList(ownedBanners, player.equippedBanner)}`,
    `### 🏎️ Owned Vehicles (${player.vehicles.length})\n` +
    `${vehicleLines}`,
    `### 🏆 Trophies, Relics & Gear (${player.inventory.length})\n` +
    `${relicLines}`,
    `${UI.DIVIDER}\n` +
    subtext('💡 Equip anytime: `-equip avatar <name>` or `-equip <alias>` • Clear: `-equip avatar none` / `-equip banner none`')
  ];

  const embed = new EmbedBuilder()
    .setColor(THEME_COLORS.PURPLE)
    .setTitle(`🎒 ${player.username} ${flag}'s Locker & Inventory`)
    .setThumbnail(thumbUrl)
    .setDescription(invSections.join(UI.SPACER))
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
        [
          'Customize your `-profile` telemetry & biomechanics cards with any of 20 generative stadium palettes:',
          list,
          `${UI.DIVIDER}\n` + subtext('💡 Switch anytime: `-theme <alias>` (e.g. `-theme champions_gold` or `-theme emerald_pitch`).')
        ].join(UI.SPACER)
      )
      .setFooter({ text: 'Beyond The Final Whistle • Canvas Profile Studio' })
      .setTimestamp();

    return await message.reply({ embeds: [embed] });
  }

  const result = await setPlayerProfileTheme(message.author.id, themeArg);
  await message.reply(result.message);
}
