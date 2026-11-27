import { Guild, GuildMember } from 'discord.js';

export interface RoleSyncInput {
  ovr: number;
  matchesPlayed: number;
  vipTier: number;
}

/**
 * Synchronizes a member's Discord Footballer tier roles (Rookie, Pro, VIP) cleanly without disturbing staff roles.
 */
export async function syncMemberGameRoles(member: GuildMember, input: RoleSyncInput): Promise<void> {
  try {
    const guild = member.guild;
    const rookieRole = guild.roles.cache.find(r => r.name.toLowerCase().includes('rookie footballer'));
    const proRole = guild.roles.cache.find(r => r.name.toLowerCase().includes('pro footballer'));
    const vipRole = guild.roles.cache.find(r => r.name.toLowerCase().includes('vip footballer'));

    const isPro = input.ovr >= 72 && input.matchesPlayed >= 5;
    const isVip = input.vipTier >= 1;

    if (vipRole) {
      if (isVip && !member.roles.cache.has(vipRole.id)) {
        await member.roles.add(vipRole).catch(() => {});
      } else if (!isVip && member.roles.cache.has(vipRole.id)) {
        await member.roles.remove(vipRole).catch(() => {});
      }
    }

    if (isPro && proRole) {
      if (!member.roles.cache.has(proRole.id)) {
        await member.roles.add(proRole).catch(() => {});
      }
      if (rookieRole && member.roles.cache.has(rookieRole.id)) {
        await member.roles.remove(rookieRole).catch(() => {});
      }
    } else if (rookieRole && !member.roles.cache.has(rookieRole.id)) {
      await member.roles.add(rookieRole).catch(() => {});
    }
  } catch {
    // Non-fatal if bot lacks ManageRoles or role hierarchy prevents edit
  }
}

/**
 * Synchronizes a member's National Team Discord role on -joinnation, removing previous nation roles first.
 */
export async function syncMemberNationRole(member: GuildMember, nationName: string): Promise<void> {
  try {
    const guild: Guild = member.guild;
    const knownNations = [
      'netherlands', 'germany', 'portugal', 'spain', 'france',
      'england', 'brazil', 'argentina', 'italy', 'belgium'
    ];
    const targetLower = nationName.toLowerCase();

    for (const role of member.roles.cache.values()) {
      const rn = role.name.toLowerCase();
      if (knownNations.some(n => rn.includes(n)) && !rn.includes(targetLower)) {
        await member.roles.remove(role).catch(() => {});
      }
    }

    const targetRole = guild.roles.cache.find(r => r.name.toLowerCase().includes(targetLower));
    if (targetRole && !member.roles.cache.has(targetRole.id)) {
      await member.roles.add(targetRole).catch(() => {});
    }
  } catch {
    // Non-fatal if bot lacks ManageRoles
  }
}
