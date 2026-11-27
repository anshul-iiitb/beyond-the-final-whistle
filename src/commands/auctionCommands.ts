import { Message, EmbedBuilder, PermissionFlagsBits, AttachmentBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, Guild, Client } from 'discord.js';
import { prisma } from '../database/prisma.js';
import { AUCTION_RELIC_POOL } from '../config/constants.js';
import {
  getAuctionAutomationConfig,
  loadConfigCache,
  updateAuctionAutomationConfig,
} from '../services/configService.js';
import {
  seedDailyAuctions,
  placeAuctionBid,
  launchCustomAuctionLot,
  settleOrCancelAuctionLot,
  haltAuctionLots,
  resumeAuctionLots,
  getPausedLotsRemainingMap,
  formatTimeRemaining,
  formatDurationMs
} from '../engines/auctionEngine.js';
import { renderAuctionHouseCanvas } from '../utils/themeRenderers.js';
import { sendThinkingMessage, updateLoadingMessage } from '../utils/loadingHelper.js';
import { formatK, parseCoinAmount } from '../utils/formatHelper.js';
import { getEmoji } from '../utils/emojiHelper.js';
import { THEME_COLORS, UI, subtext } from '../utils/themeHelper.js';

const MASTER_ADMIN = '478599245276905495';

function isAhAdmin(message: Message): boolean {
  return message.author.id === MASTER_ADMIN || Boolean(message.member?.permissions.has(PermissionFlagsBits.Administrator));
}

