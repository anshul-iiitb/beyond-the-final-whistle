import { Message, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, User, Guild, AttachmentBuilder, Client } from 'discord.js';
import { prisma } from '../database/prisma.js';
import {
  CAMPUS_LOCATIONS,
  PLAYSTYLES,
  ITEM_CATALOG,
  VEHICLE_CATALOG,
  COSMETIC_CATALOG,
  PROFILE_THEMES,
  resolveVehicleSprite
} from '../config/constants.js';
import { calculateDerivedRatings } from '../engines/matchSimulationEngine.js';
import { giveMoney } from '../engines/socialEngine.js';
import { generatePlayerProfileCard, ProfileCollectableVisual } from '../utils/chartHelper.js';
import { renderLeaderboardCanvas, renderPlayerStatCanvas, renderPlayerBiomechanicsCanvas, LeaderboardEntryData } from '../utils/themeRenderers.js';
import { sendThinkingMessage, updateLoadingMessage } from '../utils/loadingHelper.js';
import { formatK, parseCoinAmount, getNationFlag } from '../utils/formatHelper.js';
import { getEmoji } from '../utils/emojiHelper.js';
import { THEME_COLORS, UI, makeProgressBar, subtext } from '../utils/themeHelper.js';

export function computeSeasonRank(ovr: number, matchesPlayed: number): string {
  if (ovr >= 88 && matchesPlayed >= 50) return 'Legendary';
  if (ovr >= 80 && matchesPlayed >= 20) return 'World Class';
  if (ovr >= 72 && matchesPlayed >= 5) return 'Pro';
  return 'Rookie';
}

export function getUnlockedMilestones(player: any): string[] {
  const badges: string[] = [];
  if ((player.goalsScored || 0) >= 100) badges.push('100 GOALS');
  if ((player.possessionWon || 0) >= 600) badges.push('600 POSS WON');
  if ((player.motmCount || 0) >= 50) badges.push('50 MVPs');
  if ((player.matchesPlayed || 0) >= 200) badges.push('200 CAPS');
  if ((player.cleanSheets || 0) >= 50) badges.push('50 CLEAN SHEETS');
  if ((player.inventory || []).some((i: any) => String(i.itemKey || '').includes('worldcup'))) {
    badges.push('WORLD CHAMPION');
  }
  return badges;
}

export async function buildProfileBannerAttachment(player: any, targetUser: User): Promise<AttachmentBuilder> {
  const derived = calculateDerivedRatings(player);
  const ovr = Math.round((derived.atk + derived.mid + derived.def) / 3);
  const seasonRank = computeSeasonRank(ovr, player.matchesPlayed || 0);
  const milestones = getUnlockedMilestones(player);
  const style = PLAYSTYLES[player.playstyle] || PLAYSTYLES.PCH;

  const collectables: ProfileCollectableVisual[] = [];

  for (const v of player.vehicles || []) {
    const vDef = VEHICLE_CATALOG.find(cat => cat.key === v.vehicleKey);
    const { spriteMode, spritePrefix } = resolveVehicleSprite(v.vehicleKey, vDef?.emoji || '');
    collectables.push({
      label: v.name,
      spriteMode: vDef || spriteMode === 'full' ? spriteMode : 'single',
      spriteKey: vDef || spriteMode === 'full' ? spritePrefix : 'car'
    });
  }

  for (const item of player.inventory || []) {
    const k = String(item.itemKey || '').toLowerCase();
    const spriteKey = k.includes('worldcup')
      ? 'worldcup'
      : k.includes('boot')
        ? 'goldenboot'
        : k.includes('silver')
          ? 'silvermedal'
          : 'goldmedal';
    collectables.push({ label: item.name, spriteMode: 'single', spriteKey });
  }

  const buffer = await generatePlayerProfileCard({
    username: player.username || targetUser.username,
    avatarUrl: targetUser.displayAvatarURL({ extension: 'png', size: 256 }),
    clubName: player.club?.name || 'Free Agent',
    nationName: player.nation?.name || 'Free Agent',
    ovr,
    atk: derived.atk,
    mid: derived.mid,
    def: derived.def,
    seasonRank,
    vipTier: player.vipTier || 0,
    themeKey: player.profileTheme,
    equippedAvatar: player.equippedAvatar,
    equippedBanner: player.equippedBanner,
    milestones,
    playstyleName: style.name,
    position: style.position,
    coins: player.coins ?? 0n,
    followers: player.followers ?? 0n,
    trainingPoints: player.trainingPoints || 0,
    matchesPlayed: player.matchesPlayed || 0,
    goalsScored: player.goalsScored || 0,
    assists: player.assists || 0,
    yellowCards: player.yellowCards || 0,
    redCards: player.redCards || 0,
    cleanSheets: player.cleanSheets || 0,
    motmCount: player.motmCount || 0,
    collectables
  });

  return new AttachmentBuilder(buffer, { name: 'profile_banner.png' });
}

