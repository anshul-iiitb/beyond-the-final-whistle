import { prisma } from '../database/prisma.js';
import { ATTRIBUTES_LIST, PLAYSTYLES } from '../config/constants.js';

export interface TrainingResult {
  success: boolean;
  message?: string;
  error?: string;
  player?: any;
  tpGained?: number;
  cooldownMinutes?: number;
  remainingStamina?: number;
  totalTp?: number;
}

/**
 * Handles training drills at the Training Center
 */
export async function executeTraining(playerId: string, type: 'normal' | 'vip' | 'noeffort'): Promise<TrainingResult> {
  const player = await prisma.player.findUnique({
    where: { id: playerId },
    include: { nation: true }
  });

  if (!player) {
    return { success: false, error: '❌ Player not found. Run `-profile` first to register.' };
  }

  if (player.currentLocation !== 'tc') {
    return { success: false, error: '❌ You must be at the **🏋️ Training Center** (`-travel tc`) to train!' };
  }

  const now = new Date();

  if (type === 'noeffort') {
    if (player.vipTier < 1) {
      return { success: false, error: '⭐ **No Effort Training** requires VIP status! Boost the server or invite friends to unlock.' };
    }
    if (player.lastTrainedAt && player.lastTrainedAt.toDateString() === now.toDateString()) {
      return { success: false, error: '⏳ You have already performed your daily **No Effort Training** session today.' };
    }
    if (player.stamina < 50) {
      return { success: false, error: `⚡ Insufficient stamina (${player.stamina}/50 needed for No Effort Training).` };
    }

    const earnedTp = 20;
    const updated = await prisma.player.update({
      where: { id: playerId },
      data: {
        trainingPoints: { increment: earnedTp },
        stamina: { decrement: 50 },
        lastTrainedAt: now
      },
      include: { nation: true }
    });

    return {
      success: true,
      player: updated,
      tpGained: earnedTp,
      cooldownMinutes: 1440,
      remainingStamina: updated.stamina,
      totalTp: updated.trainingPoints,
      message: `⭐ **No Effort Training Completed!**\nEarned **+${earnedTp} 🤹‍♂️**! Total: \`${updated.trainingPoints} TP\` | Stamina: \`${updated.stamina} ⚡\``
    };
  }

  if (type === 'vip') {
    if (player.vipTier < 1) {
      return { success: false, error: '⭐ **VIP Training** requires VIP status! Boost the server or donate to unlock.' };
    }
    if (player.stamina < 5) {
      return { success: false, error: `⚡ Insufficient stamina (${player.stamina}/5 needed). Visit the sauna (\`-travel ps\` ➔ \`-recovery\`) or buy a sports drink (\`-travel gm\` ➔ \`-buy sd\`).` };
    }
    if (player.lastTrainedAt) {
      const cooldownMs = 6 * 60 * 60 * 1000;
      const elapsed = now.getTime() - player.lastTrainedAt.getTime();
      if (elapsed < cooldownMs) {
        const remainingMinutes = Math.ceil((cooldownMs - elapsed) / (60 * 1000));
        return { success: false, error: `⏳ **VIP Drill Cooldown:** Please wait **${remainingMinutes} minutes** before your next VIP drill.` };
      }
    }

    const earnedTp = 6;
    const updated = await prisma.player.update({
      where: { id: playerId },
      data: {
        trainingPoints: { increment: earnedTp },
        stamina: { decrement: 5 },
        lastTrainedAt: now
      },
      include: { nation: true }
    });

    return {
      success: true,
      player: updated,
      tpGained: earnedTp,
      cooldownMinutes: 360,
      remainingStamina: updated.stamina,
      totalTp: updated.trainingPoints,
      message: `⭐ **VIP Tactical Masterclass Completed!**\nEarned **+${earnedTp} 🤹‍♂️**! Total: \`${updated.trainingPoints} TP\` | Stamina: \`${updated.stamina} ⚡\``
    };
  }

  // Normal training (30-min cooldown, 5 stamina, 1-2 TP)
  if (player.stamina < 5) {
    return { success: false, error: `⚡ Insufficient stamina (${player.stamina}/5 needed). Visit the sauna (\`-travel ps\` ➔ \`-recovery\`) or drink a sports drink (\`-travel gm\` ➔ \`-buy sd\`).` };
  }

  if (player.lastTrainedAt) {
    const cooldownMs = 30 * 60 * 1000;
    const elapsed = now.getTime() - player.lastTrainedAt.getTime();
    if (elapsed < cooldownMs) {
      const remainingMinutes = Math.ceil((cooldownMs - elapsed) / (60 * 1000));
      return { success: false, error: `⏳ **Cooling Down:** Please wait **${remainingMinutes} minutes** before training again.` };
    }
  }

  // Normal drill gives 1 to 2 TP (or up to 3 depending on level)
  const earnedTp = Math.random() < 0.65 ? 1 : 2;

  const updated = await prisma.player.update({
    where: { id: playerId },
    data: {
      trainingPoints: { increment: earnedTp },
      stamina: { decrement: 5 },
      lastTrainedAt: now
    },
    include: { nation: true }
  });

  return {
    success: true,
    player: updated,
    tpGained: earnedTp,
    cooldownMinutes: 30,
    remainingStamina: updated.stamina,
    totalTp: updated.trainingPoints,
    message: `⚽ **Pitch Drills Completed!**\nEarned **+${earnedTp} 🤹‍♂️**! Total: \`${updated.trainingPoints} TP\` | Stamina: \`${updated.stamina} ⚡\``
  };
}

