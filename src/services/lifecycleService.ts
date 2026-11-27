import { Client } from 'discord.js';
import { prisma } from '../database/prisma.js';
import { formatK } from '../utils/formatHelper.js';
import { logger } from '../utils/logger.js';
import { seedDailyAuctions, settleExpiredAuctions } from '../engines/auctionEngine.js';
import { getAuctionAutomationConfig, loadConfigCache } from './configService.js';
import { calculateDerivedRatings } from '../engines/matchSimulationEngine.js';
import { syncMemberGameRoles } from '../utils/roleSyncHelper.js';

let dailyTimer: NodeJS.Timeout | null = null;
let auctionTimer: NodeJS.Timeout | null = null;
let auctionTickRunning = false;

/**
 * Runs the daily reset:
 * 1. +20 Stamina restored
 * 2. 5% Followers decay (Lost Relevancy)
 * 3. 5% Daily Tax on wealth >= 1,000,000 coins
 * 4. DMs player update report
 */
export async function executeDailyLifecycle(client: Client) {
  logger.info('Running Daily Lifecycle Reset for Beyond The Final Whistle...');

  const players = await prisma.player.findMany();
  for (const player of players) {
    try {
      const staminaRestored = Math.min(100, player.stamina + 20) - player.stamina;
      const newStamina = Math.min(100, player.stamina + 20);

      // 5% Lost Relevancy
      const lostFollowers = BigInt(Math.floor(Number(player.followers) * 0.05));
      const newFollowers = player.followers > lostFollowers ? player.followers - lostFollowers : 0n;

      // 5% Tax on balances >= 1M
      let taxDeducted = 0n;
      let newCoins = player.coins;
      if (player.coins >= 1000000n) {
        taxDeducted = BigInt(Math.floor(Number(player.coins) * 0.05));
        newCoins = player.coins - taxDeducted;
      }

      await prisma.player.update({
        where: { id: player.id },
        data: {
          stamina: newStamina,
          followers: newFollowers,
          coins: newCoins,
          lastTaxDeductedAt: taxDeducted > 0n ? new Date() : player.lastTaxDeductedAt,
          lastRelevancyDecayAt: new Date()
        }
      });

      // Deliver DM text formatted exactly like WITS bot
      const user = await client.users.fetch(player.id).catch(() => null);
      if (user) {
        let dmText = `Daily Change\n+${staminaRestored} ⚡ Stamina restored (now ${newStamina}/100)`;
        if (taxDeducted > 0n) {
          dmText += `\n${formatK(taxDeducted)} 🪙 Income Tax collected 👮🏻‍♂️`;
        }
        if (lostFollowers > 0n) {
          dmText += `\n${formatK(lostFollowers)} 📉 Followers lost to Lost Relevancy 📵`;
        }
        await user.send(dmText).catch(() => {});
      }
    } catch (err) {
      logger.error({ err, playerId: player.id }, 'Error during player daily reset');
    }
  }

  logger.info(`Daily Lifecycle Reset completed for ${players.length} players.`);
}

async function expireElapsedVips(client: Client) {
  const now = new Date();
  const expiredVips = await prisma.player.findMany({
    where: { vipTier: { gte: 1 }, vipExpiresAt: { lte: now } }
  });

  for (const player of expiredVips) {
    try {
      const updated = await prisma.player.update({
        where: { id: player.id },
        data: { vipTier: 0, vipExpiresAt: null }
      });

      const derived = calculateDerivedRatings(updated);
      const ovr = Math.round((derived.atk + derived.mid + derived.def) / 3);

      for (const guild of client.guilds.cache.values()) {
        const vipChannel = guild.channels.cache.find(c => c.name.toLowerCase().includes('vip-lounge'));
        if (vipChannel && 'permissionOverwrites' in vipChannel) {
          await vipChannel.permissionOverwrites.delete(player.id).catch(() => {});
        }
        const member = await guild.members.fetch(player.id).catch(() => null);
        if (member) {
          await syncMemberGameRoles(member, { ovr, matchesPlayed: updated.matchesPlayed || 0, vipTier: 0 });
        }
      }

      const user = await client.users.fetch(player.id).catch(() => null);
      if (user) {
        await user.send('👑 Your **VIP Pass** on Beyond The Final Whistle has expired. Thanks for supporting the league!').catch(() => {});
      }
    } catch (err) {
      logger.error({ err, playerId: player.id }, 'Error expiring VIP pass');
    }
  }
}

async function runAuctionLifecycleTick(client: Client) {
  if (auctionTickRunning) return;
  auctionTickRunning = true;
  try {
    await loadConfigCache();
    await expireElapsedVips(client);
    await settleExpiredAuctions(client);

    const ahCfg = getAuctionAutomationConfig();
    if (ahCfg.autoEnabled) {
      await seedDailyAuctions(client, ahCfg.lotsPerDrop, true, ahCfg.durationHours);
    }
  } catch (err) {
    logger.error({ err }, 'Auction lifecycle tick failed');
  } finally {
    auctionTickRunning = false;
  }
}

export function startDailyLifecycleWorker(client: Client) {
  if (dailyTimer) clearInterval(dailyTimer);
  if (auctionTimer) clearInterval(auctionTimer);

  // Check every 15 minutes if it's 07:00 UTC for daily upkeep
  dailyTimer = setInterval(() => {
    const now = new Date();
    if (now.getUTCHours() === 7 && now.getUTCMinutes() < 15) {
      executeDailyLifecycle(client);
    }
  }, 15 * 60 * 1000);

  // Run automated Auction House settlement & daily collectible seeding every 60s
  void runAuctionLifecycleTick(client);
  auctionTimer = setInterval(() => {
    void runAuctionLifecycleTick(client);
  }, 60 * 1000);
}
