import { Client, EmbedBuilder, TextChannel } from 'discord.js';
import { prisma } from '../database/prisma.js';
import { AUCTION_RELIC_POOL } from '../config/constants.js';
import { getAuctionAutomationConfig, getEffectivePrice, loadConfigCache } from '../services/configService.js';
import { formatK, parseCoinAmount } from '../utils/formatHelper.js';
import { logger } from '../utils/logger.js';

const ANTI_SNIPE_WINDOW_MS = 60 * 1000;

export function formatTimeRemaining(endsAt: Date): string {
  const diffMs = endsAt.getTime() - Date.now();
  if (diffMs <= 0) return 'Ended';
  const totalSec = Math.floor(diffMs / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

async function announceAuctionDrop(client: Client, listings: any[], headline = '🏛️ DAILY AUCTION HOUSE DROPS ARE LIVE!') {
  if (!client || listings.length === 0) return;
  const ahCfg = getAuctionAutomationConfig();

  for (const guild of client.guilds.cache.values()) {
    const ahChannel = guild.channels.cache.find(
      c => c.isTextBased() && c.name.toLowerCase().includes('auction-house')
    ) as TextChannel | undefined;
    if (!ahChannel) continue;

    const lotLines = listings.map((l, idx) =>
      `**[Lot #${idx + 1}]** ${l.emoji} **${l.itemName}**\n` +
      `> *${l.description}*\n` +
      `• **Opening Bid:** \`${formatK(l.startingPrice)} coins\` • **Closes In:** \`${formatTimeRemaining(l.endsAt)}\``
    ).join('\n\n');

    const embed = new EmbedBuilder()
      .setColor('#f59e0b')
      .setTitle(headline)
      .setDescription(
        `The BTFW Collector Vault has released rare relics for public bidding!\n\n${lotLines}\n\n` +
        `💡 **How to Bid:** Travel here (\`-travel ah\`) and run \`-bid <amount> [lot#]\` (e.g. \`-bid 2.5m 1\`).`
      )
      .setFooter({ text: `Anti-Snipe Active: Bids under 60s remaining extend closing by +${ahCfg.antiSnipeMinutes}m!` })
      .setTimestamp();

    const sent = await ahChannel.send({ embeds: [embed] }).catch(() => null);
    if (sent) {
      for (const l of listings) {
        await prisma.auctionListing.update({
          where: { id: l.id },
          data: { channelId: ahChannel.id, discordMessageId: sent.id }
        }).catch(() => {});
      }
    }
  }
}

/**
 * Seeds 1-4 rare collectibles into AuctionListing if needed (or forced by admin).
 */
export async function seedDailyAuctions(
  client?: Client,
  countOverride?: number,
  onlyIfNoneToday = true,
  durationHoursOverride?: number
): Promise<{ seeded: number; listings: any[] }> {
  await loadConfigCache();
  const ahCfg = getAuctionAutomationConfig();
  const count = countOverride ?? ahCfg.lotsPerDrop;
  const durationHours = durationHoursOverride ?? ahCfg.durationHours;

  const activeListings = await prisma.auctionListing.findMany({
    where: { status: 'ACTIVE' }
  });

  if (onlyIfNoneToday && activeListings.length > 0) {
    return { seeded: 0, listings: activeListings };
  }

  const activeKeys = new Set(activeListings.map(a => a.itemKey));
  const candidates = AUCTION_RELIC_POOL.filter(r => !activeKeys.has(r.itemKey));
  const pool = candidates.length >= count ? candidates : [...AUCTION_RELIC_POOL];

  const shuffled = [...pool].sort(() => Math.random() - 0.5).slice(0, count);
  const endsAt = new Date(Date.now() + Math.max(0.05, durationHours) * 60 * 60 * 1000);

  const createdListings = [];
  for (const relic of shuffled) {
    const startPrice = getEffectivePrice(relic.itemKey, relic.startingPrice);
    const listing = await prisma.auctionListing.create({
      data: {
        itemKey: relic.itemKey,
        itemName: relic.itemName,
        emoji: relic.emoji,
        description: relic.description,
        startingPrice: startPrice,
        currentBid: 0n,
        status: 'ACTIVE',
        endsAt
      }
    });
    createdListings.push(listing);
  }

  if (client && createdListings.length > 0) {
    await announceAuctionDrop(client, createdListings);
  }

  return { seeded: createdListings.length, listings: createdListings };
}

/**
 * Launches a custom admin auction lot immediately and announces it in #auction-house.
 */
export async function launchCustomAuctionLot(options: {
  itemKey: string;
  itemName: string;
  emoji: string;
  description: string;
  startingPrice: bigint;
  durationHours: number;
  client?: Client;
}) {
  await loadConfigCache();
  const endsAt = new Date(Date.now() + Math.max(0.05, options.durationHours) * 60 * 60 * 1000);
  const listing = await prisma.auctionListing.create({
    data: {
      itemKey: options.itemKey,
      itemName: options.itemName,
      emoji: options.emoji,
      description: options.description,
      startingPrice: options.startingPrice,
      currentBid: 0n,
      status: 'ACTIVE',
      endsAt
    }
  });

  if (options.client) {
    await announceAuctionDrop(options.client, [listing], '⚡ CUSTOM AUCTION LOT NOW LIVE!');
  }

  return listing;
}

/**
 * Atomic escrowed bidding with automatic prior-bidder refund and +2m anti-snipe extension.
 */
export async function placeAuctionBid(
  playerId: string,
  rawAmount: string,
  lotNumber = 1,
  client?: Client
): Promise<{ success: boolean; message: string }> {
  await loadConfigCache();
  const ahCfg = getAuctionAutomationConfig();
  const minIncrement = ahCfg.minBidIncrement;

  const player = await prisma.player.findUnique({ where: { id: playerId } });
  if (!player) {
    return { success: false, message: '❌ Player not found. Run `-profile` first to register.' };
  }

  if (player.currentLocation !== 'ah') {
    return {
      success: false,
      message: '❌ You must be inside the **🏛️ Auction House** (`-travel ah`) to place a bid!'
    };
  }

  const bidAmount = parseCoinAmount(rawAmount);
  if (!bidAmount || bidAmount <= 0n) {
    return { success: false, message: '❌ Invalid bid amount. Examples: `-bid 1.5m`, `-bid 800k`.' };
  }

  const activeLots = await prisma.auctionListing.findMany({
    where: { status: 'ACTIVE', endsAt: { gt: new Date() } },
    orderBy: { endsAt: 'asc' }
  });

  if (activeLots.length === 0) {
    return { success: false, message: 'ℹ️ No active auctions right now. Check back at the daily drop!' };
  }

  const idx = Math.max(0, Math.min(activeLots.length - 1, lotNumber - 1));
  const targetLot = activeLots[idx];

  const minRequired = targetLot.currentBid > 0n
    ? targetLot.currentBid + minIncrement
    : targetLot.startingPrice;

  if (bidAmount < minRequired) {
    return {
      success: false,
      message: `⚠️ Bid too low for **${targetLot.itemName}**! Minimum required bid: **\`${formatK(minRequired)} coins\`**.`
    };
  }

  if (targetLot.highestBidderId === playerId) {
    return {
      success: false,
      message: `ℹ️ You already hold the highest bid (\`${formatK(targetLot.currentBid)} coins\`) on **${targetLot.itemName}**!`
    };
  }

  if (player.coins < bidAmount) {
    return {
      success: false,
      message: `🪙 Insufficient coins! You tried to bid \`${formatK(bidAmount)}\`, but only have \`${formatK(player.coins)}\`.`
    };
  }

  const now = new Date();
  const msLeft = targetLot.endsAt.getTime() - now.getTime();
  const extended = ahCfg.antiSnipeMinutes > 0 && msLeft < ANTI_SNIPE_WINDOW_MS;
  const nextEndsAt = extended ? new Date(now.getTime() + ahCfg.antiSnipeMinutes * 60 * 1000) : targetLot.endsAt;

  // Atomic escrow transaction
  const prevBidderId = targetLot.highestBidderId;
  const prevBid = targetLot.currentBid;

  await prisma.$transaction(async (tx) => {
    const freshLot = await tx.auctionListing.findUnique({ where: { id: targetLot.id } });
    if (!freshLot || freshLot.status !== 'ACTIVE' || freshLot.endsAt <= new Date()) {
      throw new Error('This auction just closed!');
    }
    const freshMin = freshLot.currentBid > 0n ? freshLot.currentBid + minIncrement : freshLot.startingPrice;
    if (bidAmount < freshMin) {
      throw new Error(`Someone just outbid you! Minimum required is now ${formatK(freshMin)} coins.`);
    }

    await tx.player.update({
      where: { id: playerId },
      data: { coins: { decrement: bidAmount } }
    });

    if (freshLot.highestBidderId && freshLot.currentBid > 0n) {
      await tx.player.update({
        where: { id: freshLot.highestBidderId },
        data: { coins: { increment: freshLot.currentBid } }
      });
    }

    await tx.auctionListing.update({
      where: { id: targetLot.id },
      data: {
        currentBid: bidAmount,
        highestBidderId: playerId,
        endsAt: nextEndsAt
      }
    });

    await tx.auctionBid.create({
      data: {
        auctionId: targetLot.id,
        bidderId: playerId,
        amount: bidAmount
      }
    });
  });

  // Notify outbid player politely via DM
  if (client && prevBidderId && prevBidderId !== playerId) {
    const prevUser = await client.users.fetch(prevBidderId).catch(() => null);
    if (prevUser) {
      await prevUser.send(
        `🔔 **Outbid Alert!** Someone placed \`${formatK(bidAmount)} coins\` on **${targetLot.itemName}**.\n` +
        `Your previous escrow of \`${formatK(prevBid)} coins\` has been refunded to your wallet!`
      ).catch(() => {});
    }
  }

  const snipeNote = extended ? `\n⏱️ **Anti-Snipe Activated:** Closing timer extended by **+${ahCfg.antiSnipeMinutes} minute(s)**!` : '';
  return {
    success: true,
    message:
      `🔨 **BID ACCEPTED ON LOT #${idx + 1}!**\n` +
      `${targetLot.emoji} **${targetLot.itemName}**\n` +
      `• **Your Leading Bid:** \`${formatK(bidAmount)} coins\` *(Escrowed)*\n` +
      `• **Time Remaining:** \`${formatTimeRemaining(nextEndsAt)}\`${snipeNote}`
  };
}

/**
 * Settles a single active auction lot (awarding highest bidder) or cancels it (refunding escrow).
 */
export async function settleOrCancelAuctionLot(
  lotNumber: number,
  mode: 'end' | 'cancel',
  client?: Client
): Promise<{ success: boolean; message: string }> {
  const activeLots = await prisma.auctionListing.findMany({
    where: { status: 'ACTIVE', endsAt: { gt: new Date() } },
    orderBy: { endsAt: 'asc' }
  });
  if (activeLots.length === 0) {
    return { success: false, message: 'ℹ️ There are no active auction lots right now.' };
  }

  const idx = lotNumber - 1;
  if (idx < 0 || idx >= activeLots.length) {
    return { success: false, message: `❌ Invalid lot #${lotNumber}. Active lots: \`1–${activeLots.length}\`.` };
  }

  const lot = activeLots[idx];
  if (mode === 'cancel') {
    await prisma.$transaction(async (tx) => {
      const upd = await tx.auctionListing.updateMany({
        where: { id: lot.id, status: 'ACTIVE' },
        data: { status: 'CANCELLED' }
      });
      if (upd.count === 0) throw new Error('Lot already closed.');
      if (lot.highestBidderId && lot.currentBid > 0n) {
        await tx.player.update({
          where: { id: lot.highestBidderId },
          data: { coins: { increment: lot.currentBid } }
        });
      }
    });

    if (client && lot.highestBidderId && lot.currentBid > 0n) {
      const bidder = await client.users.fetch(lot.highestBidderId).catch(() => null);
      if (bidder) {
        await bidder.send(
          `🏛️ **Auction Cancelled:** ${lot.emoji} **${lot.itemName}** was cancelled by an Admin. Your \`${formatK(lot.currentBid)} coins\` escrow has been refunded.`
        ).catch(() => {});
      }
    }

    return {
      success: true,
      message: `🚫 Cancelled **Lot #${lotNumber}** (${lot.emoji} **${lot.itemName}**)${lot.highestBidderId ? ` and refunded \`${formatK(lot.currentBid)}\` coins to <@${lot.highestBidderId}>` : ''}.`
    };
  }

  // Early settlement
  await prisma.$transaction(async (tx) => {
    const upd = await tx.auctionListing.updateMany({
      where: { id: lot.id, status: 'ACTIVE' },
      data: { status: 'SETTLED', endsAt: new Date() }
    });
    if (upd.count === 0) throw new Error('Lot already closed.');
    if (lot.highestBidderId) {
      await tx.inventoryItem.create({
        data: {
          playerId: lot.highestBidderId,
          itemKey: lot.itemKey,
          name: lot.itemName,
          emoji: lot.emoji
        }
      });
    }
  });

  if (client && lot.highestBidderId) {
    const winner = await client.users.fetch(lot.highestBidderId).catch(() => null);
    if (winner) {
      await winner.send(
        `🎉 **AUCTION WON!** You claimed ${lot.emoji} **${lot.itemName}** for \`${formatK(lot.currentBid)} coins\`!`
      ).catch(() => {});
    }
    if (lot.channelId) {
      const ch = client.channels.cache.get(lot.channelId) as TextChannel | undefined;
      if (ch?.isTextBased()) {
        await ch.send(`🏛️ **SOLD (Admin Settled)!** ${lot.emoji} **${lot.itemName}** goes to <@${lot.highestBidderId}> for **\`${formatK(lot.currentBid)} coins\`**!`).catch(() => {});
      }
    }
  }

  return {
    success: true,
    message: lot.highestBidderId
      ? `✅ Settled **Lot #${lotNumber}** (${lot.emoji} **${lot.itemName}**) — awarded to <@${lot.highestBidderId}> for \`${formatK(lot.currentBid)} coins\`!`
      : `ℹ️ Settled **Lot #${lotNumber}** (${lot.emoji} **${lot.itemName}**) with zero bids.`
  };
}

