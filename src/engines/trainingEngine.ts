import { prisma } from '../database/prisma.js';
import { ATTRIBUTES_LIST, PLAYSTYLES } from '../config/constants.js';

export interface TrainingResult {
  success: boolean;
  message: string;
  earnedTp?: number;
  remainingStamina?: number;
  totalTp?: number;
}

/**
 * Handles training drills at the Training Center
 */
export async function executeTraining(playerId: string, type: 'normal' | 'vip' | 'noeffort'): Promise<TrainingResult> {
  const player = await prisma.player.findUnique({ where: { id: playerId } });
  if (!player) {
    return { success: false, message: '❌ Player not found. Run `-profile` first.' };
  }

  if (player.currentLocation !== 'tc') {
    return { success: false, message: '❌ You must be at the **🏋️ Training Center** (`-travel tc`) to train!' };
  }

  const now = new Date();

  if (type === 'noeffort') {
    if (player.vipTier < 1) {
      return { success: false, message: '⭐ **No-Effort Training** requires VIP or Premium status! Boost the server or donate to unlock.' };
    }
    if (player.lastTrainedAt && player.lastTrainedAt.toDateString() === now.toDateString()) {
      return { success: false, message: '⏳ You have already performed your daily **No-Effort Training** session today.' };
    }

    const earnedTp = player.vipTier >= 2 ? 50 : 20;
    const updated = await prisma.player.update({
      where: { id: playerId },
      data: {
        trainingPoints: { increment: earnedTp },
        lastTrainedAt: now
      }
    });

    return {
      success: true,
      earnedTp,
      totalTp: updated.trainingPoints,
      message: `⭐ **No-Effort Training Completed!**\nEarned **+${earnedTp} TP**! Total: \`${updated.trainingPoints} TP\`.\n*(Note: Normal and VIP drills are locked for today)*`
    };
  }

  if (type === 'vip') {
    if (player.vipTier < 1) {
      return { success: false, message: '⭐ **VIP Training** requires VIP status! Boost the server or donate to unlock.' };
    }
    if (player.stamina < 15) {
      return { success: false, message: `⚡ Insufficient stamina (${player.stamina}/15 needed). Visit the sauna (\`-travel ps\` ➔ \`-recovery\`) or buy a sports drink (\`-travel gm\` ➔ \`-buy sd\`).` };
    }
    if (player.lastTrainedAt) {
      const cooldownMs = 6 * 60 * 60 * 1000;
      const elapsed = now.getTime() - player.lastTrainedAt.getTime();
      if (elapsed < cooldownMs) {
        const remainingMinutes = Math.ceil((cooldownMs - elapsed) / (60 * 1000));
        return { success: false, message: `⏳ **VIP Drill Cooldown:** Please wait **${remainingMinutes} minutes** before your next VIP drill.` };
      }
    }

    const earnedTp = 6;
    const updated = await prisma.player.update({
      where: { id: playerId },
      data: {
        trainingPoints: { increment: earnedTp },
        stamina: { decrement: 15 },
        lastTrainedAt: now
      }
    });

    return {
      success: true,
      earnedTp,
      remainingStamina: updated.stamina,
      totalTp: updated.trainingPoints,
      message: `⭐ **VIP Tactical Masterclass Completed!**\nEarned **+${earnedTp} TP**! Total: \`${updated.trainingPoints} TP\` | Stamina: \`${updated.stamina}/100\``
    };
  }

  // Normal training (30-min cooldown, 10 stamina, 1-2 TP)
  if (player.stamina < 10) {
    return { success: false, message: `⚡ Insufficient stamina (${player.stamina}/10 needed). Visit the sauna (\`-travel ps\` ➔ \`-recovery\`) or drink an energy beverage.` };
  }

  if (player.lastTrainedAt) {
    const cooldownMs = 30 * 60 * 1000;
    const elapsed = now.getTime() - player.lastTrainedAt.getTime();
    if (elapsed < cooldownMs) {
      const remainingMinutes = Math.ceil((cooldownMs - elapsed) / (60 * 1000));
      return { success: false, message: `⏳ **Cooling Down:** Please wait **${remainingMinutes} minutes** before training again.` };
    }
  }

  const earnedTp = Math.floor(Math.random() * 2) + 1; // 1 or 2 TP
  const updated = await prisma.player.update({
    where: { id: playerId },
    data: {
      trainingPoints: { increment: earnedTp },
      stamina: { decrement: 10 },
      lastTrainedAt: now
    }
  });

  return {
    success: true,
    earnedTp,
    remainingStamina: updated.stamina,
    totalTp: updated.trainingPoints,
    message: `⚽ **Pitch Drills Completed!**\nEarned **+${earnedTp} TP**! Total: \`${updated.trainingPoints} TP\` | Stamina: \`${updated.stamina}/100\``
  };
}

