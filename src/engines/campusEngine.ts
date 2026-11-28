import { Guild, GuildMember, EmbedBuilder } from 'discord.js';
import { prisma } from '../database/prisma.js';
import { CAMPUS_LOCATIONS, BASE_TRAVEL_COOLDOWN_MINUTES, resolveLocationAlias } from '../config/constants.js';
import { checkMatchdayLockout } from './fixtureEngine.js';

export interface TravelResult {
  success: boolean;
  message: string;
  embed?: EmbedBuilder;
  remainingCooldownSeconds?: number;
}

/**
 * Calculates fastest travel cooldown in minutes for a footballer based on owned vehicles
 */
export async function getPlayerTravelCooldown(playerId: string): Promise<{ cooldownMinutes: number; vehicleName: string }> {
  const vehicles = await prisma.playerVehicle.findMany({ where: { playerId } });
  if (vehicles.length === 0) {
    return { cooldownMinutes: BASE_TRAVEL_COOLDOWN_MINUTES, vehicleName: 'Public Transit / Walking' };
  }

  let fastest = vehicles[0];
  for (const v of vehicles) {
    if (v.cooldownMinutes < fastest.cooldownMinutes) {
      fastest = v;
    }
  }

  return { cooldownMinutes: fastest.cooldownMinutes, vehicleName: fastest.name };
}

/**
 * Canonical mapping from prefix command aliases to required campus location IDs.
 */
export const COMMAND_LOCATION_MAP: Record<string, string> = {
  train: 'tc',
  sptrain: 'rf',
  upgrade: 'rf',
  convert: 'rf',
  recovery: 'ch',
  sauna: 'ch',
  coaching: 'ch',
  coach: 'ch',
  meetgreet: 'ch',
  mg: 'ch',
  buy: 'gm',
  shop: 'gm',
  gm: 'gm',
  market: 'gm',
  showroom: 'gm',
  dealership: 'gm',
  vs: 'gm',
  vehiclebuy: 'gm',
  buycar: 'gm',
  avatar: 'gm',
  avatars: 'gm',
  boutique: 'gm',
  avatarbuy: 'gm',
  avatarclaim: 'gm',
  advert: 'ph',
  sponsor: 'ph',
  intel: 'ih',
  scout: 'ih',
  ah: 'ah',
  auction: 'ah',
  auctions: 'ah',
  bid: 'ah'
};

/**
 * Locks #twitter so regular players can view and vote on tweet embeds via buttons,
 * while only the bot posts new tweets there.
 */
export async function lockTwitterFeedChannel(guild: Guild): Promise<string | null> {
  const twitterCh = guild.channels.cache.find(
    c => c.isTextBased() && c.name.toLowerCase().includes('twitter')
  );
  if (!twitterCh || !('permissionOverwrites' in twitterCh)) return null;

  await twitterCh.permissionOverwrites.edit(guild.roles.everyone.id, {
    ViewChannel: true,
    ReadMessageHistory: true,
    SendMessages: false,
    SendMessagesInThreads: false,
    CreatePublicThreads: false,
    CreatePrivateThreads: false
  }).catch(() => {});

  const botId = guild.client.user?.id;
  if (botId) {
    await twitterCh.permissionOverwrites.edit(botId, {
      ViewChannel: true,
      SendMessages: true,
      EmbedLinks: true,
      AttachFiles: true,
      ReadMessageHistory: true
    }).catch(() => {});
  }

  return twitterCh.id;
}

/**
 * Resolves the Discord channel corresponding to a BTFW campus location ID.
 */
export function findLocationChannel(guild: Guild, locId: string) {
  const loc = CAMPUS_LOCATIONS[locId];
  if (!loc) return undefined;
  const exact = guild.channels.cache.find(c => c.name.toLowerCase().includes(loc.channelName));
  if (exact) return exact;
  if (locId === 'ch') {
    return guild.channels.cache.find(c => {
      const n = c.name.toLowerCase();
      return n.includes('local-club') || n.includes('clubhouse');
    });
  }
  return undefined;
}

export const ONBOARDING_WHITELIST = new Set([
  'playstyle', 'setplaystyle', 'pickplaystyle', 'chooseplaystyle', 'styles', 'roles',
  'joinnation', 'nation', 'nations',
  'profile', 'p', 'bio', 'setdesc',
  'help', 'setup', 'setupemojis', 'gitpull',
  'setcaptain', 'setcap', 'setlimit', 'teamlimits'
]);