export async function buildPlayerStatCardAttachment(
  player: any,
  targetUser: User,
  mode: 'career' | 'int' | 'club' = 'career'
): Promise<AttachmentBuilder> {
  const derived = calculateDerivedRatings(player);
  const ovr = Math.round((derived.atk + derived.mid + derived.def) / 3);
  const seasonRank = computeSeasonRank(ovr, player.matchesPlayed || 0);
  const milestones = getUnlockedMilestones(player);

  let recentForm = ['6.8', '7.2', '7.5', '8.0', '7.4'];
  try {
    const parsed = JSON.parse(player.recentRatings || '[]');
    if (Array.isArray(parsed) && parsed.length > 0) {
      recentForm = parsed.map((n: number) => n.toFixed(1));
    }
  } catch {}

  const passPct = player.passesAttempted > 0
    ? `${Math.round((player.passesCompleted / player.passesAttempted) * 100)}%`
    : '0%';

  const titleMap = {
    career: 'MATCH TELEMETRY DOSSIER',
    int: 'INTERNATIONAL CAREER CARD',
    club: 'CLUB FRANCHISE CARD'
  };

  const buf = await renderPlayerStatCanvas({
    titleTag: titleMap[mode],
    username: player.username || targetUser.username,
    clubAndNation: `${player.club?.name || 'Free Agent'}  •  ${player.nation?.name || 'Free Agent'}`,
    seasonRank,
    vipTier: player.vipTier || 0,
    avatarUrl: targetUser.displayAvatarURL({ extension: 'png', size: 256 }),
    ovr,
    atk: derived.atk,
    mid: derived.mid,
    def: derived.def,
    themeKey: player.profileTheme,
    recentForm,
    milestones,
    footerSummary: `BOOTS: ${player.activeBoots ? player.activeBoots.toUpperCase() : 'STANDARD'}  •  INTEL: ${player.intelBonus > 0 ? '+' + player.intelBonus : 'NONE'}  •  COINS: ${formatK(player.coins)}`,
    stats: [
      { label: 'CAPS (W-D-L)', value: `${player.matchesPlayed} (${player.wins || 0}-${player.draws || 0}-${player.losses || 0})` },
      { label: 'GOALS / ASSISTS', value: `${player.goalsScored}G / ${player.assists}A`, highlight: true },
      { label: 'SHOTS (ON TARGET)', value: `${player.shots} (${player.shotsOnTarget})` },
      { label: 'PASSING (ACC)', value: `${player.passesCompleted} (${passPct})` },
      { label: 'KEY PASS / DRIB', value: `${player.keyPasses} / ${player.dribblesCompleted}` },
      { label: 'TACKLES / INT', value: `${player.tacklesWon} / ${player.interceptions}` },
      { label: 'POSS WON / LOST', value: `${player.possessionWon || 0} / ${player.possessionLost || 0}` },
      { label: 'FOULS COMM / EARN', value: `${player.foulsCommitted || 0} / ${player.foulsEarned || 0}` },
      { label: 'SAVES / CLEAN SH', value: `${player.savesMade || 0} / ${player.cleanSheets}` },
      { label: 'PEN SCORED / SAV', value: `${player.penaltiesScored || 0} / ${player.penaltiesSaved || 0}` },
      { label: 'CARDS (Y / R)', value: `${player.yellowCards} / ${player.redCards}` },
      { label: 'MOTM AWARDS', value: `${player.motmCount}`, highlight: true }
    ]
  });

  return new AttachmentBuilder(buf, { name: 'player_stat_card.png' });
}

