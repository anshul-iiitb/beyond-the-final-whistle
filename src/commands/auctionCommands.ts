import { Message, EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import { prisma } from '../database/prisma.js';
import { seedDailyAuctions, placeAuctionBid, formatTimeRemaining } from '../engines/auctionEngine.js';
import { formatK } from '../utils/formatHelper.js';
import { getEmoji } from '../utils/emojiHelper.js';
import { THEME_COLORS, UI, subtext } from '../utils/themeHelper.js';

const MASTER_ADMIN = '478599245276905495';

export async function handleAuctionHouseCommand(message: Message) {
  let activeLots = await prisma.auctionListing.findMany({
    where: { status: 'ACTIVE', endsAt: { gt: new Date() } },
    orderBy: { endsAt: 'asc' }
  });

  if (activeLots.length === 0) {
    const seeded = await seedDailyAuctions(message.client, 2, true);
    activeLots = seeded.listings;
  }

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

    return `**[Lot #${i + 1}]** ${lot.emoji} **${lot.itemName.toUpperCase()}**\n` +
      `> *${lot.description}*\n` +
      `• **Current Standing:** ${leaderText}\n` +
      `• **Min Next Bid:** \`${formatK(minNext)}\` ${coinEmoji} • **Closes In:** \`${formatTimeRemaining(lot.endsAt)}\` ⏳`;
  });

  const embed = new EmbedBuilder()
    .setColor(THEME_COLORS.GOLD)
    .setTitle('🏛️ Automated Daily Auction House — Collector Vault')
    .setDescription(
      `Public escrowed bidding on daily rare trophies and legacy relics! *(Anti-snipe adds +2m under 60s remaining)*\n\n` +
      (lines.length > 0 ? lines.join('\n\n') : '*No active lots right now.*') +
      `\n\n${UI.DIVIDER}\n` +
      subtext('💡 Travel to the hall (`-travel ah`) and place bids via `-bid <amount> [lot#]` (e.g. `-bid 1.5m 1`).')
    )
    .setFooter({ text: 'Beyond The Final Whistle • Collector Auction House' })
    .setTimestamp();

  await message.reply({ embeds: [embed] });
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
