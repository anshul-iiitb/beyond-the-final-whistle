import { Message, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, AttachmentBuilder, Guild } from 'discord.js';
import { prisma } from '../database/prisma.js';
import { CAMPUS_LOCATIONS, VEHICLE_CATALOG, resolveVehicleSprite } from '../config/constants.js';
import { travelToLocation, getPlayerTravelCooldown } from '../engines/campusEngine.js';
import { buyVehicle } from '../engines/marketEngine.js';
import { renderShowroomCanvas, ShowroomCardItem } from '../utils/themeRenderers.js';
import { sendThinkingMessage, updateLoadingMessage } from '../utils/loadingHelper.js';
import { formatK } from '../utils/formatHelper.js';
import { getEmoji } from '../utils/emojiHelper.js';
import { THEME_COLORS, UI, subtext } from '../utils/themeHelper.js';

export async function handleLocationsCommand(message: Message) {
  const lines = Object.values(CAMPUS_LOCATIONS).map(loc => {
    return `${loc.emoji} **${loc.name.toUpperCase()}** \`[-travel ${loc.alias}]\`\n` +
      `> *${loc.description}*\n` +
      `• **Activities:** ${loc.activities.join(' • ')}`;
  });

  const embed = new EmbedBuilder()
    .setColor(THEME_COLORS.PRIMARY)
    .setTitle('🏟️ Football Campus Directory & Spatial Facilities')
    .setDescription(
      `Fast-travel between campus facilities to train, recover, trade, and sign sponsor contracts.\n\n` +
      lines.join('\n\n') +
      `\n\n${UI.DIVIDER}\n` +
      subtext('💡 Travel syntax: `-travel <alias>` (e.g. `-travel ch` for Player Clubhouse, `-travel gm` for Global Market & Showroom).')
    )
    .setFooter({ text: 'Beyond The Final Whistle • Football Campus' })
    .setTimestamp();

  await message.reply({ embeds: [embed] });
}

export async function handleTravelCommand(message: Message, args: string[]) {
  const targetAlias = args[0]?.toLowerCase();
  if (!targetAlias) {
    const valid = Object.keys(CAMPUS_LOCATIONS).map(k => `\`${k}\` (${CAMPUS_LOCATIONS[k].name})`).join(', ');
    return await message.reply(`❌ Please specify a destination. Example: \`-travel tc\` (Training Center).\n**Destinations:** ${valid}`);
  }

  if (!message.guild || !message.member) {
    return await message.reply('❌ Travel can only be executed inside a Discord server channel.');
  }

  const result = await travelToLocation(message.member, message.guild, targetAlias);
  if (result.embed) {
    await message.reply({ embeds: [result.embed] });
  } else {
    await message.reply(result.message);
  }
}

const SHOWROOM_PAGE_RANGES: Array<[number, number]> = [
  [0, 5],   // Page 1: 5 Entry & Sports (1-5)
  [5, 11],  // Page 2: 6 Track & Muscle (6-11)
  [11, 16]  // Page 3: 5 Luxury & Hypercars (12-16)
];