export async function buildPlayerBiomechanicsAttachment(player: any, targetUser: User): Promise<AttachmentBuilder> {
  const derived = calculateDerivedRatings(player);
  const ovr = Math.round((derived.atk + derived.mid + derived.def) / 3);
  const seasonRank = computeSeasonRank(ovr, player.matchesPlayed || 0);
  const style = PLAYSTYLES[player.playstyle] || PLAYSTYLES.PCH;

  const buf = await renderPlayerBiomechanicsCanvas({
    username: player.username || targetUser.username,
    clubAndNation: `${player.club?.name || 'Free Agent'}  •  ${player.nation?.name || 'Free Agent'}`,
    seasonRank,
    vipTier: player.vipTier || 0,
    avatarUrl: targetUser.displayAvatarURL({ extension: 'png', size: 256 }),
    playstyleCode: style.code,
    playstyleName: style.name,
    position: style.position,
    keyStats: style.keyStats,
    trainingPoints: player.trainingPoints || 0,
    ovr,
    atk: derived.atk,
    mid: derived.mid,
    def: derived.def,
    bootsSummary: player.activeBoots ? `${player.activeBoots.toUpperCase()} (+10)` : 'STANDARD',
    intelSummary: player.intelBonus > 0 ? `+${player.intelBonus} ${(player.intelStat || 'BOOST').toUpperCase()}` : 'NONE',
    themeKey: player.profileTheme,
    attributes: {
      fin: player.fin,
      pow: player.pow,
      hea: player.hea,
      pas: player.pas,
      vis: player.vis,
      cro: player.cro,
      dri: player.dri,
      tck: player.tck,
      int: player.int,
      mrk: player.mrk,
      pac: player.pac,
      phy: player.phy,
      cmp: player.cmp,
      agi: player.agi,
      wrk: player.wrk,
    },
  });

  return new AttachmentBuilder(buf, { name: 'biomechanics_card.png' });
}

export function buildProfileTabsRow(targetUserId: string, currentTab: 'main' | 'stats' | 'attr') {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`profile_main_${targetUserId}`)
      .setLabel('Overview')
      .setEmoji('👤')
      .setStyle(currentTab === 'main' ? ButtonStyle.Primary : ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`profile_stats_${targetUserId}`)
      .setLabel('Match Telemetry')
      .setEmoji('📊')
      .setStyle(currentTab === 'stats' ? ButtonStyle.Primary : ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`profile_attr_${targetUserId}`)
      .setLabel('Biomechanics (15)')
      .setEmoji('🎯')
      .setStyle(currentTab === 'attr' ? ButtonStyle.Primary : ButtonStyle.Secondary)
  );
}

