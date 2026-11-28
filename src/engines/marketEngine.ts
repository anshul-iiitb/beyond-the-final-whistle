import { EmbedBuilder } from 'discord.js';
import { prisma } from '../database/prisma.js';
import { VEHICLE_CATALOG } from '../config/constants.js';
import { getEffectivePrice, getMarketItemPrice, loadConfigCache } from '../services/configService.js';
import { formatK } from '../utils/formatHelper.js';

/**
 * Handles purchases at the Global Market
 */
export async function buyMarketItem(playerId: string, itemAlias: string, quantityStr?: string): Promise<{ success: boolean; message: string }> {
  await loadConfigCache();
  const player = await prisma.player.findUnique({ where: { id: playerId } });
  if (!player) return { success: false, message: '❌ Player not found.' };

  if (player.currentLocation !== 'gm') {
    return { success: false, message: '❌ You must be at the **🛍️ Global Market** (`-travel gm`) to buy gear!' };
  }

  const alias = itemAlias.toLowerCase();

  if (alias === 'sd' || alias === 'drink' || alias === 'sportsdrink') {
    const qty = Math.max(1, Math.min(50, parseInt(quantityStr || '1', 10) || 1));
    const singleCost = getMarketItemPrice('sd');
    const totalCost = singleCost * BigInt(qty);
    if (player.coins < totalCost) {
      return {
        success: false,
        message: `🪙 Insufficient funds! Buying **${qty}x Sports Drink(s)** costs **${formatK(totalCost)} coins** (Your balance: ${formatK(player.coins)} coins).`
      };
    }

    await prisma.player.update({
      where: { id: playerId },
      data: { coins: { decrement: totalCost } }
    });

    const existing = await prisma.inventoryItem.findFirst({
      where: { playerId, itemKey: 'sd' }
    });

    let currentQty = qty;
    if (existing) {
      const updatedItem = await prisma.inventoryItem.update({
        where: { id: existing.id },
        data: { quantity: { increment: qty } }
      });
      currentQty = updatedItem.quantity;
    } else {
      await prisma.inventoryItem.create({
        data: {
          playerId,
          itemKey: 'sd',
          name: 'Sports Drink',
          emoji: '🥤',
          quantity: qty
        }
      });
    }

    return {
      success: true,
      message: `🥤 **Purchased ${qty}x Sports Drink(s)!** (-${formatK(totalCost)} coins)\n` +
        `Added to your inventory bag (Now holding **${currentQty}x**).\n` +
        `💡 *Drink anytime with \`-use sd [qty]\` to restore +50 stamina per drink (capped at 100)!*`
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

    const bootTargetPos = alias === 'strika' ? 'ATK' : alias === 'passa' ? 'MID' : 'DEF';
    const playerPos = (player.position || 'ATT').toUpperCase();
    const isMismatched = (bootTargetPos === 'ATK' && playerPos !== 'ATT' && playerPos !== 'ATK') ||
                         (bootTargetPos === 'MID' && playerPos !== 'MID') ||
                         (bootTargetPos === 'DEF' && playerPos !== 'DEF');

    let mismatchWarning = '';
    if (isMismatched) {
      mismatchWarning = `\n⚠️ **Position Mismatch Warning:** You are registered as **${playerPos}**! **${alias.toUpperCase()}** boots only boost **${bootTargetPos}** during matches. If you do not play in ${bootTargetPos}, this boot bonus will not apply!`;
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
        `Active Matchday Boost: **${boostLabel}** for your next match!${mismatchWarning}\n` +
        `Balance: \`${formatK(updated.coins)} coins\`\n*(Note: Resets after matchday)*`
    };
  }

  return {
    success: false,
    message: `❌ Invalid item alias. Available: \`-buy sd [qty]\` (${formatK(getMarketItemPrice('sd'))}), \`-buy strika\` (${formatK(getMarketItemPrice('strika'))}), \`-buy passa\` (${formatK(getMarketItemPrice('passa'))}), \`-buy bully\` (${formatK(getMarketItemPrice('bully'))}).`
  };
}

export async function useInventoryItem(playerId: string, itemKey: string, quantityStr?: string): Promise<{ success: boolean; message: string }> {
  const player = await prisma.player.findUnique({ where: { id: playerId } });
  if (!player) return { success: false, message: '❌ Player not found.' };

  const key = itemKey.toLowerCase();
  if (key === 'sd' || key === 'drink' || key === 'sportsdrink') {
    if (player.stamina >= 100) {
      return { success: false, message: '⚡ Your stamina is already full (`100/100`)!' };
    }

    const item = await prisma.inventoryItem.findFirst({
      where: { playerId, itemKey: 'sd' }
    });

    if (!item || item.quantity <= 0) {
      return {
        success: false,
        message: '🎒 You do not have any Sports Drinks in your inventory! Buy some at the Global Market (`-travel gm` ➔ `-buy sd [qty]`).'
      };
    }

    const reqQty = Math.max(1, parseInt(quantityStr || '1', 10) || 1);
    const toConsume = Math.min(reqQty, item.quantity);

    const oldStamina = player.stamina;
    const restored = Math.min(100, oldStamina + (toConsume * 50));
    const gained = restored - oldStamina;

    const remainingQty = item.quantity - toConsume;
    if (remainingQty <= 0) {
      await prisma.inventoryItem.delete({ where: { id: item.id } });
    } else {
      await prisma.inventoryItem.update({
        where: { id: item.id },
        data: { quantity: remainingQty }
      });
    }

    await prisma.player.update({
      where: { id: playerId },
      data: { stamina: restored }
    });

    return {
      success: true,
      message: `🥤 **Guzzled ${toConsume}x Energy Sports Drink(s)!**\n` +
        `Restored **+${gained} Stamina** (Now \`${restored}/100\`)!\n` +
        `Remaining in bag: \`${Math.max(0, remainingQty)}x\``
    };
  }

  return { success: false, message: `❌ Cannot consume \`${itemKey}\`. Only consumables like \`sd\` can be used.` };
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