/**
 * Calculates dynamic TP cost to upgrade an attribute based on server leaderboard standing (3 to 15 TP)
 */
export async function calculateDynamicUpgradeCost(attributeKey: string, currentValue: number): Promise<number> {
  const allPlayers = await prisma.player.findMany({
    select: { [attributeKey]: true } as any
  });

  if (allPlayers.length <= 1) return 3;

  const values = allPlayers.map((p: any) => p[attributeKey] as number);
  const minVal = Math.min(...values);
  const maxVal = Math.max(...values);

  if (maxVal === minVal) return 3;

  // Linear interpolation: minVal -> 3 TP, maxVal -> 15 TP
  const ratio = (currentValue - minVal) / (maxVal - minVal);
  const cost = Math.round(3 + ratio * 12);
  return Math.max(3, Math.min(15, cost));
}

/**
 * Upgrades a player's attribute at the Research Facility
 */
export async function upgradeAttribute(playerId: string, attributeCode: string): Promise<{ success: boolean; message: string }> {
  const player = await prisma.player.findUnique({ where: { id: playerId } });
  if (!player) return { success: false, message: '❌ Player not found.' };

  if (player.currentLocation !== 'rf') {
    return { success: false, message: '❌ You must be at the **🔬 Research Facility** (`-travel rf`) to upgrade attributes!' };
  }

  const attrKey = attributeCode.toLowerCase();
  const attrDef = ATTRIBUTES_LIST.find(a => a.key === attrKey);
  if (!attrDef) {
    const valid = ATTRIBUTES_LIST.map(a => `\`${a.key}\` (${a.name})`).join(', ');
    return { success: false, message: `❌ Invalid attribute \`${attributeCode}\`.\n**Valid Attributes:**\n${valid}` };
  }

  const currentValue = (player as any)[attrKey] as number;
  if (currentValue >= 99) {
    return { success: false, message: `🌟 Your **${attrDef.name}** is already maxed at **99**!` };
  }

  if (player.stamina < 50) {
    return { success: false, message: `⚡ Attribute upgrades require **50 Stamina** (You have: ${player.stamina}/100). Visit the sauna or drink sports drink.` };
  }

  const tpCost = await calculateDynamicUpgradeCost(attrKey, currentValue);
  if (player.trainingPoints < tpCost) {
    return {
      success: false,
      message: `🏃 You need **${tpCost} TP** to upgrade **${attrDef.name}** (Current standing cost). You have **${player.trainingPoints} TP**.\n*Train more at the Training Center (\`-travel tc\`)!*`
    };
  }

  const updated = await prisma.player.update({
    where: { id: playerId },
    data: {
      [attrKey]: { increment: 1 },
      trainingPoints: { decrement: tpCost },
      stamina: { decrement: 50 }
    }
  });

  return {
    success: true,
    message: `🔬 **Biomechanics Breakthrough!**\n` +
      `Your **${attrDef.name} (${attrDef.key.toUpperCase()})** increased: \`${currentValue}\` ➔ \`${currentValue + 1}\`!\n` +
      `Spent: \`${tpCost} TP\` & \`50 Stamina\` | Remaining: \`${updated.trainingPoints} TP\` | \`${updated.stamina}/100 Stamina\``
  };
}