export function buildProfileEmbed(
  player: any,
  targetUser: User,
  tab: 'main' | 'stats' | 'attr' = 'main',
  guild?: Guild | null
): EmbedBuilder {
  const derived = calculateDerivedRatings(player);
  const loc = CAMPUS_LOCATIONS[player.currentLocation] || CAMPUS_LOCATIONS.tc;
  const style = PLAYSTYLES[player.playstyle] || PLAYSTYLES.PCH;
  const flag = getNationFlag(player.nation);
  const isVip = player.vipTier >= 1;
  const vipBadge = isVip ? '👑 `[ VIP ]`' : '';
  const staminaEmoji = getEmoji(guild, 'stamina');
  const coinEmoji = getEmoji(guild, 'coin');
  const tpEmoji = getEmoji(guild, 'tp');
  const followersEmoji = getEmoji(guild, 'followers');
  const carEmoji = getEmoji(guild, 'car');

  let recentForm = ['6.8', '7.2', '7.5', '8.0', '7.4'];
  try {
    const parsed = JSON.parse(player.recentRatings || '[]');
    if (Array.isArray(parsed) && parsed.length > 0) {
      recentForm = parsed.map((n: number) => n.toFixed(1));
    }
  } catch {}

  // Collectables display (actual car & relic sprites cleanly side-by-side)
  const itemSymbols = (player.inventory || []).map((i: any) => i.emoji);
  const vehicleSymbols = (player.vehicles || []).map((v: any) => {
    const vDef = VEHICLE_CATALOG.find(cat => cat.key === v.vehicleKey);
    return vDef?.emoji || carEmoji;
  });
  const allCollectables = [...vehicleSymbols, ...itemSymbols];
  const collectablesDisplay = allCollectables.length > 0
    ? allCollectables.join(' ')
    : '*None yet — browse `-showroom` & `-ah`*';
  const motmEmoji = getEmoji(guild, 'motm');

  const thumbUrl = targetUser.displayAvatarURL?.() || null;

  if (tab === 'main') {
    const ovr = Math.round((derived.atk + derived.mid + derived.def) / 3);
    const seasonRank = computeSeasonRank(ovr, player.matchesPlayed || 0);
    const color = isVip ? THEME_COLORS.GOLD : THEME_COLORS.PRIMARY;
    const themeObj = PROFILE_THEMES.find(t => t.key === player.profileTheme) || PROFILE_THEMES[0];
    const bootsLabel = player.activeBoots ? `${player.activeBoots.toUpperCase()} (+10)` : 'Standard';
    const intelLabel = player.intelBonus > 0 ? `+${player.intelBonus} ${player.intelStat || 'Boost'}` : 'None';

    return new EmbedBuilder()
      .setColor(color)
      .setTitle(`⚽ ${player.username} ${flag}'s Profile! ${vipBadge}`.trim())
      .setThumbnail(thumbUrl)
      .setDescription(
        `*${player.bio || 'Rising football prodigy aiming for the World Cup trophy.'}*\n\n` +
        `### 🛡️ Team Stats\n` +
        `**National Team :** ${flag} ${player.nation?.name || 'Free Agent'} (\`-joinnation\`)\n` +
        `**Club Team :** ${player.club?.name || 'Free Agent'}\n` +
        `**Location :** ${loc.emoji} ${loc.name} (\`-travel ${loc.alias}\`)\n\n` +
        `### 📊 Individual Stats\n` +
        `**Total Appearances :** ${player.matchesPlayed || 0} 🎯\n` +
        `**Goals Scored :** ${player.goalsScored || 0} ⚽  •  **Assists :** ${player.assists || 0} 👟\n` +
        `**Yellow Cards :** ${player.yellowCards || 0} 🟨  •  **Red Cards :** ${player.redCards || 0} 🟥\n` +
        `**Clean Sheets :** ${player.cleanSheets || 0} 🧤  •  **MOTM Awards :** ${player.motmCount || 0} ${motmEmoji}\n\n` +
        `### 📈 Recent Form\n` +
        `**Last 5 Match Ratings :** ${recentForm.join(' | ')} ⭐\n\n` +
        `### ⚡ Player Attributes\n` +
        `**Playstyle :** ${style.emoji} ${style.name} (${style.code}) • ${style.position}\n` +
        `**Ratings :** ATK **${derived.atk}** | MID **${derived.mid}** | DEF **${derived.def}** | OVR **${ovr}**\n` +
        `**Stamina :** ${staminaEmoji} ${player.stamina}/100  •  **Training Points :** ${tpEmoji} ${player.trainingPoints}\n` +
        `**Loadout :** 👟 ${bootsLabel}  •  🛰️ ${intelLabel}\n\n` +
        `### 💰 Followers and Wealth\n` +
        `**Followers :** ${formatK(player.followers)} ${followersEmoji}\n` +
        `**Coins :** ${formatK(player.coins)} ${coinEmoji}\n\n` +
        `### 🎁 Collectables\n` +
        `${collectablesDisplay}\n` +
        subtext(`🎨 ${themeObj.name} • 🏆 ${seasonRank} Tier • Switch theme with -theme`)
      )
      .setImage('attachment://profile_banner.png')
      .setFooter({ text: `Used by ${player.username} • Beyond The Final Whistle • Tab 1/3` })
      .setTimestamp();
  }

  if (tab === 'stats') {
    const ovr = Math.round((derived.atk + derived.mid + derived.def) / 3);
    const seasonRank = computeSeasonRank(ovr, player.matchesPlayed || 0);
    const milestones = getUnlockedMilestones(player);
    const gaTotal = (player.goalsScored || 0) + (player.assists || 0);
    const wins = player.wins || 0;
    const draws = player.draws || 0;
    const losses = player.losses || 0;
    const passPct = player.passesAttempted > 0
      ? Math.round((player.passesCompleted / player.passesAttempted) * 100)
      : 0;

    return new EmbedBuilder()
      .setColor(THEME_COLORS.TURF)
      .setTitle(`📊 Detailed Statistics — ${player.username} ${flag}`)
      .setThumbnail(thumbUrl)
      .setDescription(
        `🏅 **Season Rank:** ${seasonRank}  •  🎖️ **Record (W-D-L):** ${wins}-${draws}-${losses}  •  🔥 **Total G/A:** ${gaTotal}\n` +
        (milestones.length > 0 ? `🏆 **Milestones:** ${milestones.join(' • ')}\n` : '') +
        `\n**⚔️ Attacking & Passing**\n` +
        `**Shots :** ${player.shots || 0} (${player.shotsOnTarget || 0} on target)\n` +
        `**Passes Completed :** ${player.passesCompleted || 0} / ${player.passesAttempted || 0} (${passPct}%)\n` +
        `**Key Passes :** ${player.keyPasses || 0}  •  **Second Assists :** ${player.secondAssists || 0}\n` +
        `**Dribbles Won :** ${player.dribblesCompleted || 0} / ${player.dribblesAttempted || 0}\n\n` +
        `**🛡️ Defending & Discipline**\n` +
        `**Tackles Won :** ${player.tacklesWon || 0} / ${player.tacklesAttempted || 0}  •  **Interceptions :** ${player.interceptions || 0}\n` +
        `**Clearances :** ${player.clearances || 0}  •  **Possession W/L :** ${player.possessionWon || 0} / ${player.possessionLost || 0}\n` +
        `**Fouls Comm / Earned :** ${player.foulsCommitted || 0} / ${player.foulsEarned || 0}\n` +
        `**Saves / Clean Sheets :** ${player.savesMade || 0} / ${player.cleanSheets || 0}\n` +
        `**Penalties Scored / Saved :** ${player.penaltiesScored || 0} / ${player.penaltiesSaved || 0}`
      )
      .setImage('attachment://player_stat_card.png')
      .setFooter({ text: `Used by ${player.username} • Match Telemetry • Tab 2/3` })
      .setTimestamp();
  }

  // Attributes tab (WITS-inspired crisp bars + Neon Hexagon Radar card)
  const ovr = Math.round((derived.atk + derived.mid + derived.def) / 3);
  const seasonRank = computeSeasonRank(ovr, player.matchesPlayed || 0);
  const fmtBarRow = (code: string, name: string, val: number) => {
    const bar = makeProgressBar(val, 99, 10, '█', '░');
    return `\`${code.padEnd(3)} ${name.padEnd(13)} ${String(val).padStart(2)} [${bar}]\``;
  };

  return new EmbedBuilder()
    .setColor(THEME_COLORS.CYAN)
    .setTitle(`📊 ${player.username} ${flag}'s Player Attributes`)
    .setThumbnail(thumbUrl)
    .setDescription(
      `**Playstyle :** ${style.emoji} ${style.name} (${style.code})\n` +
      `*${style.description}*\n` +
      `• **Key Stats :** ${style.keyStats.map(s => s.toUpperCase()).join(', ')}\n` +
      `• **Derived Ratings :** ATK ${derived.atk} | MID ${derived.mid} | DEF ${derived.def} | OVR ${ovr} (${seasonRank})\n` +
      `• **TP Available :** ${tpEmoji} ${player.trainingPoints} TP\n\n` +
      `🔴 **Attacking**\n` +
      `${fmtBarRow('FIN', 'Finishing', player.fin)}\n` +
      `${fmtBarRow('POW', 'Shot Power', player.pow)}\n` +
      `${fmtBarRow('HEA', 'Heading', player.hea)}\n\n` +
      `🔵 **Technical**\n` +
      `${fmtBarRow('PAS', 'Passing', player.pas)}\n` +
      `${fmtBarRow('VIS', 'Vision', player.vis)}\n` +
      `${fmtBarRow('CRO', 'Crossing', player.cro)}\n` +
      `${fmtBarRow('DRI', 'Dribbling', player.dri)}\n\n` +
      `🟢 **Defending**\n` +
      `${fmtBarRow('TCK', 'Tackling', player.tck)}\n` +
      `${fmtBarRow('INT', 'Interceptions', player.int)}\n` +
      `${fmtBarRow('MRK', 'Marking', player.mrk)}\n\n` +
      `🟡 **Physical & Mental**\n` +
      `${fmtBarRow('PAC', 'Pace', player.pac)}\n` +
      `${fmtBarRow('PHY', 'Physicality', player.phy)}\n` +
      `${fmtBarRow('CMP', 'Composure', player.cmp)}\n` +
      `${fmtBarRow('AGI', 'Agility', player.agi)}\n` +
      `${fmtBarRow('WRK', 'Work Rate', player.wrk)}\n` +
      subtext('🔬 Upgrade stats at Research Facility: `-travel rf` ➔ `-sptrain <attr>`')
    )
    .setImage('attachment://biomechanics_card.png')
    .setFooter({ text: `Used by ${player.username} • Biomechanics Matrix • Tab 3/3` })
    .setTimestamp();
}