export async function buildAuctionHousePayload(viewerId: string, client: Client, guild?: Guild | null) {
  await loadConfigCache();
  const ahCfg = getAuctionAutomationConfig();

  let activeLots = await prisma.auctionListing.findMany({
    where: { status: 'ACTIVE', endsAt: { gt: new Date() } },
    orderBy: { endsAt: 'asc' }
  });
  const pausedLots = await prisma.auctionListing.findMany({
    where: { status: 'PAUSED' },
    orderBy: { endsAt: 'asc' }
  });

  if (activeLots.length === 0 && pausedLots.length === 0 && ahCfg.autoEnabled) {
    const seeded = await seedDailyAuctions(client, ahCfg.lotsPerDrop, true, ahCfg.durationHours);
    activeLots = seeded.listings;
  }

  const pausedMsMap = await getPausedLotsRemainingMap(pausedLots.map(l => l.id));

  const caller = await prisma.player.findUnique({ where: { id: viewerId }, select: { profileTheme: true } });
  const coinEmoji = getEmoji(guild, 'coin');
  const bidderIds = [...new Set([...activeLots, ...pausedLots].map(l => l.highestBidderId).filter(Boolean) as string[])];
  const bidders = bidderIds.length > 0
    ? await prisma.player.findMany({ where: { id: { in: bidderIds } }, select: { id: true, username: true } })
    : [];
  const bidderNameMap = new Map(bidders.map(b => [b.id, b.username]));

  const lines = activeLots.map((lot, i) => {
    const leaderText = lot.highestBidderId
      ? `**${bidderNameMap.get(lot.highestBidderId) || `<@${lot.highestBidderId}>`}** (\`${formatK(lot.currentBid)}\` ${coinEmoji})`
      : `*Opens at \`${formatK(lot.startingPrice)}\` ${coinEmoji}*`;
    const minNext = lot.currentBid > 0n ? lot.currentBid + ahCfg.minBidIncrement : lot.startingPrice;

    return `**[Lot #${i + 1}]** ${lot.emoji} **${lot.itemName}**\n` +
      `• **Standing:** ${leaderText}\n` +
      `• **Min Next Bid:** \`${formatK(minNext)}\` ${coinEmoji} (\`${formatTimeRemaining(lot.endsAt)}\`)`;
  });

  const pausedLines = pausedLots.map((lot, i) => {
    const frozenMs = pausedMsMap.get(lot.id) ?? 0;
    const leaderText = lot.highestBidderId
      ? `**${bidderNameMap.get(lot.highestBidderId) || `<@${lot.highestBidderId}>`}** (\`${formatK(lot.currentBid)}\` ${coinEmoji})`
      : `*Opens at \`${formatK(lot.startingPrice)}\` ${coinEmoji}*`;
    return `⏸️ **[Halted #${i + 1}]** ${lot.emoji} **${lot.itemName}**\n` +
      `• **Standing:** ${leaderText} • **Frozen Time Left:** \`${frozenMs > 0 ? formatDurationMs(frozenMs) : 'Paused'}\``;
  });

  const canvasSourceLots = activeLots.length > 0 ? activeLots : pausedLots;
  const canvasLots = canvasSourceLots.map((lot, i) => {
    const timeRemaining = lot.status === 'PAUSED'
      ? `PAUSED (${formatDurationMs(pausedMsMap.get(lot.id) ?? 0)})`
      : formatTimeRemaining(lot.endsAt);
    return {
      lotNumber: i + 1,
      itemKey: lot.itemKey,
      itemName: lot.itemName,
      description: lot.description,
      leaderName: lot.highestBidderId ? bidderNameMap.get(lot.highestBidderId) || 'Collector' : null,
      currentOrStartBid: lot.currentBid > 0n ? lot.currentBid : lot.startingPrice,
      minNextBid: lot.currentBid > 0n ? lot.currentBid + ahCfg.minBidIncrement : lot.startingPrice,
      timeRemaining
    };
  });

  const vaultBuf = await renderAuctionHouseCanvas(canvasLots, caller?.profileTheme);
  const attachment = new AttachmentBuilder(vaultBuf, { name: 'auction_house.png' });

  const bodyBlocks: string[] = [];
  if (lines.length > 0) bodyBlocks.push(lines.join('\n\n'));
  if (pausedLines.length > 0) {
    bodyBlocks.push(`### ⏸️ Halted Auction Lots *(Admin \`-auctionresume\` to continue)*\n${pausedLines.join('\n\n')}`);
  }
  if (bodyBlocks.length === 0) {
    bodyBlocks.push('*No active lots right now. Admins can launch via `-seedauction` or `-auctionstart`.*');
  }

  const embed = new EmbedBuilder()
    .setColor(THEME_COLORS.GOLD)
    .setTitle('🏛️ Automated Daily Auction House — Collector Vault')
    .setDescription(
      [
        ...bodyBlocks,
        `${UI.DIVIDER}\n` +
        subtext(`💡 At \`-travel ah\`: \`-bid <amount> [lot#]\` • Min Increment: \`+${formatK(ahCfg.minBidIncrement)}\` • Anti-Snipe: \`+${ahCfg.antiSnipeMinutes}m\``)
      ].join(UI.SPACER)
    )
    .setImage('attachment://auction_house.png')
    .setFooter({ text: `Auto Drops: ${ahCfg.autoEnabled ? 'ON' : 'OFF'} (${ahCfg.lotsPerDrop} lots / ${ahCfg.durationHours}h) • Beyond The Final Whistle` })
    .setTimestamp();

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('ah_refresh')
      .setLabel('Refresh Live Bids')
      .setEmoji('🔄')
      .setStyle(ButtonStyle.Secondary)
  );

  return { embed, files: [attachment], components: [row] };
}

export async function handleAuctionHouseCommand(message: Message) {
  const thinkingMsg = await sendThinkingMessage(message, 'Opening Collector Auction House Vault...');

  try {
    const payload = await buildAuctionHousePayload(message.author.id, message.client, message.guild);
    await updateLoadingMessage(thinkingMsg, {
      embeds: [payload.embed],
      files: payload.files,
      components: payload.components
    });
  } catch {
    await updateLoadingMessage(thinkingMsg, {
      content: '❌ Failed to load the Auction House vault.',
      embeds: [],
      files: []
    });
  }
}

export async function handleBidCommand(message: Message, args: string[]) {
  const rawAmount = args[0];
  if (!rawAmount) {
    return await message.reply('❌ Usage: `-bid <amount> [lot#]` (e.g. `-bid 1.5m` or `-bid 800k 2`). Check active lots with `-ah`!');
  }

  const lotArg = args[1] ? parseInt(args[1], 10) : 1;
  const lotNumber = isNaN(lotArg) || lotArg < 1 ? 1 : lotArg;

  try {
    const result = await placeAuctionBid(message.author.id, rawAmount, lotNumber, message.client);
    await message.reply(result.message);
  } catch (err: any) {
    await message.reply(`❌ Bid rejected: ${err.message}`);
  }
}