/**
 * Settles expired active auctions, transfers won items to InventoryItem, and notifies winners.
 */
export async function settleExpiredAuctions(client?: Client): Promise<number> {
  const now = new Date();
  const expired = await prisma.auctionListing.findMany({
    where: {
      status: 'ACTIVE',
      endsAt: { lte: now }
    }
  });

  let settledCount = 0;
  for (const lot of expired) {
    try {
      await prisma.$transaction(async (tx) => {
        const res = await tx.auctionListing.updateMany({
          where: { id: lot.id, status: 'ACTIVE' },
          data: { status: 'SETTLED' }
        });
        if (res.count === 0) return;

        if (lot.highestBidderId) {
          await tx.inventoryItem.create({
            data: {
              playerId: lot.highestBidderId,
              itemKey: lot.itemKey,
              name: lot.itemName,
              emoji: lot.emoji
            }
          });
        }
      });

      settledCount++;
      if (client && lot.highestBidderId) {
        const winner = await client.users.fetch(lot.highestBidderId).catch(() => null);
        if (winner) {
          await winner.send(
            `🎉 **AUCTION WON!**\n` +
            `You claimed ${lot.emoji} **${lot.itemName}** for \`${formatK(lot.currentBid)} coins\`!\n` +
            `It is now showcased inside your \`-profile\` Trophy Cabinet.`
          ).catch(() => {});
        }
        if (lot.channelId) {
          const ch = client.channels.cache.get(lot.channelId) as TextChannel | undefined;
          if (ch?.isTextBased()) {
            await ch.send(
              `🏛️ **SOLD!** ${lot.emoji} **${lot.itemName}** goes to <@${lot.highestBidderId}> for **\`${formatK(lot.currentBid)} coins\`**!`
            ).catch(() => {});
          }
        }
      } else if (client && !lot.highestBidderId && lot.channelId) {
        const ch = client.channels.cache.get(lot.channelId) as TextChannel | undefined;
        if (ch?.isTextBased()) {
          await ch.send(`🏛️ **AUCTION ENDED:** ${lot.emoji} **${lot.itemName}** closed with no bids and returned to the Vault.`).catch(() => {});
        }
      }
    } catch (err) {
      logger.error({ err, lotId: lot.id }, 'Error settling expired auction lot');
    }
  }

  return settledCount;
}