/**
 * Validates that a command or facility interaction is executed from its designated
 * campus location (DB `currentLocation`) and corresponding Discord channel.
 */
export async function validateCommandAccess(options: {
  cmd: string;
  userId: string;
  guild?: Guild | null;
  channelId?: string | null;
}): Promise<{ allowed: boolean; message?: string }> {
  const { cmd, userId, guild, channelId } = options;
  const normalizedCmd = cmd.toLowerCase();

  // Matchday Lockout Guard: Freezes non-exempt commands 30m prior to match until 15m after full-time
  const lockout = await checkMatchdayLockout(normalizedCmd);
  if (lockout.locked) {
    return { allowed: false, message: lockout.message };
  }

  // Commands whitelisted during onboarding
  if (ONBOARDING_WHITELIST.has(normalizedCmd)) {
    return { allowed: true };
  }

  // 2-Step Rookie Onboarding Guard
  const player = await prisma.player.findUnique({
    where: { id: userId },
    select: { currentLocation: true, playstyle: true, nationId: true }
  });

  if (!player || !player.playstyle || player.playstyle === 'NONE') {
    return {
      allowed: false,
      message:
        `⚠️ **Onboarding Step 1/2 Required:**\n` +
        `You have no tactical playstyle and no campus location!\n` +
        `Please choose your starting playstyle to enter the Training Ground:\n` +
        `👉 **Run:** \`-playstyle <choice>\` (e.g. \`-playstyle pch\`, \`-playstyle b2b\`, \`-playstyle nnd\`)`
    };
  }

  if (!player.nationId) {
    return {
      allowed: false,
      message:
        `⚠️ **Onboarding Step 2/2 Required:**\n` +
        `You must pledge allegiance to a National Team before using campus facilities!\n` +
        `👉 **Run:** \`-joinnation <alias>\` (e.g. \`-joinnation eng\`, \`-joinnation bra\`) to claim your **+100k coins** bonus and unlock full campus access!`
    };
  }

  const requiredLocId = COMMAND_LOCATION_MAP[normalizedCmd];
  if (!requiredLocId) {
    return { allowed: true };
  }

  const loc = CAMPUS_LOCATIONS[requiredLocId];
  const targetChannel = guild ? findLocationChannel(guild, requiredLocId) : undefined;
  const wrongChannel = Boolean(guild && targetChannel && channelId !== targetChannel.id);

  if (!player) {
    const channelHint = targetChannel ? ` (<#${targetChannel.id}>)` : '';
    if (wrongChannel) {
      return {
        allowed: false,
        message: `❌ You are in the wrong location! Register first with \`-profile\`, then travel to **${loc.emoji} ${loc.name}** (\`-travel ${loc.alias}\`)${channelHint} to use \`-${normalizedCmd}\`.`
      };
    }
    return {
      allowed: false,
      message: `❌ Player not found. Run \`-profile\` first, then travel to **${loc.emoji} ${loc.name}** (\`-travel ${loc.alias}\`) to use \`-${normalizedCmd}\`.`
    };
  }

  const wrongLocation = player.currentLocation !== requiredLocId;
  if (wrongLocation || wrongChannel) {
    const channelHint = targetChannel ? ` (<#${targetChannel.id}>)` : '';
    if (wrongLocation) {
      return {
        allowed: false,
        message: `❌ You are in the wrong location! Travel to **${loc.emoji} ${loc.name}** (\`-travel ${loc.alias}\`)${channelHint} to use \`-${normalizedCmd}\`.`
      };
    }
    return {
      allowed: false,
      message: `❌ You are in the wrong location! Head over to ${targetChannel ? `<#${targetChannel.id}>` : `**${loc.emoji} ${loc.name}**`} (**${loc.emoji} ${loc.name}** • \`-travel ${loc.alias}\`) to use \`-${normalizedCmd}\`.`
    };
  }

  return { allowed: true };
}

/**
 * Shows ONLY the single campus location channel matching activeLocId to a member and hides all others.
 */