/**
 * Handles -profile [@user]
 */
export async function handleProfileCommand(message: Message, args: string[]) {
  const targetUser = message.mentions.users.first() || message.author;
  const thinkingMsg = await sendThinkingMessage(message, 'Compiling Career Dossier & Studio Card...');

  try {
    let player = await prisma.player.findUnique({
      where: { id: targetUser.id },
      include: { vehicles: true, nation: true, club: true, inventory: true }
    });

    if (!player && targetUser.id === message.author.id) {
      player = await prisma.player.create({
        data: {
          id: message.author.id,
          username: message.author.username,
          discriminator: message.author.discriminator !== '0' ? message.author.discriminator : null,
          avatar: message.author.displayAvatarURL(),
          currentLocation: 'tc'
        },
        include: { vehicles: true, nation: true, club: true, inventory: true }
      });
    }

    if (!player) {
      return await updateLoadingMessage(thinkingMsg, {
        content: '❌ That player has not registered on Beyond The Final Whistle yet.',
        embeds: [],
        files: []
      });
    }

    const embed = buildProfileEmbed(player, targetUser, 'main', message.guild);
    const row = buildProfileTabsRow(targetUser.id, 'main');
    const bannerAttachment = await buildProfileBannerAttachment(player, targetUser);

    await updateLoadingMessage(thinkingMsg, {
      embeds: [embed],
      files: [bannerAttachment],
      components: [row]
    });
  } catch (err) {
    await updateLoadingMessage(thinkingMsg, {
      content: '❌ Failed to render player dossier.',
      embeds: [],
      files: []
    });
  }
}

