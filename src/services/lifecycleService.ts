import { Client } from 'discord.js';
import { prisma } from '../database/prisma.js';
import { formatK } from '../utils/formatHelper.js';
import { logger } from '../utils/logger.js';

let dailyTimer: NodeJS.Timeout | null = null;

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

export function startDailyLifecycleWorker(client: Client) {
  if (dailyTimer) clearInterval(dailyTimer);
  // Check every 1 hour if it's 07:00 or run daily
  dailyTimer = setInterval(() => {
    const now = new Date();
    if (now.getUTCHours() === 7 && now.getUTCMinutes() < 15) {
      executeDailyLifecycle(client);
    }
  }, 15 * 60 * 1000); // Check every 15 minutes
}