export async function handleSeedAuctionCommand(message: Message, args: string[]) {
  if (!isAhAdmin(message)) {
    return await message.reply('❌ Unauthorized.');
  }

  const count = Math.min(4, Math.max(1, parseInt(args[0] || '2', 10) || 2));
  const hours = args[1] ? Math.max(0.1, Math.min(168, parseFloat(args[1]) || 22)) : undefined;
  const res = await seedDailyAuctions(message.client, count, false, hours);
  await message.reply(`✅ Seeded **${res.seeded} new collectible auction lot(s)**${hours ? ` (${hours}h)` : ''}! View them via \`-ah\`.`);
}

export async function handleAuctionStartCommand(message: Message, args: string[]) {
  if (!isAhAdmin(message)) {
    return await message.reply('❌ Unauthorized.');
  }

  if (args.length < 2) {
    const poolKeys = AUCTION_RELIC_POOL.map(r => `\`${r.itemKey}\``).join(', ');
    return await message.reply(
      '❌ **Usage:** `-auctionstart <relicAlias_or_Name> <startBid> [hours=22] [emoji]`\n' +
      `Examples:\n• \`-auctionstart worldcup_replica 2.5m 12\`\n• \`-auctionstart "Signed Legend Boots" 1m 6 👟\`\n` +
      `**Relic Keys:** ${poolKeys}`
    );
  }

  const joined = args.join(' ');
  const quotedMatch = joined.match(/^"([^"]+)"\s+(.+)$/);
  let rawItem: string;
  let restArgs: string[];
  if (quotedMatch) {
    rawItem = quotedMatch[1];
    restArgs = quotedMatch[2].trim().split(/\s+/);
  } else {
    rawItem = args[0];
    restArgs = args.slice(1);
  }

  const startPrice = parseCoinAmount(restArgs[0] || '');
  if (!startPrice || startPrice <= 0n) {
    return await message.reply('❌ Invalid starting price (e.g. `500k`, `2.5m`).');
  }

  const hours = restArgs[1] ? parseFloat(restArgs[1]) : 22;
  if (isNaN(hours) || hours < 0.05 || hours > 168) {
    return await message.reply('❌ Duration must be between `0.05` and `168` hours.');
  }

  const matchedRelic = AUCTION_RELIC_POOL.find(
    r => r.itemKey.toLowerCase() === rawItem.toLowerCase() || r.itemName.toLowerCase() === rawItem.toLowerCase()
  );

  const emoji = restArgs[2] || matchedRelic?.emoji || '🏆';
  const itemKey = matchedRelic?.itemKey || rawItem.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || 'custom_relic';
  const itemName = matchedRelic?.itemName || rawItem;
  const description = matchedRelic?.description || 'Limited custom Collector Vault edition launched by BTFW Admin.';

  const lot = await launchCustomAuctionLot({
    itemKey,
    itemName,
    emoji,
    description,
    startingPrice: startPrice,
    durationHours: hours,
    client: message.client
  });

  await message.reply(
    `✅ Launched custom auction lot: ${lot.emoji} **${lot.itemName}**\n` +
    `• **Opening Bid:** \`${formatK(lot.startingPrice)} coins\`   •   **Duration:** \`${hours}h\`\n` +
    `Live now in \`-ah\` & #auction-house!`
  );
}