export async function handleSetDescCommand(message: Message, args: string[]) {
  const newBio = args.join(' ').trim();
  if (!newBio) {
    return await message.reply('❌ Usage: `-setdesc <text>` (Max 100 characters)');
  }

  if (newBio.length > 100) {
    return await message.reply(`❌ Description too long (${newBio.length}/100 max characters).`);
  }

  await prisma.player.upsert({
    where: { id: message.author.id },
    update: { bio: newBio },
    create: {
      id: message.author.id,
      username: message.author.username,
      bio: newBio
    }
  });

  await message.reply(`✅ Updated profile description to: *"${newBio}"*`);
}

export async function handleGiveCommand(message: Message, args: string[]) {
  const targetUser = message.mentions.users.first();
  const amountStr = args.find(a => !a.startsWith('<@'));

  if (!targetUser || !amountStr) {
    return await message.reply('❌ Usage: `-give @user <amount>` (e.g. `-give @teammate 50k`)');
  }

  const amount = parseCoinAmount(amountStr);
  if (!amount || amount <= 0n) {
    return await message.reply('❌ Invalid amount. Examples: `50000`, `50k`, `1.5m`.');
  }

  const result = await giveMoney(message.author.id, targetUser.id, amount);
  await message.reply(result.message);
}

export type LeaderboardCategory = 'ovr' | 'goals' | 'wealth' | 'followers';

export function normalizeLeaderboardCategory(raw?: string): LeaderboardCategory {
  const c = (raw || 'ovr').toLowerCase();
  if (c === 'goals' || c === 'g') return 'goals';
  if (c === 'wealth' || c === 'money' || c === 'coins') return 'wealth';
  if (c === 'followers' || c === 'fans') return 'followers';
  return 'ovr';
}