export async function syncMemberLocationVisibility(
  guild: Guild,
  memberId: string,
  activeLocId: string
): Promise<void> {
  const targetChannel = findLocationChannel(guild, activeLocId);

  if (targetChannel && 'permissionOverwrites' in targetChannel) {
    await targetChannel.permissionOverwrites.create(memberId, {
      ViewChannel: true,
      SendMessages: true,
      ReadMessageHistory: true
    }).catch(() => {});
  }

  for (const locKey of Object.keys(CAMPUS_LOCATIONS)) {
    if (locKey === activeLocId) continue;
    const ch = findLocationChannel(guild, locKey);
    if (ch && ch.id !== targetChannel?.id && 'permissionOverwrites' in ch) {
      await ch.permissionOverwrites.delete(memberId).catch(() => {});
    }
  }
}

export async function travelToLocation(
  member: GuildMember,
  guild: Guild,
  targetAlias: string
): Promise<TravelResult> {
  const { target: targetLoc, redirectedFrom } = resolveLocationAlias(targetAlias);
  if (!targetLoc) {
    const validCodes = Object.keys(CAMPUS_LOCATIONS).map(k => `\`${k}\` (${CAMPUS_LOCATIONS[k].name})`).join('\n');
    return {
      success: false,
      message: `❌ Invalid location alias \`${targetAlias}\`.\n\n**Available Locations:**\n${validCodes}`
    };
  }

  let player = await prisma.player.findUnique({
    where: { id: member.id },
    include: { vehicles: true }
  });

  if (!player) {
    player = await prisma.player.create({
      data: {
        id: member.id,
        username: member.user.username,
        discriminator: member.user.discriminator !== '0' ? member.user.discriminator : null,
        avatar: member.user.displayAvatarURL(),
        currentLocation: 'none',
        playstyle: 'NONE',
        position: 'ATT'
      },
      include: { vehicles: true }
    });
  }

  if (!player.playstyle || player.playstyle === 'NONE') {
    return {
      success: false,
      message: '❌ You must choose a playstyle before traveling! Run `-playstyle <choice>` to enter the Training Ground.'
    };
  }

  if (player.currentLocation === targetLoc.id) {
    return {
      success: false,
      message: `ℹ️ You are already at **${targetLoc.emoji} ${targetLoc.name}**!`
    };
  }

  const now = new Date();
  if (player.travelUntil && player.travelUntil > now) {
    const diffSeconds = Math.ceil((player.travelUntil.getTime() - now.getTime()) / 1000);
    const mins = Math.floor(diffSeconds / 60);
    const secs = diffSeconds % 60;
    return {
      success: false,
      message: `⏳ **Traveling / Resting:** You must wait **${mins}m ${secs}s** before traveling again.`,
      remainingCooldownSeconds: diffSeconds
    };
  }

  const { cooldownMinutes, vehicleName } = await getPlayerTravelCooldown(member.id);
  const nextTravelTime = new Date(now.getTime() + cooldownMinutes * 60 * 1000);

  const prevLoc = CAMPUS_LOCATIONS[player.currentLocation] || CAMPUS_LOCATIONS.tc;
  await prisma.player.update({
    where: { id: member.id },
    data: {
      currentLocation: targetLoc.id,
      travelUntil: nextTravelTime
    }
  });

  // Attempt Discord Channel Permission updates (Strict single-location travel visibility)
  try {
    await syncMemberLocationVisibility(guild, member.id, targetLoc.id);
  } catch (err) {
    // Non-fatal if bot lacks ManageChannels
  }

  const redirectNote = redirectedFrom
    ? `\n🔄 *Notice: \`-travel ${redirectedFrom}\` has been merged into **${targetLoc.emoji} ${targetLoc.name}** (\`-travel ${targetLoc.id}\`)!*\n`
    : '';

  const embed = new EmbedBuilder()
    .setColor('#22c55e')
    .setTitle(`🚗 Relocated to ${targetLoc.emoji} ${targetLoc.name}`)
    .setDescription(
      `You traveled from **${prevLoc.emoji} ${prevLoc.name}** to **${targetLoc.emoji} ${targetLoc.name}**.${redirectNote}\n\n` +
      `🚘 **Ride Used:** \`${vehicleName}\`\n` +
      `⏱️ **Travel Cooldown:** \`${cooldownMinutes} minutes\`\n\n` +
      `📖 **About this facility:**\n${targetLoc.description}\n\n` +
      `⚡ **Available Activities:**\n${targetLoc.activities.map(a => `• \`${a}\``).join('\n')}`
    )
    .setFooter({ text: 'Beyond The Final Whistle • Spatial Football Campus' })
    .setTimestamp();

  return {
    success: true,
    message: `✅ Relocated to ${targetLoc.name}!`,
    embed
  };
}