export async function handleAuctionConfigCommand(message: Message, args: string[]) {
  if (!isAhAdmin(message)) {
    return await message.reply('❌ Unauthorized.');
  }

  await loadConfigCache();
  const setting = (args[0] || '').toLowerCase();
  const val = args[1] || '';

  if (!setting) {
    const cfg = getAuctionAutomationConfig();
    return await message.reply(
      `🏛️ **Automated Auction System Config**\n` +
      `• **Auto Drops:** ${cfg.autoEnabled ? '✅ ON' : '⏸️ OFF'}\n` +
      `• **Lots Per Drop:** \`${cfg.lotsPerDrop}\`\n` +
      `• **Duration:** \`${cfg.durationHours}h\`\n` +
      `• **Min Bid Increment:** \`${formatK(cfg.minBidIncrement)} coins\`\n` +
      `• **Anti-Snipe Extension:** \`+${cfg.antiSnipeMinutes}m\`\n\n` +
      `💡 **Edit:** \`-auctionconfig auto on|off\`, \`-auctionconfig lots 3\`, \`-auctionconfig hours 12\`, \`-auctionconfig inc 100k\`, \`-auctionconfig snipe 2\``
    );
  }

  if (setting === 'auto') {
    const enabled = ['on', 'true', 'yes', '1', 'enable'].includes(val.toLowerCase());
    const disabled = ['off', 'false', 'no', '0', 'disable'].includes(val.toLowerCase());
    if (!enabled && !disabled) {
      return await message.reply('❌ Use `-auctionconfig auto on` or `-auctionconfig auto off`.');
    }
    const next = await updateAuctionAutomationConfig({ autoEnabled: enabled });
    return await message.reply(`✅ Automated Auction Drops set to **${next.autoEnabled ? 'ON' : 'OFF'}**.`);
  }

  if (setting === 'lots') {
    const n = parseInt(val, 10);
    if (isNaN(n) || n < 1 || n > 4) return await message.reply('❌ Lots per drop must be `1–4`.');
    const next = await updateAuctionAutomationConfig({ lotsPerDrop: n });
    return await message.reply(`✅ Automated drops will now seed **${next.lotsPerDrop} lot(s)** per cycle.`);
  }

  if (setting === 'hours') {
    const h = parseInt(val, 10);
    if (isNaN(h) || h < 1 || h > 72) return await message.reply('❌ Auction duration must be `1–72` hours.');
    const next = await updateAuctionAutomationConfig({ durationHours: h });
    return await message.reply(`✅ Automated auction duration set to **${next.durationHours}h**.`);
  }

  if (setting === 'inc' || setting === 'increment') {
    const inc = parseCoinAmount(val);
    if (!inc || inc <= 0n) return await message.reply('❌ Invalid increment amount (e.g. `50k`, `100k`, `250k`).');
    const next = await updateAuctionAutomationConfig({ minBidIncrement: inc });
    return await message.reply(`✅ Minimum bid increment set to **${formatK(next.minBidIncrement)} coins**.`);
  }

  if (setting === 'snipe' || setting === 'antisnipe') {
    const mins = parseInt(val, 10);
    if (isNaN(mins) || mins < 0 || mins > 15) return await message.reply('❌ Anti-snipe extension must be `0–15` minutes.');
    const next = await updateAuctionAutomationConfig({ antiSnipeMinutes: mins });
    return await message.reply(`✅ Anti-snipe extension set to **+${next.antiSnipeMinutes}m**.`);
  }

  return await message.reply('❌ Unknown setting. Options: `auto`, `lots`, `hours`, `inc`, `snipe`.');
}

export async function handleAuctionEndCommand(message: Message, args: string[]) {
  if (!isAhAdmin(message)) return await message.reply('❌ Unauthorized.');
  const lotNum = parseInt(args[0] || '1', 10);
  if (isNaN(lotNum) || lotNum < 1) return await message.reply('❌ Usage: `-auctionend <lot#>`');
  try {
    const res = await settleOrCancelAuctionLot(lotNum, 'end', message.client);
    await message.reply(res.message);
  } catch (err: any) {
    await message.reply(`❌ Failed: ${err.message}`);
  }
}

export async function handleAuctionCancelCommand(message: Message, args: string[]) {
  if (!isAhAdmin(message)) return await message.reply('❌ Unauthorized.');
  const lotNum = parseInt(args[0] || '1', 10);
  if (isNaN(lotNum) || lotNum < 1) return await message.reply('❌ Usage: `-auctioncancel <lot#>`');
  try {
    const res = await settleOrCancelAuctionLot(lotNum, 'cancel', message.client);
    await message.reply(res.message);
  } catch (err: any) {
    await message.reply(`❌ Failed: ${err.message}`);
  }
}

export async function handleAuctionHaltCommand(message: Message, args: string[]) {
  if (!isAhAdmin(message)) return await message.reply('❌ Unauthorized.');
  try {
    const res = await haltAuctionLots(args[0], message.client);
    await message.reply(res.message);
  } catch (err: any) {
    await message.reply(`❌ Failed: ${err.message}`);
  }
}

export async function handleAuctionResumeCommand(message: Message, args: string[]) {
  if (!isAhAdmin(message)) return await message.reply('❌ Unauthorized.');
  try {
    const res = await resumeAuctionLots(args[0], message.client);
    await message.reply(res.message);
  } catch (err: any) {
    await message.reply(`❌ Failed: ${err.message}`);
  }
}
