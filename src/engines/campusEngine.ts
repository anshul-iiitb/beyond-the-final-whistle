import { Guild, GuildMember, EmbedBuilder } from 'discord.js';
import { prisma } from '../database/prisma.js';
import { CAMPUS_LOCATIONS, BASE_TRAVEL_COOLDOWN_MINUTES, resolveLocationAlias } from '../config/constants.js';

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
 * Handles spatial travel between the 8 campus facilities
 */
/**
 * Resolves the Discord channel corresponding to a BTFW campus location ID.
 */
export function findLocationChannel(guild: Guild, locId: string) {
  const loc = CAMPUS_LOCATIONS[locId];
  if (!loc) return undefined;
  return guild.channels.cache.find(c => {
    const n = c.name.toLowerCase();
    if (n.includes(loc.channelName)) return true;
    if (locId === 'ch' && (n.includes('local-club') || n.includes('clubhouse'))) return true;
    return false;
  });
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
        currentLocation: 'tc'
      },
      include: { vehicles: true }
    });
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