/**
 * Biomechanics Lab: Upgrades an attribute using TP and stamina.
 * Costs 50 Stamina and between 3 and 15 TP dynamically calculated based on leaderboard standing.
 */
export async function upgradeAttribute(playerId: string, attributeKey: string) {
  const player = await prisma.player.findUnique({ where: { id: playerId } });
  if (!player) {
    return { success: false, message: '❌ Player not found. Run `-profile` first.' };
  }

  if (player.currentLocation !== 'rf') {
    return { success: false, message: '❌ You must be at the **🔬 Research Facility** (`-travel rf`) to upgrade attributes!' };
  }

  const attrLower = attributeKey.toLowerCase();
  const attrMeta = ATTRIBUTES_LIST.find(a => a.key === attrLower);
  if (!attrMeta) {
    return {
      success: false,
      message: `❌ Unknown attribute \`${attributeKey}\`. Valid: ${ATTRIBUTES_LIST.map(a => a.key.toUpperCase()).join(', ')}`
    };
  }

  const currentVal = (player as any)[attrLower] as number;
  if (currentVal >= 99) {
    return { success: false, message: `⭐ **${attrMeta.name}** has already reached the absolute maximum rating of 99!` };
  }

  if (player.stamina < 50) {
    return { success: false, message: `⚡ Upgrading requires **50 Stamina** (You have ${player.stamina}/100). Rest at sauna or drink a sports drink.` };
  }

  // Calculate dynamic TP cost (3 to 15 TP)
  const allPlayers = await prisma.player.findMany({ select: { [attrLower]: true } });
  const values = allPlayers.map((p: any) => p[attrLower] as number);
  const minVal = values.length ? Math.min(...values) : 50;
  const maxVal = values.length ? Math.max(...values) : 50;

  let tpCost = 3;
  if (maxVal > minVal) {
    const ratio = (currentVal - minVal) / (maxVal - minVal);
    tpCost = Math.round(3 + ratio * 12);
  } else {
    tpCost = 5;
  }
  tpCost = Math.max(3, Math.min(15, tpCost));

  if (player.trainingPoints < tpCost) {
    return {
      success: false,
      message: `🤹‍♂️ **Insufficient Training Points!** Developing **${attrMeta.name}** currently costs **${tpCost} TP** (You have ${player.trainingPoints} TP). Run drills at the Training Center.`
    };
  }

  const updated = await prisma.player.update({
    where: { id: playerId },
    data: {
      [attrLower]: { increment: 1 },
      trainingPoints: { decrement: tpCost },
      stamina: { decrement: 50 }
    }
  });

  return {
    success: true,
    message:
      `🔬 **Biomechanics Attribute Enhancement Successful!**\n\n` +
      `✨ **${attrMeta.name} (${attrMeta.key.toUpperCase()}):** \`${currentVal}\` ➔ **\`${(updated as any)[attrLower]}\`** (+1)\n` +
      `📉 Cost: **-${tpCost} TP** | **-50 ⚡ Stamina**\n` +
      `📊 Remaining: \`${updated.trainingPoints} TP\` | \`${updated.stamina} ⚡ Stamina\``
  };
}