/**
 * Handles playstyle conversion at the Research Facility (7-day cooldown)
 */
export async function convertPlaystyle(playerId: string, newStyleCode: string): Promise<{ success: boolean; message: string }> {
  const player = await prisma.player.findUnique({ where: { id: playerId } });
  if (!player) return { success: false, message: '❌ Player not found.' };

  if (player.currentLocation !== 'rf') {
    return { success: false, message: '❌ You must be at the **🔬 Research Facility** (`-travel rf`) to convert playstyles!' };
  }

  const styleKey = newStyleCode.toUpperCase();
  const styleDef = PLAYSTYLES[styleKey];
  if (!styleDef) {
    const list = Object.values(PLAYSTYLES).map(s => `• \`${s.code}\` — **${s.name}** (${s.position}): *${s.description}*`).join('\n');
    return { success: false, message: `❌ Invalid playstyle \`${newStyleCode}\`.\n\n**Available Playstyles:**\n${list}` };
  }

  if (player.playstyle === styleDef.code) {
    return { success: false, message: `ℹ️ You are already a **${styleDef.emoji} ${styleDef.name}**!` };
  }

  const now = new Date();
  if (player.lastConvertedAt) {
    const cooldownMs = 7 * 24 * 60 * 60 * 1000;
    const elapsed = now.getTime() - player.lastConvertedAt.getTime();
    if (elapsed < cooldownMs) {
      const remainingDays = Math.ceil((cooldownMs - elapsed) / (24 * 60 * 60 * 1000));
      return { success: false, message: `⏳ **Conversion Cooldown:** You can only convert playstyles once every 7 days. Remaining: **${remainingDays} day(s)**.` };
    }
  }

  await prisma.player.update({
    where: { id: playerId },
    data: {
      playstyle: styleDef.code,
      position: styleDef.position,
      lastConvertedAt: now
    }
  });

  return {
    success: true,
    message: `🔄 **Role Conversion Complete!**\n` +
      `You are now a **${styleDef.emoji} ${styleDef.name} (${styleDef.position})**!\n` +
      `*"${styleDef.description}"*\n` +
      `🎯 **Key Attributes:** ${styleDef.keyStats.map(s => `\`${s.toUpperCase()}\``).join(', ')}`
  };
}

/**
 * Restores stamina at the Player Sauna (-recovery)
 */
export async function executeSaunaRecovery(playerId: string): Promise<{ success: boolean; message: string }> {
  const player = await prisma.player.findUnique({ where: { id: playerId } });
  if (!player) return { success: false, message: '❌ Player not found.' };

  if (player.currentLocation !== 'ps') {
    return { success: false, message: '❌ You must be at the **🧖 Player Sauna** (`-travel ps`) to take a recovery session!' };
  }

  const now = new Date();
  if (player.lastRecoveryAt) {
    const cooldownMs = 12 * 60 * 60 * 1000;
    const elapsed = now.getTime() - player.lastRecoveryAt.getTime();
    if (elapsed < cooldownMs) {
      const remainingHours = Math.ceil((cooldownMs - elapsed) / (60 * 60 * 1000));
      return { success: false, message: `⏳ **Sauna Resting:** Please wait **${remainingHours} hour(s)** before another recovery session.` };
    }
  }

  const restoreAmount = player.vipTier >= 2 ? 100 : 30;
  const newStamina = Math.min(100, player.stamina + restoreAmount);

  await prisma.player.update({
    where: { id: playerId },
    data: {
      stamina: newStamina,
      lastRecoveryAt: now
    }
  });

  return {
    success: true,
    message: `🧖 **Deep Muscle Cryo & Steam Bath Completed!**\n` +
      `Recovered **+${restoreAmount} Stamina**! Current Stamina: \`${newStamina}/100\`.\n` +
      `*(12-hour recovery cooldown initiated)*`
  };
}
