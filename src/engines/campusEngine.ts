import { Guild, GuildMember, EmbedBuilder, PermissionFlagsBits } from 'discord.js';
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

export const ADMIN_COMMANDS = new Set([
  'setup',
  'setupemojis',
  'gitpull',
  'gitpullback',
  'vip',
  'devfund',
  'additem',
  'addvar',
  'prices',
  'setprice',
  'setlimit',
  'teamlimits',
  'lockteam',
  'unlockteam',
  'setupmodrole',
  'setcaptain',
  'setcap',
  'fixtureadmin',
  'seedauction',
  'auctionstart',
  'auctionconfig',
  'auctionend',
  'auctioncancel',
  'auctionhalt',
  'auctionresume',
]);

/**
 * Commands permitted inside live match broadcasting channels (#live-match).
 * Useless economy/career/profile commands (-profile, -daily, -train, etc.) are locked.
 */
export const LIVE_MATCH_ALLOWED_COMMANDS = new Set([
  'livematch',
  'match',
  'friendly',
  'testmatch',
  'batchmatch',
  'tourney',
  'cup',
  'tournament',
  'tactics',
  'lineup',
  'intlineup',
  'clublineup',
  'starting3',
  'setlineup',
  'roster',
  'team',
  'intteam',
  'club',
  'intstats',
  'clubstats',
  'odds',
  'fixtures',
  'bet',
  'mybets',
  ...ADMIN_COMMANDS,
]);

/**
 * Commands permitted inside friendly exhibition channels (#friendly-matches).
 */
export const FRIENDLY_MATCH_ALLOWED_COMMANDS = new Set([
  'friendly',
  'match',
  'livematch',
  'testmatch',
  'tactics',
  'lineup',
  'intlineup',
  'clublineup',
  'starting3',
  'setlineup',
  'roster',
  'team',
  'intteam',
  'club',
  'intstats',
  'clubstats',
  'odds',
  'fixtures',
  'bet',
  'mybets',
  ...ADMIN_COMMANDS,
]);

/**
 * Commands permitted inside general chatter channels (#general, #chat).
 * Game commands are redirected to #bot-cmds.
 */
export const GENERAL_CHAT_ALLOWED_COMMANDS = new Set([
  'help',
  ...ADMIN_COMMANDS,
]);

export function isLiveMatchChannel(channelName: string): boolean {
  const norm = channelName.toLowerCase();
  return (
    norm.includes('live-match') ||
    norm.includes('live_match') ||
    norm.includes('match-zone') ||
    norm.includes('livematch')
  );
}

export function isFriendlyMatchChannel(channelName: string): boolean {
  const norm = channelName.toLowerCase();
  return (
    (norm.includes('friendly') || norm.includes('exhibition')) &&
    !norm.includes('bot-cmd')
  );
}

export function isNewsChannel(channelName: string): boolean {
  const norm = channelName.toLowerCase();
  return (
    (norm.includes('news') || norm.includes('gazette') || norm.includes('announcement')) &&
    !norm.includes('bot-cmd')
  );
}

export function isGeneralChatChannel(channelName: string): boolean {
  const norm = channelName.toLowerCase().replace(/[^a-z0-9-_]/g, '');
  if (norm.includes('vip') || norm.includes('bot-cmd') || norm.includes('command')) return false;
  const generalKeywords = [
    'general',
    'chat',
    'main',
    'main-chat',
    'general-chat',
    'discussion',
    'lounge',
    'talk',
    'chatter',
    'off-topic',
    'hangout',
  ];
  return generalKeywords.some(
    (g) => norm === g || norm.endsWith(`-${g}`) || norm.startsWith(`${g}-`)
  );
}

export function getBotCommandsChannelLink(guild?: Guild | null): string {
  if (!guild?.channels?.cache) return '`#bot-cmds`';
  const cache = guild.channels.cache;
  const botCmds = typeof cache.find === 'function'
    ? cache.find((c: any) => c.isTextBased?.() && c.name?.toLowerCase().includes('bot-cmd'))
    : Array.from(cache.values()).find((c: any) => c.isTextBased?.() && c.name?.toLowerCase().includes('bot-cmd'));
  return botCmds ? `<#${botCmds.id}>` : '`#bot-cmds`';
}

const userLastCommandTime = new Map<string, number>();
const COMMAND_RATE_LIMIT_MS = 2000; // 2.0s anti-spam cooldown

