import { EmbedBuilder } from 'discord.js';
import { prisma } from '../database/prisma.js';
import { VEHICLE_CATALOG } from '../config/constants.js';
import { getEffectivePrice, getMarketItemPrice, loadConfigCache } from '../services/configService.js';
import { formatK } from '../utils/formatHelper.js';

/**
 * Handles purchases at the Global Market
 */
export async function buyMarketItem(playerId: string, itemAlias: string): Promise<{ success: boolean; message: string }> {
  await loadConfigCache();
  const player = await prisma.player.findUnique({ where: { id: playerId } });
  if (!player) return { success: false, message: '❌ Player not found.' };

  if (player.currentLocation !== 'gm') {
    return { success: false, message: '❌ You must be at the **🛍️ Global Market** (`-travel gm`) to buy gear!' };
  }

  const alias = itemAlias.toLowerCase();

  if (alias === 'sd' || alias === 'drink' || alias === 'sportsdrink') {
    const cost = getMarketItemPrice('sd');
    if (player.coins < cost) {
      return { success: false, message: `🪙 Insufficient funds! Sports Drink costs **${formatK(cost)} coins** (Your balance: ${formatK(player.coins)} coins).` };
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
      message: `🥤 **Guzzled Energy Sports Drink!** (-${formatK(cost)} coins)\n` +
        `Restored **+${actualGained} Stamina** (Capped at 100)!\n` +
        `Current Stamina: \`${updated.stamina}/100\` | Balance: \`${formatK(updated.coins)} coins\``
    };
  }

  if (alias === 'strika' || alias === 'passa' || alias === 'bully') {
    const cost = getMarketItemPrice(alias);
    if (player.coins < cost) {
      return { success: false, message: `🪙 Insufficient funds! Performance boots cost **${formatK(cost)} coins** (Your balance: ${formatK(player.coins)} coins).` };
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
      message: `👟 **Equipped Elite ${alias.toUpperCase()} Boots!** (-${formatK(cost)} coins)\n` +
        `Active Matchday Boost: **${boostLabel}** for your next match!\n` +
        `Balance: \`${formatK(updated.coins)} coins\`\n*(Note: Resets after matchday)*`
    };
  }

  return {
    success: false,
    message: `❌ Invalid item alias. Available: \`-buy sd\` (${formatK(getMarketItemPrice('sd'))}), \`-buy strika\` (${formatK(getMarketItemPrice('strika'))}), \`-buy passa\` (${formatK(getMarketItemPrice('passa'))}), \`-buy bully\` (${formatK(getMarketItemPrice('bully'))}).`
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
  await loadConfigCache();
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
    const list = VEHICLE_CATALOG.map(v => `• \`${v.key}\` — ${v.name} (${formatK(getEffectivePrice(v.key, v.cost))} coins • ${v.cooldownMinutes}m cooldown)`).join('\n');
    return { success: false, message: `❌ Unknown vehicle \`${vehicleAlias}\`.\n\n**Showroom Catalog:**\n${list}` };
  }

  const alreadyOwned = player.vehicles.some(v => v.vehicleKey === targetDef.key);
  if (alreadyOwned) {
    return { success: false, message: `ℹ️ You already own a **${targetDef.name}** in your personal garage!` };
  }

  const vehicleCost = getEffectivePrice(targetDef.key, targetDef.cost);
  if (player.coins < vehicleCost) {
    return {
      success: false,
      message: `🪙 Insufficient funds! **${targetDef.name}** costs **${formatK(vehicleCost)} coins** (You have: ${formatK(player.coins)} coins).`
    };
  }

  await prisma.$transaction([
    prisma.player.update({
      where: { id: playerId },
      data: { coins: { decrement: vehicleCost } }
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
    message: `🏎️ **CONGRATULATIONS! Delivery Complete!** (-${formatK(vehicleCost)} coins)\n` +
      `You purchased the **${targetDef.emoji} ${targetDef.name}**!\n` +
      `⏱️ **New Travel Cooldown:** Slashed down to **${targetDef.cooldownMinutes} minutes**!\n` +
      `Added to your permanent garage on \`-profile\`.`
  };
}
