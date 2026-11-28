import { prisma } from '../database/prisma.js';
import { ATTRIBUTES_LIST, PLAYSTYLES } from '../config/constants.js';
import { withActionLock } from '../utils/mutexHelper.js';

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

function formatRemainingCooldown(msRemaining: number): string {
  const totalMinutes = Math.ceil(msRemaining / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
}

/**
 * Handles training drills at the Training Center
 */
export async function executeTraining(playerId: string, type: 'normal' | 'vip' | 'noeffort'): Promise<TrainingResult> {
  return withActionLock(`${playerId}:training`, async () => {
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

    const configs = {
      noeffort: {
        requiresVip: true,
        staminaCost: 50,
        cooldownMs: 20 * 60 * 60 * 1000,
        cooldownMinutes: 1200,
        timestampField: 'lastNoEffortAt' as const,
        label: 'VIP 20h Endurance Training',
        getTp: () => 20,
        header: '⭐ **VIP 20h Endurance Training Completed!**'
      },
      vip: {
        requiresVip: true,
        staminaCost: 5,
        cooldownMs: 6 * 60 * 60 * 1000,
        cooldownMinutes: 360,
        timestampField: 'lastVipTrainedAt' as const,
        label: 'VIP 6h Tactical Masterclass',
        getTp: () => 6,
        header: '⭐ **VIP 6h Tactical Masterclass Completed!**'
      },
      normal: {
        requiresVip: false,
        staminaCost: 5,
        cooldownMs: 60 * 60 * 1000,
        cooldownMinutes: 60,
        timestampField: 'lastTrainedAt' as const,
        label: 'Pitch Drills',
        getTp: () => Math.floor(Math.random() * 3) + 2,
        header: '⚽ **Pitch Drills Completed!**'
      }
    };

    const cfg = configs[type];
    if (cfg.requiresVip && player.vipTier < 1) {
      return { success: false, error: `👑 **${cfg.label}** requires **VIP** status!` };
    }

    if (player.stamina < cfg.staminaCost) {
      return {
        success: false,
        error: `⚡ Insufficient stamina (${player.stamina}/${cfg.staminaCost} needed). Visit the Clubhouse (\`-travel ch\` ➔ \`-recovery\`) or buy a sports drink (\`-travel gm\` ➔ \`-buy sd\`).`
      };
    }

    const now = new Date();
    const cutoff = new Date(now.getTime() - cfg.cooldownMs);

    // Initial check for clear error message
    const lastRun = player[cfg.timestampField];
    if (lastRun) {
      const elapsed = now.getTime() - lastRun.getTime();
      if (elapsed < cfg.cooldownMs) {
        const waitStr = formatRemainingCooldown(cfg.cooldownMs - elapsed);
        return { success: false, error: `⏳ **${cfg.label} Cooldown:** Please wait **${waitStr}** before running this drill again.` };
      }
    }

    const earnedTp = cfg.getTp();

    // Atomic conditional database update: guarantees only ONE concurrent execution can succeed
    const updateRes = await prisma.player.updateMany({
      where: {
        id: playerId,
        currentLocation: 'tc',
        stamina: { gte: cfg.staminaCost },
        vipTier: cfg.requiresVip ? { gte: 1 } : undefined,
        OR: [
          { [cfg.timestampField]: null },
          { [cfg.timestampField]: { lte: cutoff } }
        ]
      },
      data: {
        trainingPoints: { increment: earnedTp },
        lifetimeTpEarned: { increment: earnedTp },
        stamina: { decrement: cfg.staminaCost },
        [cfg.timestampField]: now
      }
    });

    if (updateRes.count === 0) {
      // Race condition blocked! Another request or active cooldown took effect.
      const current = await prisma.player.findUnique({ where: { id: playerId } });
      const last = current?.[cfg.timestampField];
      if (last) {
        const elapsed = now.getTime() - last.getTime();
        if (elapsed < cfg.cooldownMs) {
          const waitStr = formatRemainingCooldown(cfg.cooldownMs - elapsed);
          return { success: false, error: `⏳ **${cfg.label} Cooldown:** Please wait **${waitStr}** before running this drill again.` };
        }
      }
      return { success: false, error: '⏳ Cooldown active or session already recorded!' };
    }

    const updated = await prisma.player.findUnique({
      where: { id: playerId },
      include: { nation: true }
    });

    return {
      success: true,
      player: updated,
      tpGained: earnedTp,
      cooldownMinutes: cfg.cooldownMinutes,
      remainingStamina: updated?.stamina ?? 0,
      totalTp: updated?.trainingPoints ?? 0,
      message: `${cfg.header}\nEarned **+${earnedTp} 🤹‍♂️**! Total: \`${updated?.trainingPoints ?? 0} TP\` | Stamina: \`${updated?.stamina ?? 0} ⚡\``
    };
  });
}

export const SP_TRAIN_STAMINA_COST = 50;

export interface AttributeLabItem {
  key: string;
  name: string;
  category: string;
  currentVal: number;
  tpCost: number;
  isMaxed: boolean;
  canAffordTp: boolean;
  canAffordStamina: boolean;
  canAfford: boolean;
}

/**
 * Progressive TP cost starting from 50:
 * 3 TP for 51 & 52, 4 TP for 53, 5 TP for 54, ..., capped at 15 TP (64+).
 */
export function calculateAttributeTpCost(currentVal: number): number {
  const nextRating = currentVal + 1;
  if (nextRating <= 52) return 3;
  return Math.min(15, nextRating - 49);
}

/**
 * Computes current ratings and live TP + stamina costs across all 15 attributes for -sptrain menu.
 */
export async function getAttributeLabOverview(playerId: string) {
  const player = await prisma.player.findUnique({ where: { id: playerId } });
  if (!player) return null;

  const playerStyle = PLAYSTYLES[player.playstyle || 'PCH'] || PLAYSTYLES.PCH;

  const attributes: AttributeLabItem[] = ATTRIBUTES_LIST.map(meta => {
    const currentVal = (player as any)[meta.key] as number;
    let tpCost = calculateAttributeTpCost(currentVal);
    const isKeyStat = playerStyle.keyStats.includes(meta.key);
    if (isKeyStat) {
      tpCost = Math.max(1, Math.round(tpCost * 0.85)); // 15% Playstyle Key Stat Discount!
    }
    const isMaxed = currentVal >= 99;
    const canAffordTp = player.trainingPoints >= tpCost;
    const canAffordStamina = player.stamina >= SP_TRAIN_STAMINA_COST;
    return {
      key: meta.key,
      name: meta.name + (isKeyStat ? ' ⭐ [KEY]' : ''),
      category: meta.category,
      currentVal,
      tpCost,
      isMaxed,
      canAffordTp,
      canAffordStamina,
      canAfford: !isMaxed && canAffordTp && canAffordStamina
    };
  });

  return {
    player,
    staminaCost: SP_TRAIN_STAMINA_COST,
    attributes
  };
}

/**
 * Biomechanics Lab: Upgrades an attribute using progressive TP (3–15 TP) and 50 Stamina.
 */
export async function upgradeAttribute(playerId: string, attributeKey: string) {
  return withActionLock(`${playerId}:upgradeAttribute`, async () => {
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

    if (player.stamina < SP_TRAIN_STAMINA_COST) {
      return { success: false, message: `⚡ Upgrading requires **${SP_TRAIN_STAMINA_COST} Stamina** (You have ${player.stamina}/100). Rest at sauna or drink a sports drink.` };
    }

    const playerStyle = PLAYSTYLES[player.playstyle || 'PCH'] || PLAYSTYLES.PCH;
    const isKeyStat = playerStyle.keyStats.includes(attrLower);
    let tpCost = calculateAttributeTpCost(currentVal);
    if (isKeyStat) {
      tpCost = Math.max(1, Math.round(tpCost * 0.85)); // 15% Playstyle Key Stat Discount!
    }

    if (player.trainingPoints < tpCost) {
      return {
        success: false,
        message: `🤹‍♂️ **Insufficient Training Points!** Developing **${attrMeta.name}** currently costs **${tpCost} TP** (You have ${player.trainingPoints} TP). Run drills at the Training Center.`
      };
    }

    const updateRes = await prisma.player.updateMany({
      where: {
        id: playerId,
        currentLocation: 'rf',
        stamina: { gte: SP_TRAIN_STAMINA_COST },
        trainingPoints: { gte: tpCost },
        [attrLower]: { lt: 99 }
      },
      data: {
        [attrLower]: { increment: 1 },
        trainingPoints: { decrement: tpCost },
        stamina: { decrement: SP_TRAIN_STAMINA_COST }
      }
    });

    if (updateRes.count === 0) {
      return { success: false, message: '⏳ Upgrade failed: insufficient TP/stamina or request already processed.' };
    }

    const updated = await prisma.player.findUnique({ where: { id: playerId } });
    if (!updated) return { success: false, message: '❌ Player not found.' };

    const discountTag = isKeyStat ? `\n⭐ **Key Stat Advantage:** Saved TP developing your core **${playerStyle.name}** attribute (15% discount applied)!` : '';

    return {
      success: true,
      message:
        `🔬 **Biomechanics Attribute Enhancement Successful!**\n\n` +
        `✨ **${attrMeta.name} (${attrMeta.key.toUpperCase()}):** \`${currentVal}\` ➔ **\`${(updated as any)[attrLower]}\`** (+1)\n` +
        `📉 Cost: **-${tpCost} TP** | **-${SP_TRAIN_STAMINA_COST} ⚡ Stamina**${discountTag}\n` +
        `📊 Remaining: \`${updated.trainingPoints} TP\` | \`${updated.stamina} ⚡ Stamina\``
    };
  });
}

/**
 * 7-Day Playstyle Conversion
 */
export async function convertPlaystyle(playerId: string, newStyleCode: string) {
  return withActionLock(`${playerId}:convertPlaystyle`, async () => {
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
    const cooldownMs = 7 * 24 * 60 * 60 * 1000; // 7 days
    const cutoff = new Date(now.getTime() - cooldownMs);

    if (player.lastConvertedAt) {
      const elapsed = now.getTime() - player.lastConvertedAt.getTime();
      if (elapsed < cooldownMs) {
        const remainingDays = Math.ceil((cooldownMs - elapsed) / (24 * 60 * 60 * 1000));
        return { success: false, message: `⏳ **Conversion Cooldown:** You can only switch playstyles once every 7 days. Remaining: **${remainingDays} days**.` };
      }
    }

    const updateRes = await prisma.player.updateMany({
      where: {
        id: playerId,
        currentLocation: 'rf',
        OR: [
          { lastConvertedAt: null },
          { lastConvertedAt: { lte: cutoff } }
        ]
      },
      data: {
        playstyle: codeUpper,
        position: style.position,
        lastConvertedAt: now
      }
    });

    if (updateRes.count === 0) {
      return { success: false, message: '⏳ Conversion already processed or 7-day cooldown active.' };
    }

    return {
      success: true,
      message:
        `🎭 **Tactical Re-Role Complete!**\n\n` +
        `Now playing as: ${style.emoji} **${style.name} (${style.code})** • Position: **${style.position}**\n` +
        `*${style.description}*\n` +
        `Key Attributes: ${style.keyStats.map(s => `\`${s.toUpperCase()}\``).join(', ')}\n\n` +
        `*(7-day conversion cooldown activated)*`
    };
  });
}

/**
 * Player Sauna Recovery: restores stamina
 */
export async function executeSaunaRecovery(playerId: string) {
  return withActionLock(`${playerId}:recovery`, async () => {
    const player = await prisma.player.findUnique({ where: { id: playerId } });
    if (!player) {
      return { success: false, message: '❌ Player not found. Run `-profile` first.' };
    }

    if (player.currentLocation !== 'ch') {
      return { success: false, message: '❌ You must be at the **🏡 Player Clubhouse** (`-travel ch`) to take a sauna recovery session!' };
    }

    const now = new Date();
    const cooldownMs = 12 * 60 * 60 * 1000; // 12 hours
    const cutoff = new Date(now.getTime() - cooldownMs);

    if (player.lastRecoveryAt) {
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

    const updateRes = await prisma.player.updateMany({
      where: {
        id: playerId,
        currentLocation: 'ch',
        stamina: { lt: 100 },
        OR: [
          { lastRecoveryAt: null },
          { lastRecoveryAt: { lte: cutoff } }
        ]
      },
      data: {
        stamina: newStamina,
        lastRecoveryAt: now
      }
    });

    if (updateRes.count === 0) {
      return { success: false, message: '⏳ Sauna session already claimed or stamina at max.' };
    }

    return {
      success: true,
      message:
        `🧖 **Steam Sauna & Cryotherapy Session Complete!**\n\n` +
        `⚡ Restored: **+${recoveryAmount} Stamina**\n` +
        `🔋 Current Stamina: **${newStamina}/100**\n` +
        `*(12-hour recovery cooldown active)*`
    };
  });
}
