import { Message, EmbedBuilder, PermissionFlagsBits, AttachmentBuilder } from 'discord.js';
import { prisma } from '../database/prisma.js';
import { seedDailyAuctions, placeAuctionBid, formatTimeRemaining } from '../engines/auctionEngine.js';
import { renderAuctionHouseCanvas } from '../utils/themeRenderers.js';
import { sendThinkingMessage, updateLoadingMessage } from '../utils/loadingHelper.js';
import { formatK } from '../utils/formatHelper.js';
import { getEmoji } from '../utils/emojiHelper.js';
import { THEME_COLORS, UI, subtext } from '../utils/themeHelper.js';

const MASTER_ADMIN = '478599245276905495';

export async function handleAuctionHouseCommand(message: Message) {
  const thinkingMsg = await sendThinkingMessage(message, 'Opening Collector Auction House Vault...');

  try {
    let activeLots = await prisma.auctionListing.findMany({
      where: { status: 'ACTIVE', endsAt: { gt: new Date() } },
      orderBy: { endsAt: 'asc' }
    });

    if (activeLots.length === 0) {
      const seeded = await seedDailyAuctions(message.client, 2, true);
      activeLots = seeded.listings;
    }

    const caller = await prisma.player.findUnique({ where: { id: message.author.id }, select: { profileTheme: true } });
    const coinEmoji = getEmoji(message.guild, 'coin');
    const bidderIds = [...new Set(activeLots.map(l => l.highestBidderId).filter(Boolean) as string[])];
    const bidders = bidderIds.length > 0
      ? await prisma.player.findMany({ where: { id: { in: bidderIds } }, select: { id: true, username: true } })
      : [];
    const bidderNameMap = new Map(bidders.map(b => [b.id, b.username]));

    const lines = activeLots.map((lot, i) => {
      const leaderText = lot.highestBidderId
        ? `**${bidderNameMap.get(lot.highestBidderId) || `<@${lot.highestBidderId}>`}** (\`${formatK(lot.currentBid)}\` ${coinEmoji})`
        : `*No bids yet — Opens at \`${formatK(lot.startingPrice)}\` ${coinEmoji}*`;
      const minNext = lot.currentBid > 0n ? lot.currentBid + 50000n : lot.startingPrice;

      return `**[Lot #${i + 1}]** ${lot.emoji} **${lot.itemName}** • Standing: ${leaderText} • Min Next: \`${formatK(minNext)}\` ${coinEmoji} (\`${formatTimeRemaining(lot.endsAt)}\`)`;
    });

    const canvasLots = activeLots.map((lot, i) => ({
      lotNumber: i + 1,
      itemKey: lot.itemKey,
      itemName: lot.itemName,
      description: lot.description,
      leaderName: lot.highestBidderId ? bidderNameMap.get(lot.highestBidderId) || 'Collector' : null,
      currentOrStartBid: lot.currentBid > 0n ? lot.currentBid : lot.startingPrice,
      minNextBid: lot.currentBid > 0n ? lot.currentBid + 50000n : lot.startingPrice,
      timeRemaining: formatTimeRemaining(lot.endsAt)
    }));

    const vaultBuf = await renderAuctionHouseCanvas(canvasLots, caller?.profileTheme);
    const attachment = new AttachmentBuilder(vaultBuf, { name: 'auction_house.png' });

    const embed = new EmbedBuilder()
      .setColor(THEME_COLORS.GOLD)
      .setTitle('🏛️ Automated Daily Auction House — Collector Vault')
      .setDescription(
        (lines.length > 0 ? lines.join('\n') : '*No active lots right now.*') +
        `\n\n${UI.DIVIDER}\n` +
        subtext('💡 Travel to `-travel ah` and bid with `-bid <amount> [lot#]` (Anti-snipe extends +2m under 60s).')
      )
      .setImage('attachment://auction_house.png')
      .setFooter({ text: 'Beyond The Final Whistle • Collector Auction House' })
      .setTimestamp();

    await updateLoadingMessage(thinkingMsg, { embeds: [embed], files: [attachment] });
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
  const isAuth = message.author.id === MASTER_ADMIN || message.member?.permissions.has(PermissionFlagsBits.Administrator);
  if (!isAuth) {
    return await message.reply('❌ Unauthorized.');
  }

  const count = Math.min(3, Math.max(1, parseInt(args[0] || '2', 10) || 2));
  const res = await seedDailyAuctions(message.client, count, false);
  await message.reply(`✅ Seeded **${res.seeded} new collectible auction lot(s)**! View them via \`-ah\`.`);
}
