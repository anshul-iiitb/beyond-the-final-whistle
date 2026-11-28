import { Message, User } from 'discord.js';
import { prisma } from '../database/prisma.js';

export interface ResolvedTarget {
  id: string;
  username: string;
  user?: User;
}

/**
 * Resolves a Discord User or Player from:
 * 1. A Discord mention: <@123456789> or <@!123456789>
 * 2. A raw Discord Snowflake ID: 123456789012345678
 * 3. A team candidate list matching username / display name
 * 4. A Guild Member username, nickname, or displayName
 * 5. A Database Player username (exact or case-insensitive partial)
 */
export async function resolveTargetUser(
  message: Message,
  rawToken?: string,
  candidates?: Array<{ id: string; username: string }>
): Promise<ResolvedTarget | null> {
  // If no token was passed, check first Discord mention
  if (!rawToken || !rawToken.trim()) {
    const firstMention = message.mentions?.users?.first?.();
    if (firstMention) {
      return { id: firstMention.id, username: firstMention.username, user: firstMention };
    }
    return null;
  }

  const clean = rawToken.trim();

  // 1. Direct mention regex: <@123456> or <@!123456>
  const mentionMatch = clean.match(/^<@!?(\d{17,20})>$/);
  const targetId = mentionMatch ? mentionMatch[1] : /^\d{17,20}$/.test(clean) ? clean : null;

  if (targetId) {
    if (candidates && candidates.length > 0) {
      const matchCandidate = candidates.find((c) => c.id === targetId);
      if (matchCandidate) {
        const u = message.client?.users?.cache?.get(targetId);
        return { id: matchCandidate.id, username: matchCandidate.username, user: u };
      }
    }

    const cachedUser = message.client?.users?.cache?.get(targetId);
    if (cachedUser) {
      return { id: cachedUser.id, username: cachedUser.username, user: cachedUser };
    }

    const fetchedUser = message.client?.users ? await message.client.users.fetch(targetId).catch(() => null) : null;
    if (fetchedUser) {
      return { id: fetchedUser.id, username: fetchedUser.username, user: fetchedUser };
    }

    const dbPlayer = await prisma.player.findUnique({ where: { id: targetId } });
    if (dbPlayer) {
      return { id: dbPlayer.id, username: dbPlayer.username };
    }

    return { id: targetId, username: `User_${targetId.slice(-4)}` };
  }

  const search = clean.toLowerCase();

  // 2. Check candidates pool (e.g. nation players or club players)
  if (candidates && candidates.length > 0) {
    // Exact username match
    const exact = candidates.find((c) => c.username.toLowerCase() === search);
    if (exact) {
      const u = message.client?.users?.cache?.get(exact.id);
      return { id: exact.id, username: exact.username, user: u };
    }

    // Prefix or contains match
    const partial = candidates.find(
      (c) => c.username.toLowerCase().startsWith(search) || c.username.toLowerCase().includes(search)
    );
    if (partial) {
      const u = message.client?.users?.cache?.get(partial.id);
      return { id: partial.id, username: partial.username, user: u };
    }
  }

  // 3. Search Guild Members in cache or fetch
  if (message.guild) {
    const memberMatch = message.guild.members.cache.find(
      (m) =>
        m.user.username.toLowerCase() === search ||
        m.displayName.toLowerCase() === search ||
        m.user.tag.toLowerCase() === search
    );
    if (memberMatch) {
      return { id: memberMatch.id, username: memberMatch.user.username, user: memberMatch.user };
    }

    const partialMember = message.guild.members.cache.find(
      (m) =>
        m.user.username.toLowerCase().startsWith(search) ||
        m.displayName.toLowerCase().startsWith(search)
    );
    if (partialMember) {
      return { id: partialMember.id, username: partialMember.user.username, user: partialMember.user };
    }
  }

  // 4. Search Database Player by username
  const dbExact = await prisma.player.findFirst({
    where: { username: { equals: clean, mode: 'insensitive' } },
  });
  if (dbExact) {
    const u = message.client?.users?.cache?.get(dbExact.id);
    return { id: dbExact.id, username: dbExact.username, user: u };
  }

  const dbPartial = await prisma.player.findFirst({
    where: { username: { contains: clean, mode: 'insensitive' } },
  });
  if (dbPartial) {
    const u = message.client?.users?.cache?.get(dbPartial.id);
    return { id: dbPartial.id, username: dbPartial.username, user: u };
  }

  return null;
}
