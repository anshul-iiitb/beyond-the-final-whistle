import { prisma } from '../database/prisma.js';
import {
  COSMETIC_CATALOG,
  CosmeticDef,
  PROFILE_THEMES,
  ProfileThemeDef,
  getActiveMonthlyCosmetics,
  getCurrentMonthKey
} from '../config/constants.js';
import { formatK } from '../utils/formatHelper.js';

export interface CosmeticActionResult {
  success: boolean;
  message: string;
}

function findCosmeticMatch(catalog: CosmeticDef[], query: string): CosmeticDef | undefined {
  const clean = query.trim().toLowerCase();
  if (!clean) return undefined;
  return catalog.find(
    c => c.key.toLowerCase() === clean || c.name.toLowerCase().includes(clean)
  );
}

/**
 * Shared purchase / VIP monthly claim handler for Global Market Avatar & Banner Boutique.
 */
export async function acquireMonthlyCosmetic(
  playerId: string,
  alias: string,
  mode: 'buy' | 'claim'
): Promise<CosmeticActionResult> {
  const player = await prisma.player.findUnique({
    where: { id: playerId },
    include: { cosmetics: true }
  });

  if (!player) {
    return { success: false, message: '❌ Player not found. Run `-profile` first to register.' };
  }

  if (player.currentLocation !== 'gm') {
    return {
      success: false,
      message: '❌ You must be at the **🛍️ Global Market** (`-travel gm`) to purchase or claim boutique avatars!'
    };
  }

  const activeCatalog = getActiveMonthlyCosmetics();
  const target = findCosmeticMatch(activeCatalog, alias);
  if (!target) {
    const names = activeCatalog.map(c => `\`${c.key}\``).join(', ');
    return {
      success: false,
      message: `❌ Cosmetic \`${alias}\` is not in this month's drop.\n**Available Now:** ${names}`
    };
  }

  if (player.cosmetics.some(c => c.cosmeticKey === target.key)) {
    return {
      success: false,
      message: `ℹ️ You already own **${target.name}**! Equip it anytime with \`-equip ${target.key}\`.`
    };
  }

  const monthKey = getCurrentMonthKey();

  if (mode === 'claim') {
    if (player.vipTier < 1) {
      return {
        success: false,
        message: '👑 Monthly free cosmetic claims require **VIP** status! Otherwise buy it with `-avatarbuy`.'
      };
    }
    if (player.lastVipCosmeticMonth === monthKey) {
      return {
        success: false,
        message: `⏳ You have already claimed your free **VIP Monthly Avatar/Banner** for \`${monthKey}\`!`
      };
    }
  } else if (player.coins < target.cost) {
    return {
      success: false,
      message: `🪙 Insufficient coins! **${target.name}** costs **${formatK(target.cost)} coins** (Your balance: \`${formatK(player.coins)}\`).`
    };
  }

  const equipField = target.kind === 'AVATAR' ? 'equippedAvatar' : 'equippedBanner';

  await prisma.$transaction([
    prisma.player.update({
      where: { id: playerId },
      data: {
        coins: mode === 'buy' ? { decrement: target.cost } : undefined,
        lastVipCosmeticMonth: mode === 'claim' ? monthKey : undefined,
        [equipField]: target.key
      }
    }),
    prisma.playerCosmetic.create({
      data: {
        playerId,
        cosmeticKey: target.key,
        kind: target.kind,
        name: target.name,
        monthKey
      }
    })
  ]);

  const claimBadge = mode === 'claim' ? '👑 **VIP Monthly Pass Claimed (FREE)!**' : `🛍️ **Boutique Purchase Complete!** (-${formatK(target.cost)} coins)`;
  return {
    success: true,
    message:
      `${claimBadge}\n` +
      `${target.emoji} Unlocked & equipped **${target.name}** (\`${target.kind}\`) onto your \`-profile\` header!`
  };
}

/**
 * Equips an owned Avatar or Banner (or clears with "none").
 */
export async function equipOwnedCosmetic(playerId: string, alias: string): Promise<CosmeticActionResult> {
  const clean = alias.trim().toLowerCase();
  if (!clean) {
    return { success: false, message: '❌ Usage: `-equip <alias>` or `-equip none`.' };
  }

  if (clean === 'none' || clean === 'clear' || clean === 'reset') {
    await prisma.player.update({
      where: { id: playerId },
      data: { equippedAvatar: null, equippedBanner: null }
    });
    return { success: true, message: '✅ Unequipped custom avatar and banner from your `-profile`.' };
  }

  const player = await prisma.player.findUnique({
    where: { id: playerId },
    include: { cosmetics: true }
  });
  if (!player) return { success: false, message: '❌ Player not found. Run `-profile` first.' };

  const target = findCosmeticMatch(COSMETIC_CATALOG, clean);
  if (!target) {
    return { success: false, message: `❌ Unknown cosmetic \`${alias}\`. Check your locker with \`-avatar\`.` };
  }

  if (!player.cosmetics.some(c => c.cosmeticKey === target.key)) {
    return { success: false, message: `🔒 You don't own **${target.name}** yet! Buy or claim it in Global Market (\`-travel gm\`).` };
  }

  const field = target.kind === 'AVATAR' ? 'equippedAvatar' : 'equippedBanner';
  await prisma.player.update({
    where: { id: playerId },
    data: { [field]: target.key }
  });

  return {
    success: true,
    message: `✅ Equipped **${target.emoji} ${target.name}** (\`${target.kind}\`) onto your \`-profile\`!`
  };
}

/**
 * Updates player's selected generative canvas profile theme (20 stadium backdrops).
 */
export async function setPlayerProfileTheme(playerId: string, themeAlias: string): Promise<{ success: boolean; message: string; theme?: ProfileThemeDef }> {
  const clean = themeAlias.trim().toLowerCase();
  const theme = PROFILE_THEMES.find(
    t => t.key.toLowerCase() === clean || t.name.toLowerCase().includes(clean)
  );

  if (!theme) {
    return { success: false, message: `❌ Unknown theme \`${themeAlias}\`. Use \`-themes\` to list all 20 backdrops.` };
  }

  const player = await prisma.player.findUnique({ where: { id: playerId } });
  if (!player) {
    return { success: false, message: '❌ Player not found. Run `-profile` first.' };
  }

  await prisma.player.update({
    where: { id: playerId },
    data: { profileTheme: theme.key }
  });

  return {
    success: true,
    theme,
    message: `🎨 **Profile Theme Updated!** Now displaying **${theme.name}** (\`${theme.key}\`) on your \`-profile\` banner!`
  };
}