export function buildLeaderboardTabsRow(active: LeaderboardCategory) {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('lb_ovr')
      .setLabel('OVR Ratings')
      .setEmoji('🏆')
      .setStyle(active === 'ovr' ? ButtonStyle.Primary : ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('lb_goals')
      .setLabel('Goals')
      .setEmoji('⚽')
      .setStyle(active === 'goals' ? ButtonStyle.Primary : ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('lb_wealth')
      .setLabel('Wealth')
      .setEmoji('🪙')
      .setStyle(active === 'wealth' ? ButtonStyle.Primary : ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('lb_followers')
      .setLabel('Followers')
      .setEmoji('👥')
      .setStyle(active === 'followers' ? ButtonStyle.Primary : ButtonStyle.Secondary)
  );
}

export async function buildLeaderboardPayload(
  category: LeaderboardCategory,
  callerId: string,
  guild?: Guild | null,
  client?: Client
) {
  const coinEmoji = getEmoji(guild, 'coin');
  const callerRecord = await prisma.player.findUnique({ where: { id: callerId }, select: { profileTheme: true } });

  const resolveAvatarUrl = (p: any): string | null => {
    const cached = client?.users.cache.get(p.id)?.displayAvatarURL({ extension: 'png', size: 128 });
    if (cached) return cached;
    if (p.avatar && typeof p.avatar === 'string' && p.avatar.startsWith('http')) {
      return p.avatar.replace(/\.\w+(\?|$)/, '.png$1');
    }
    return null;
  };

  let title = 'WORLD OVERALL RATINGS LEADERBOARD';
  let subtitle = 'TOP 10 GLOBAL FOOTBALLERS • OVR RANKINGS';
  let metricHeader = 'OVR';
  let embedColor: number = THEME_COLORS.PRIMARY;
  let entries: LeaderboardEntryData[] = [];
  let callerSummary = '';
  let quickList = '';

  if (category === 'goals') {
    title = 'WORLD GOLDEN BOOT LEADERBOARD';
    subtitle = 'TOP 10 CAREER GOALSCORERS • ALL COMPETITIONS';
    metricHeader = 'GOALS';
    embedColor = THEME_COLORS.GOLD;
    const leaders = await prisma.player.findMany({
      orderBy: { goalsScored: 'desc' },
      take: 10,
      include: { nation: true, club: true }
    });
    entries = leaders.map((p, i) => ({
      rank: i + 1,
      userId: p.id,
      username: p.username,
      clubTag: `${p.club?.name || 'Free Agent'} • ${p.nation?.name || 'Global'}`,
      avatarUrl: resolveAvatarUrl(p),
      valueText: `${p.goalsScored} Goals`,
      isCaller: p.id === callerId
    }));
    const top3 = leaders.slice(0, 3).map((p, i) => `${['🥇', '🥈', '🥉'][i]} **${p.username}** — \`${p.goalsScored}\``).join('\n');
    quickList = top3 || 'No goals recorded yet.';
  } else if (category === 'wealth') {
    title = 'WORLD NET WORTH LEADERBOARD';
    subtitle = 'TOP 10 RICHEST FOOTBALLERS • TREASURY STANDINGS';
    metricHeader = 'WEALTH';
    embedColor = THEME_COLORS.EMERALD;
    const leaders = await prisma.player.findMany({
      orderBy: { coins: 'desc' },
      take: 10,
      include: { nation: true, club: true }
    });
    entries = leaders.map((p, i) => ({
      rank: i + 1,
      userId: p.id,
      username: p.username,
      clubTag: `${p.club?.name || 'Free Agent'} • ${p.nation?.name || 'Global'}`,
      avatarUrl: resolveAvatarUrl(p),
      valueText: formatK(p.coins),
      isCaller: p.id === callerId
    }));
    const top3 = leaders.slice(0, 3).map((p, i) => `${['🥇', '🥈', '🥉'][i]} **${p.username}** — \`${formatK(p.coins)}\` ${coinEmoji}`).join('\n');
    quickList = top3 || 'No wealth recorded yet.';
  } else if (category === 'followers') {
    title = 'GLOBAL CLOUT LEADERBOARD';
    subtitle = 'TOP 10 MOST FOLLOWED STARS • FAN STANDINGS';
    metricHeader = 'FANS';
    embedColor = THEME_COLORS.PURPLE;
    const leaders = await prisma.player.findMany({
      orderBy: { followers: 'desc' },
      take: 10,
      include: { nation: true, club: true }
    });
    entries = leaders.map((p, i) => ({
      rank: i + 1,
      userId: p.id,
      username: p.username,
      clubTag: `${p.club?.name || 'Free Agent'} • ${p.nation?.name || 'Global'}`,
      avatarUrl: resolveAvatarUrl(p),
      valueText: formatK(p.followers),
      isCaller: p.id === callerId
    }));
    const top3 = leaders.slice(0, 3).map((p, i) => `${['🥇', '🥈', '🥉'][i]} **${p.username}** — \`${formatK(p.followers)}\``).join('\n');
    quickList = top3 || 'No players found.';
  } else {
    const allPlayers = await prisma.player.findMany({
      include: { nation: true, club: true },
      take: 150
    });
    const ranked = allPlayers
      .map(p => {
        const d = calculateDerivedRatings(p);
        const ovr = Math.round((d.atk + d.mid + d.def) / 3);
        return { player: p, ovr, derived: d };
      })
      .sort((a, b) => b.ovr - a.ovr);

    const callerIdx = ranked.findIndex(r => r.player.id === callerId);
    if (callerIdx >= 0) {
      const c = ranked[callerIdx];
      callerSummary = `YOUR STANDING: RANK #${callerIdx + 1}  •  ${c.ovr} OVR (ATK ${c.derived.atk} | MID ${c.derived.mid} | DEF ${c.derived.def})`;
    }

    const top10 = ranked.slice(0, 10);
    entries = top10.map((s, i) => ({
      rank: i + 1,
      userId: s.player.id,
      username: s.player.username,
      clubTag: `${s.player.club?.name || 'Free Agent'} • A:${s.derived.atk} M:${s.derived.mid} D:${s.derived.def}`,
      avatarUrl: resolveAvatarUrl(s.player),
      valueText: `${s.ovr} OVR`,
      isCaller: s.player.id === callerId
    }));
    const top3 = top10.slice(0, 3).map((s, i) => `${['🥇', '🥈', '🥉'][i]} **${s.player.username}** — \`${s.ovr} OVR\``).join('\n');
    quickList = top3 || 'No players ranked yet.';
  }

  if (!callerSummary) {
    const inTop = entries.find(e => e.isCaller);
    callerSummary = inTop
      ? `YOUR STANDING: RANK #${inTop.rank}  •  ${inTop.valueText}`
      : 'SWITCH CATEGORIES BELOW  •  BUILD STATS TO CLIMB INTO THE TOP 10';
  }

  const cardBuf = await renderLeaderboardCanvas({
    title,
    subtitle,
    metricHeader,
    entries,
    callerSummary,
    themeKey: callerRecord?.profileTheme
  });
  const file = new AttachmentBuilder(cardBuf, { name: 'leaderboard.png' });

  const embed = new EmbedBuilder()
    .setColor(embedColor)
    .setTitle(`🏆 ${title}`)
    .setDescription(
      `${quickList}\n` +
      subtext('💡 Switch leaderboards live using the buttons below or `-lb goals` / `-lb wealth` / `-lb followers`.')
    )
    .setImage('attachment://leaderboard.png')
    .setFooter({ text: 'Beyond The Final Whistle • Official Global Standings' })
    .setTimestamp();

  return {
    embed,
    files: [file],
    components: [buildLeaderboardTabsRow(category)]
  };
}

export async function handleLeaderboardCommand(message: Message, args: string[]) {
  const category = normalizeLeaderboardCategory(args[0]);
  const thinkingMsg = await sendThinkingMessage(message, 'Compiling Official Global Standings...');

  try {
    const payload = await buildLeaderboardPayload(category, message.author.id, message.guild, message.client);
    await updateLoadingMessage(thinkingMsg, {
      embeds: [payload.embed],
      files: payload.files,
      components: payload.components
    });
  } catch {
    await updateLoadingMessage(thinkingMsg, {
      content: '❌ Failed to render global leaderboard.',
      embeds: [],
      files: []
    });
  }
}

export async function handleJoinNationCommand(message: Message, args: string[]) {
  const nationAlias = args[0]?.toLowerCase();
  if (!nationAlias) {
    const nations = await prisma.nationalTeam.findMany();
    const list = nations.map(n => `• **${n.name}** ${n.flag} (\`-joinnation ${n.alias}\`)`).join('\n');
    return await message.reply(
      `🌍 **Available National Teams:**\n\n${list || 'No nations created yet.'}\n\n*Usage:* \`-joinnation <alias>\``
    );
  }

  const nation = await prisma.nationalTeam.findUnique({ where: { alias: nationAlias } });
  if (!nation) {
    return await message.reply(`❌ National team \`${nationAlias}\` not found.`);
  }

  const player = await prisma.player.findUnique({ where: { id: message.author.id } });
  const isFirstTime = !player?.nationId;

  const bonusCoins = isFirstTime ? 100000n : 0n;
  const bonusFollowers = isFirstTime ? 100000n : 0n;

  await prisma.player.upsert({
    where: { id: message.author.id },
    update: {
      nationId: nation.id,
      coins: { increment: bonusCoins },
      followers: { increment: bonusFollowers }
    },
    create: {
      id: message.author.id,
      username: message.author.username,
      nationId: nation.id,
      coins: 100000n,
      followers: 100000n
    }
  });

  // Auto-assign Discord nation role & rookie role if present in the guild
  try {
    if (message.guild && message.member) {
      const nationRole = message.guild.roles.cache.find(r => 
        r.name.toLowerCase().includes(nation.name.toLowerCase())
      );
      if (nationRole && !message.member.roles.cache.has(nationRole.id)) {
        await message.member.roles.add(nationRole);
      }

      const rookieRole = message.guild.roles.cache.find(r => 
        r.name.toLowerCase().includes('rookie')
      );
      if (rookieRole && !message.member.roles.cache.has(rookieRole.id)) {
        await message.member.roles.add(rookieRole);
      }
    }
  } catch (err: any) {
    console.warn('Failed to assign nation role to member:', err.message);
  }

  const coinEmoji = getEmoji(message.guild, 'coin');
  const bonusMsg = isFirstTime ? `\n🎁 **Welcome Bonus:** Received **+100k coins** ${coinEmoji} and **+100k followers 👤** for joining your first National Team!\n🚪 **Locker Room Unlocked:** Your national team room is now visible in the **Nations** category!` : '';
  await message.reply(`🎉 You are now officially capped for **${nation.name}** ${nation.flag}!${bonusMsg}`);
}
