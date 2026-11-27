import { EmbedBuilder } from 'discord.js';
import { prisma } from '../database/prisma.js';
import { VEHICLE_CATALOG } from '../config/constants.js';

/**
 * Handles purchases at the Global Market
 */
export async function buyMarketItem(playerId: string, itemAlias: string): Promise<{ success: boolean; message: string }> {
  const player = await prisma.player.findUnique({ where: { id: playerId } });
  if (!player) return { success: false, message: '❌ Player not found.' };

  if (player.currentLocation !== 'gm') {
    return { success: false, message: '❌ You must be at the **🛍️ Global Market** (`-travel gm`) to buy gear!' };
  }

  const alias = itemAlias.toLowerCase();

  if (alias === 'sd' || alias === 'drink' || alias === 'sportsdrink') {
    const cost = 100000n;
    if (player.coins < cost) {
      return { success: false, message: `🪙 Insufficient funds! Sports Drink costs **100k coins** (Your balance: ${Number(player.coins).toLocaleString()} coins).` };
    }

    const previousStamina = player.stamina;
    const newStamina = Math.min(100, player.stamina + 50);
    const actualGained = newStamina - previousStamina;

    const updated = await prisma.player.update({
      where: { id: playerId },
      data: {
        coins: { decrement: cost },
        stamina: newStamina
      }
    });

    return {
      success: true,
      message: `🥤 **Guzzled Energy Sports Drink!**\n` +
        `Restored **+${actualGained} Stamina** (Capped at 100)!\n` +
        `Current Stamina: \`${updated.stamina}/100\` | Balance: \`${Number(updated.coins).toLocaleString()} coins\``
    };
  }

  if (alias === 'strika' || alias === 'passa' || alias === 'bully') {
    const cost = 500000n;
    if (player.coins < cost) {
      return { success: false, message: `🪙 Insufficient funds! Performance boots cost **500k coins** (Your balance: ${Number(player.coins).toLocaleString()} coins).` };
    }

    if (player.activeBoots === alias) {
      return { success: false, message: `⚠️ You already have **${alias.toUpperCase()} boots** equipped! Boot bonuses do not stack.` };
    }

    const boostLabel = alias === 'strika' ? '+10 Attack (ATK)' : alias === 'passa' ? '+10 Midfield (MID)' : '+10 Defence (DEF)';

    const updated = await prisma.player.update({
      where: { id: playerId },
      data: {
        coins: { decrement: cost },
        activeBoots: alias
      }
    });

    return {
      success: true,
      message: `👟 **Equipped Elite ${alias.toUpperCase()} Boots!**\n` +
        `Active Matchday Boost: **${boostLabel}** for your next match!\n` +
        `Balance: \`${Number(updated.coins).toLocaleString()} coins\`\n*(Note: Resets after matchday)*`
    };
  }

  return {
    success: false,
    message: '❌ Invalid item alias. Available: `-buy sd` (100k), `-buy strika` (500k), `-buy passa` (500k), `-buy bully` (500k).'
  };
}

/**
 * Handles matchday tactical scouting at the Intel Hub
 */
export async function claimIntelScouting(playerId: string): Promise<{ success: boolean; message: string }> {
  const player = await prisma.player.findUnique({ where: { id: playerId } });
  if (!player) return { success: false, message: '❌ Player not found.' };

  if (player.currentLocation !== 'ih') {
    return { success: false, message: '❌ You must be at the **🛰️ Intel Hub** (`-travel ih`) to access match scouting!' };
  }

  const now = new Date();
  if (player.lastIntelAt && player.lastIntelAt.toDateString() === now.toDateString()) {
    return { success: false, message: '⏳ You have already claimed today\'s opposition intelligence report. It resets after matchday!' };
  }

  const bonus = Math.floor(Math.random() * 6) + 1; // +1 to +6
  const statTargets = ['Finishing', 'Pace', 'Passing', 'Vision', 'Tackling', 'Composure'];
  const targetStat = statTargets[Math.floor(Math.random() * statTargets.length)];

  await prisma.player.update({
    where: { id: playerId },
    data: {
      intelBonus: bonus,
      intelStat: targetStat,
      lastIntelAt: now
    }
  });

  return {
    success: true,
    message: `🛰️ **Tactical Scouting Dossier Decrypted!**\n` +
      `Opposition weakness pinpointed! You received **+${bonus} ${targetStat} boost** for your upcoming match!\n` +
      `*(Free once per matchday • Does not stack • Resets after match)*`
  };
}

/**
 * Handles vehicle purchase at the Vehicle Showroom
 */
export async function buyVehicle(playerId: string, vehicleAlias: string): Promise<{ success: boolean; message: string }> {
  const player = await prisma.player.findUnique({
    where: { id: playerId },
    include: { vehicles: true }
  });
  if (!player) return { success: false, message: '❌ Player not found.' };

  if (player.currentLocation !== 'gm') {
    return { success: false, message: '❌ You must be at the **🛍️ Global Market** (`-travel gm`) to buy a vehicle!' };
  }

  const cleanAlias = vehicleAlias.toLowerCase().trim();
  const lookupKey = cleanAlias === 'shelbymustang' ? 'mustang' : cleanAlias;
  const targetDef = VEHICLE_CATALOG.find(v => v.key.toLowerCase() === lookupKey || v.name.toLowerCase().includes(cleanAlias));
  if (!targetDef) {
    const list = VEHICLE_CATALOG.map(v => `• \`${v.key}\` — ${v.name} (${Number(v.cost).toLocaleString()} coins • ${v.cooldownMinutes}m cooldown)`).join('\n');
    return { success: false, message: `❌ Unknown vehicle \`${vehicleAlias}\`.\n\n**Showroom Catalog:**\n${list}` };
  }

  const alreadyOwned = player.vehicles.some(v => v.vehicleKey === targetDef.key);
  if (alreadyOwned) {
    return { success: false, message: `ℹ️ You already own a **${targetDef.name}** in your personal garage!` };
  }

  if (player.coins < targetDef.cost) {
    return {
      success: false,
      message: `🪙 Insufficient funds! **${targetDef.name}** costs **${Number(targetDef.cost).toLocaleString()} coins** (You have: ${Number(player.coins).toLocaleString()} coins).`
    };
  }

  await prisma.$transaction([
    prisma.player.update({
      where: { id: playerId },
      data: { coins: { decrement: targetDef.cost } }
    }),
    prisma.playerVehicle.create({
      data: {
        playerId,
        vehicleKey: targetDef.key,
        name: targetDef.name,
        cooldownMinutes: targetDef.cooldownMinutes
      }
    })
  ]);

  return {
    success: true,
    message: `🏎️ **CONGRATULATIONS! Delivery Complete!**\n` +
      `You purchased the **${targetDef.emoji} ${targetDef.name}**!\n` +
      `⏱️ **New Travel Cooldown:** Slashed down to **${targetDef.cooldownMinutes} minutes**!\n` +
      `Added to your permanent garage on \`-profile\`.`
  };
}