/**
 * 7-Day Playstyle Conversion
 */
export async function convertPlaystyle(playerId: string, newStyleCode: string) {
  const player = await prisma.player.findUnique({ where: { id: playerId } });
  if (!player) {
    return { success: false, message: '❌ Player not found. Run `-profile` first.' };
  }

  if (player.currentLocation !== 'rf') {
    return { success: false, message: '❌ You must be at the **🔬 Research Facility** (`-travel rf`) to convert playstyle!' };
  }

  const codeUpper = newStyleCode.toUpperCase();
  const style = PLAYSTYLES[codeUpper];
  if (!style) {
    return {
      success: false,
      message: `❌ Unknown playstyle \`${newStyleCode}\`. Available: ${Object.keys(PLAYSTYLES).join(', ')}`
    };
  }

  if (player.playstyle === codeUpper) {
    return { success: false, message: `⚠️ You already play as a **${style.name} (${style.code})**!` };
  }

  const now = new Date();
  if (player.lastConvertedAt) {
    const cooldownMs = 7 * 24 * 60 * 60 * 1000; // 7 days
    const elapsed = now.getTime() - player.lastConvertedAt.getTime();
    if (elapsed < cooldownMs) {
      const remainingDays = Math.ceil((cooldownMs - elapsed) / (24 * 60 * 60 * 1000));
      return { success: false, message: `⏳ **Conversion Cooldown:** You can only switch playstyles once every 7 days. Remaining: **${remainingDays} days**.` };
    }
  }

  const updated = await prisma.player.update({
    where: { id: playerId },
    data: {
      playstyle: codeUpper,
      position: style.position,
      lastConvertedAt: now
    }
  });

  return {
    success: true,
    message:
      `🎭 **Tactical Re-Role Complete!**\n\n` +
      `Now playing as: ${style.emoji} **${style.name} (${style.code})** • Position: **${style.position}**\n` +
      `*${style.description}*\n` +
      `Key Attributes: ${style.keyStats.map(s => `\`${s.toUpperCase()}\``).join(', ')}\n\n` +
      `*(7-day conversion cooldown activated)*`
  };
}

/**
 * Player Sauna Recovery: restores stamina
 */
export async function executeSaunaRecovery(playerId: string) {
  const player = await prisma.player.findUnique({ where: { id: playerId } });
  if (!player) {
    return { success: false, message: '❌ Player not found. Run `-profile` first.' };
  }

  if (player.currentLocation !== 'ps') {
    return { success: false, message: '❌ You must be at the **🧖 Player Sauna** (`-travel ps`) to take a recovery session!' };
  }

  const now = new Date();
  if (player.lastRecoveryAt) {
    const cooldownMs = 12 * 60 * 60 * 1000; // 12 hours
    const elapsed = now.getTime() - player.lastRecoveryAt.getTime();
    if (elapsed < cooldownMs) {
      const remainingHours = Math.ceil((cooldownMs - elapsed) / (60 * 60 * 1000));
      return { success: false, message: `⏳ **Sauna Cooldown:** Your body is still recovering. Next session available in **${remainingHours} hours**.` };
    }
  }

  if (player.stamina >= 100) {
    return { success: false, message: '⚡ Your stamina is already at the maximum of 100!' };
  }

  const recoveryAmount = player.vipTier >= 1 ? 100 : 30;
  const newStamina = Math.min(100, player.stamina + recoveryAmount);

  await prisma.player.update({
    where: { id: playerId },
    data: {
      stamina: newStamina,
      lastRecoveryAt: now
    }
  });

  return {
    success: true,
    message:
      `🧖 **Steam Sauna & Cryotherapy Session Complete!**\n\n` +
      `⚡ Restored: **+${recoveryAmount} Stamina**\n` +
      `🔋 Current Stamina: **${newStamina}/100**\n` +
      `*(12-hour recovery cooldown active)*`
  };
}