export function buildShowroomPageRow(activePage: number) {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('showroom_page_1')
      .setLabel('Entry & Sports (1–5)')
      .setEmoji('🚗')
      .setStyle(activePage === 1 ? ButtonStyle.Primary : ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('showroom_page_2')
      .setLabel('Track & Muscle (6–11)')
      .setEmoji('🏎️')
      .setStyle(activePage === 2 ? ButtonStyle.Primary : ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('showroom_page_3')
      .setLabel('Luxury & Hypercars (12–16)')
      .setEmoji('🚀')
      .setStyle(activePage === 3 ? ButtonStyle.Primary : ButtonStyle.Secondary)
  );
}

export async function buildShowroomPayload(userId: string, page = 1, guild?: Guild | null) {
  const safePage = Math.max(1, Math.min(3, page));
  const { cooldownMinutes, vehicleName } = await getPlayerTravelCooldown(userId);
  const player = await prisma.player.findUnique({
    where: { id: userId },
    include: { vehicles: true }
  });

  const ownedKeys = new Set((player?.vehicles || []).map(v => v.vehicleKey));
  const pageTitles = [
    'Tier 1: Entry Roadsters & Sports Coupes',
    'Tier 2: Track Weapons & American Muscle',
    'Tier 3: Ultra-Luxury & Pinnacle Hypercars'
  ];

  const [startIdx, endIdx] = SHOWROOM_PAGE_RANGES[safePage - 1] || SHOWROOM_PAGE_RANGES[0];
  const pageVehicles = VEHICLE_CATALOG.slice(startIdx, endIdx);
  const coinEmoji = getEmoji(guild, 'coin');

  const canvasItems: ShowroomCardItem[] = pageVehicles.map(v => {
    const { spriteMode, spritePrefix } = resolveVehicleSprite(v.key, v.emoji);
    return {
      key: v.key,
      name: v.name,
      cooldownMinutes: v.cooldownMinutes,
      price: v.cost,
      owned: ownedKeys.has(v.key),
      spriteMode,
      spritePrefix
    };
  });

  const canvasBuf = await renderShowroomCanvas({
    pageTitle: pageTitles[safePage - 1],
    page: safePage,
    totalPages: 3,
    currentRide: vehicleName,
    currentCooldown: cooldownMinutes,
    walletCoins: player?.coins ?? 0n,
    items: canvasItems,
    themeKey: player?.profileTheme
  });
  const file = new AttachmentBuilder(canvasBuf, { name: 'showroom_catalog.png' });

  const quickAliases = pageVehicles
    .map(v => {
      const f = getEmoji(guild, `${v.key}front`);
      const b = getEmoji(guild, `${v.key}back`);
      const sprite = f.includes('<:') && b.includes('<:') ? `${f}${b}` : v.emoji;
      return `${sprite} \`${v.key}\` (${formatK(v.cost)} ${coinEmoji})`;
    })
    .join(' • ');

  const botIcon = guild?.client?.user?.displayAvatarURL?.() || undefined;
  const embed = new EmbedBuilder()
    .setColor(THEME_COLORS.SCARLET)
    .setTitle(`🏎️ Global Market Dealership — ${pageTitles[safePage - 1]}`)
    .setDescription(
      `🚗 **Current Ride:** \`${vehicleName}\` (\`${cooldownMinutes}m\` travel cooldown)\n` +
      `**Aliases on Page ${safePage}:** ${quickAliases}\n` +
      subtext('💡 Must be at Global Market (`-travel gm`). Purchase with `-vehiclebuy <alias>`.')
    )
    .setImage('attachment://showroom_catalog.png')
    .setFooter({ text: `Page ${safePage}/3 • Current Ride: ${vehicleName} • Beyond The Final Whistle`, iconURL: botIcon })
    .setTimestamp();

  return {
    embed,
    files: [file],
    components: [buildShowroomPageRow(safePage)]
  };
}

export async function handleShowroomCommand(message: Message, args: string[] = []) {
  const pageArg = parseInt(args[0] || '1', 10);
  const page = isNaN(pageArg) ? 1 : Math.max(1, Math.min(3, pageArg));
  const thinkingMsg = await sendThinkingMessage(message, 'Opening Global Market Luxury Showroom...');

  try {
    const payload = await buildShowroomPayload(message.author.id, page, message.guild);
    await updateLoadingMessage(thinkingMsg, {
      embeds: [payload.embed],
      files: payload.files,
      components: payload.components
    });
  } catch {
    await updateLoadingMessage(thinkingMsg, {
      content: '❌ Failed to load the vehicle showroom.',
      embeds: [],
      files: []
    });
  }
}

export async function handleVehicleBuyCommand(message: Message, args: string[]) {
  const alias = args[0]?.toLowerCase();
  if (!alias) {
    return await message.reply('❌ Usage: `-vehiclebuy <alias>`. Check available models with `-showroom`!');
  }

  const result = await buyVehicle(message.author.id, alias);
  await message.reply(result.message);
}