function isUserAdmin(member: GuildMember | null | undefined): boolean {
  if (!member) return false;
  if (member.guild.ownerId === member.id) return true;
  return (
    member.permissions?.has(PermissionFlagsBits.Administrator) ||
    member.permissions?.has(PermissionFlagsBits.ManageGuild) ||
    false
  );
}

export function checkUserRateLimit(userId: string, isAdmin: boolean): { limited: boolean; waitSec?: string } {
  if (isAdmin) return { limited: false };
  const now = Date.now();
  const last = userLastCommandTime.get(userId) || 0;
  const elapsed = now - last;
  if (elapsed < COMMAND_RATE_LIMIT_MS) {
    const waitSec = ((COMMAND_RATE_LIMIT_MS - elapsed) / 1000).toFixed(1);
    return { limited: true, waitSec };
  }
  userLastCommandTime.set(userId, now);
  if (userLastCommandTime.size > 2000) {
    const cutoff = now - 60000;
    for (const [uid, time] of userLastCommandTime.entries()) {
      if (time < cutoff) userLastCommandTime.delete(uid);
    }
  }
  return { limited: false };
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
  member?: GuildMember | null;
}): Promise<{ allowed: boolean; message?: string }> {
  const { cmd, userId, guild, channelId } = options;
  const normalizedCmd = cmd.toLowerCase();
  const member = options.member || (guild ? guild.members.cache.get(userId) : null);
  const isAdmin = isUserAdmin(member);

  // 1. Anti-Spam Command Rate Limiting
  const rateLimit = checkUserRateLimit(userId, isAdmin);
  if (rateLimit.limited) {
    return {
      allowed: false,
      message: `⏳ **Slow down!** Please wait **${rateLimit.waitSec}s** before running another command.`,
    };
  }

  // 2. Channel Lockdown Guards
  if (guild && channelId) {
    const channel = guild.channels.cache.get(channelId);
    const channelName = channel?.name || '';
    const botCmdsLink = getBotCommandsChannelLink(guild);

    // A. Live Match Channel Lockdown (Clean commentary stream; lock -profile, -daily, -train, etc.)
    if (isLiveMatchChannel(channelName)) {
      if (!LIVE_MATCH_ALLOWED_COMMANDS.has(normalizedCmd)) {
        return {
          allowed: false,
          message: `❌ Command \`-${normalizedCmd}\` is locked in <#${channelId}>! Keep this channel clear for live match coverage. Run this command in ${botCmdsLink} or your campus facility.`,
        };
      }
    }

    // B. Friendly Matches Channel Lockdown
    if (isFriendlyMatchChannel(channelName)) {
      if (!FRIENDLY_MATCH_ALLOWED_COMMANDS.has(normalizedCmd)) {
        return {
          allowed: false,
          message: `❌ Command \`-${normalizedCmd}\` is locked in <#${channelId}>! Use this channel for exhibition friendlies & lineups. Run this command in ${botCmdsLink} or your campus facility.`,
        };
      }
    }

    // C. News / Gazette Channel Lockdown
    if (isNewsChannel(channelName)) {
      if (!ADMIN_COMMANDS.has(normalizedCmd)) {
        return {
          allowed: false,
          message: `❌ Bot commands are disabled in <#${channelId}>! This channel is reserved for matchday news and reports. Please use ${botCmdsLink}.`,
        };
      }
    }

    // D. General Chat Channel Lockdown
    if (isGeneralChatChannel(channelName)) {
      if (!GENERAL_CHAT_ALLOWED_COMMANDS.has(normalizedCmd)) {
        return {
          allowed: false,
          message: `❌ Bot commands are restricted in <#${channelId}>! Please use ${botCmdsLink} to run \`-${normalizedCmd}\`.`,
        };
      }
    }
  }

  // 3. Matchday Lockout Guard: Freezes non-exempt commands 30m prior to match until 15m after full-time
  const lockout = await checkMatchdayLockout(normalizedCmd);
  if (lockout.locked) {
    return { allowed: false, message: lockout.message };
  }

  // 4. Commands whitelisted during rookie onboarding (only in valid non-locked channels)
  if (ONBOARDING_WHITELIST.has(normalizedCmd)) {
    return { allowed: true };
  }

  // 5. 2-Step Rookie Onboarding Guard
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

  // 6. Campus Location Check
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
