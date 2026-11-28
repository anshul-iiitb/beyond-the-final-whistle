import { Message, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, User, Guild, AttachmentBuilder, Client } from 'discord.js';
import path from 'path';
import { prisma } from '../database/prisma.js';
import {
  CAMPUS_LOCATIONS,
  PLAYSTYLES,
  ITEM_CATALOG,
  VEHICLE_CATALOG,
  COSMETIC_CATALOG
} from '../config/constants.js';
import { calculateDerivedRatings } from '../engines/matchSimulationEngine.js';
import { syncMemberLocationVisibility } from '../engines/campusEngine.js';
import { syncMemberGameRoles, syncMemberNationRole } from '../utils/roleSyncHelper.js';
import { giveMoney } from '../engines/socialEngine.js';
import { renderEquippedBannerPoster, renderLeaderboardCanvas, renderPlayerStatCanvas, renderPlayerBiomechanicsCanvas, resolveCosmeticAssetPath, LeaderboardEntryData } from '../utils/themeRenderers.js';
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

export async function buildProfileBannerAttachment(player: any, _targetUser?: User): Promise<AttachmentBuilder | null> {
  const customBannerPath = resolveCosmeticAssetPath('BANNER', player.equippedBanner);
  if (!customBannerPath) return null;

  const derived = calculateDerivedRatings(player);
  const ovr = Math.round((derived.atk + derived.mid + derived.def) / 3);
  const seasonRank = computeSeasonRank(ovr, player.matchesPlayed || 0);
  const bannerDef = COSMETIC_CATALOG.find(c => c.key === player.equippedBanner);

  const buffer = await renderEquippedBannerPoster({
    bannerPath: customBannerPath,
    username: player.username || _targetUser?.username || 'Player',
    bannerName: bannerDef?.name || String(player.equippedBanner).toUpperCase(),
    bannerSubtitle: bannerDef?.subtitle || 'COLLECTOR BANNER',
    ovr,
    seasonRank,
    accentHex: bannerDef?.accentHex || '#f59e0b',
    vipTier: player.vipTier || 0
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

  let recentForm: string[] = [];
  try {
    const parsed = JSON.parse(player.recentRatings || '[]');
    if (Array.isArray(parsed) && parsed.length > 0) {
      recentForm = parsed.map((n: number) => Number(n).toFixed(1));
    }
  } catch { }

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
    equippedAvatar: player.equippedAvatar,
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
    equippedAvatar: player.equippedAvatar,
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
  guild?: Guild | null,
  thumbnailOverrideUrl?: string | null,
  hasBannerImage = false
): EmbedBuilder {
  const derived = calculateDerivedRatings(player);
  const hasPlaystyle = player.playstyle && player.playstyle !== 'NONE';
  const style = hasPlaystyle ? (PLAYSTYLES[player.playstyle] || PLAYSTYLES.PCH) : null;
  const playstyleDisplay = style ? `${style.emoji} ${style.name} (${style.code})` : '❓ *Unselected (`-playstyle`)*';
  const posDisplay = style ? style.position : '*Pending*';
  const hasLoc = player.currentLocation && player.currentLocation !== 'none';
  const loc = hasLoc ? (CAMPUS_LOCATIONS[player.currentLocation] || CAMPUS_LOCATIONS.tc) : null;
  const locDisplay = loc ? `${loc.emoji} ${loc.name} (\`-travel ${loc.alias}\`)` : '❓ *No Location (`-playstyle` to enter Training Ground)*';
  const flag = getNationFlag(player.nation);
  const nationDisplay = player.nation ? `${flag} ${player.nation.name}` : '❓ *None (`-joinnation`)*';
  const isVip = player.vipTier >= 1;
  const vipBadge = isVip ? '👑 `[ VIP ]`' : '';
  const staminaEmoji = getEmoji(guild, 'stamina');
  const coinEmoji = getEmoji(guild, 'coin');
  const tpEmoji = getEmoji(guild, 'tp');
  const followersEmoji = getEmoji(guild, 'followers');
  const carEmoji = getEmoji(guild, 'car');

  let recentForm: string[] = [];
  try {
    const parsed = JSON.parse(player.recentRatings || '[]');
    if (Array.isArray(parsed) && parsed.length > 0) {
      recentForm = parsed.map((n: number) => Number(n).toFixed(1));
    }
  } catch { }

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

  const thumbUrl = thumbnailOverrideUrl || targetUser.displayAvatarURL?.() || null;
  const botIcon = guild?.client?.user?.displayAvatarURL?.() || undefined;

  if (tab === 'main') {
    const ovr = Math.round((derived.atk + derived.mid + derived.def) / 3);
    const seasonRank = computeSeasonRank(ovr, player.matchesPlayed || 0);
    const color = isVip ? THEME_COLORS.GOLD : THEME_COLORS.PRIMARY;
    const bootsLabel = player.activeBoots ? `${player.activeBoots.toUpperCase()} (+10)` : 'Standard';
    const intelLabel = player.intelBonus > 0 ? `+${player.intelBonus} ${player.intelStat || 'Boost'}` : 'None';

    const recentFormText = recentForm.length > 0
      ? `${recentForm.join(' | ')} ⭐`
      : '*No matches played yet*';

    let onboardingNotice = '';
    if (!hasPlaystyle) {
      onboardingNotice = `⚠️ **Rookie Onboarding (Step 1/2):** Run \`-playstyle\` to choose your role and enter the Training Center!\n\n`;
    } else if (!player.nationId) {
      onboardingNotice = `⚠️ **Rookie Onboarding (Step 2/2):** Run \`-joinnation\` to join a country and claim your **+100k bonus**!\n\n`;
    }

    const sections = [
      onboardingNotice + `*${player.bio || 'Rising football prodigy aiming for the World Cup trophy.'}*`,
      `### 🛡️ Team Stats\n` +
      `**Nation :** ${nationDisplay}\n` +
      `**Club :** ${player.club?.name || 'Free Agent'}\n` +
      `**Location :** ${locDisplay}`,
      `### 📊 Individual Stats\n` +
      `**Appearances :** ${player.matchesPlayed || 0} 🎯\n` +
      `**Goals :** ${player.goalsScored || 0} ⚽\n` +
      `**Assists :** ${player.assists || 0} 👟\n` +
      `**Yellow Cards :** ${player.yellowCards || 0} 🟨\n` +
      `**Red Cards :** ${player.redCards || 0} 🟥\n` +
      `**Clean Sheets :** ${player.cleanSheets || 0} 🧤\n` +
      `**MOTM Awards :** ${player.motmCount || 0} ${motmEmoji}`,
      `### 📈 Recent Form\n` +
      `**Last 5 Ratings :** ${recentFormText}`,
      `### ⚡ Player Attributes\n` +
      `**Playstyle :** ${playstyleDisplay}\n` +
      `**Position :** ${posDisplay}  •  **OVR :** ${ovr}\n` +
      `**Ratings :** ATK **${derived.atk}** | MID **${derived.mid}** | DEF **${derived.def}**\n` +
      `**Stamina :** ${staminaEmoji} ${player.stamina}/100\n` +
      `**Training Pts :** ${tpEmoji} ${player.trainingPoints}\n` +
      `**Boots :** 👟 ${bootsLabel}\n` +
      `**Intel :** 🛰️ ${intelLabel}`,
      `### 💰 Followers & Wealth\n` +
      `**Followers :** ${formatK(player.followers)} ${followersEmoji}\n` +
      `**Coins :** ${formatK(player.coins)} ${coinEmoji}`,
      `### 🎁 Collectables\n` +
      `${collectablesDisplay}\n\n` +
      subtext(`🏆 ${seasonRank} Tier • Manage gear via -inv & -equip`)
    ];

    const embed = new EmbedBuilder()
      .setColor(color)
      .setTitle(`⚽ ${player.username} ${flag}'s Profile! ${vipBadge}`.trim())
      .setThumbnail(thumbUrl)
      .setDescription(sections.join(UI.SPACER) + (hasBannerImage ? '\n\u200b' : ''))
      .setFooter({ text: `Used by ${player.username} • Beyond The Final Whistle • Tab 1/3`, iconURL: botIcon })
      .setTimestamp();

    if (hasBannerImage) {
      embed.setImage('attachment://profile_banner.png');
    }

    return embed;
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

    const statSections = [
      `🏅 **Season Rank:** ${seasonRank}\n🎖️ **Record (W-D-L):** ${wins}-${draws}-${losses}\n🔥 **Total G/A:** ${gaTotal}` +
      (milestones.length > 0 ? `\n🏆 **Milestones:** ${milestones.join(' • ')}` : ''),
      `### ⚔️ Attacking & Passing\n` +
      `**Shots :** ${player.shots || 0} (${player.shotsOnTarget || 0} on target)\n` +
      `**Passes :** ${player.passesCompleted || 0} / ${player.passesAttempted || 0} (${passPct}%)\n` +
      `**Key Passes :** ${player.keyPasses || 0}\n` +
      `**Second Assists :** ${player.secondAssists || 0}\n` +
      `**Dribbles Won :** ${player.dribblesCompleted || 0} / ${player.dribblesAttempted || 0}`,
      `### 🛡️ Defending & Discipline\n` +
      `**Tackles Won :** ${player.tacklesWon || 0} / ${player.tacklesAttempted || 0}\n` +
      `**Interceptions :** ${player.interceptions || 0}\n` +
      `**Clearances :** ${player.clearances || 0}\n` +
      `**Possession W/L :** ${player.possessionWon || 0} / ${player.possessionLost || 0}\n` +
      `**Fouls Comm / Earned :** ${player.foulsCommitted || 0} / ${player.foulsEarned || 0}\n` +
      `**Saves / Clean Sheets :** ${player.savesMade || 0} / ${player.cleanSheets || 0}\n` +
      `**Penalties S / Sv :** ${player.penaltiesScored || 0} / ${player.penaltiesSaved || 0}`
    ];

    return new EmbedBuilder()
      .setColor(THEME_COLORS.TURF)
      .setTitle(`📊 Detailed Statistics — ${player.username} ${flag}`)
      .setThumbnail(thumbUrl)
      .setDescription(statSections.join(UI.SPACER) + '\n\u200b')
      .setImage('attachment://player_stat_card.png')
      .setFooter({ text: `Used by ${player.username} • Match Telemetry • Tab 2/3`, iconURL: botIcon })
      .setTimestamp();
  }

  // Attributes tab (WITS-inspired crisp bars + Neon Hexagon Radar card)
  const ovr = Math.round((derived.atk + derived.mid + derived.def) / 3);
  const seasonRank = computeSeasonRank(ovr, player.matchesPlayed || 0);
  const fmtBarRow = (code: string, name: string, val: number) => {
    const bar = makeProgressBar(val, 99, 10, '█', '░');
    return `\`${code.padEnd(3)} ${name.padEnd(13)} ${String(val).padStart(2)} [${bar}]\``;
  };

  const playstyleHeader = style
    ? `**Playstyle :** ${style.emoji} ${style.name} (${style.code})\n` +
      `*${style.description}*\n\n` +
      `• **Key Stats :** ${style.keyStats.map(s => s.toUpperCase()).join(', ')}\n`
    : `**Playstyle :** ❓ *Unselected (Run \`-playstyle <choice>\`)*\n\n`;

  const attrSections = [
    `${playstyleHeader}` +
    `• **Derived Ratings :** ATK ${derived.atk} | MID ${derived.mid} | DEF ${derived.def} | OVR ${ovr} (${seasonRank})\n` +
    `• **TP Available :** ${tpEmoji} ${player.trainingPoints} TP`,
    `🔴 **Attacking**\n` +
    `${fmtBarRow('FIN', 'Finishing', player.fin)}\n` +
    `${fmtBarRow('POW', 'Shot Power', player.pow)}\n` +
    `${fmtBarRow('HEA', 'Heading', player.hea)}`,
    `🔵 **Technical**\n` +
    `${fmtBarRow('PAS', 'Passing', player.pas)}\n` +
    `${fmtBarRow('VIS', 'Vision', player.vis)}\n` +
    `${fmtBarRow('CRO', 'Crossing', player.cro)}\n` +
    `${fmtBarRow('DRI', 'Dribbling', player.dri)}`,
    `🟢 **Defending**\n` +
    `${fmtBarRow('TCK', 'Tackling', player.tck)}\n` +
    `${fmtBarRow('INT', 'Interceptions', player.int)}\n` +
    `${fmtBarRow('MRK', 'Marking', player.mrk)}`,
    `🟡 **Physical & Mental**\n` +
    `${fmtBarRow('PAC', 'Pace', player.pac)}\n` +
    `${fmtBarRow('PHY', 'Physicality', player.phy)}\n` +
    `${fmtBarRow('CMP', 'Composure', player.cmp)}\n` +
    `${fmtBarRow('AGI', 'Agility', player.agi)}\n` +
    `${fmtBarRow('WRK', 'Work Rate', player.wrk)}\n\n` +
    subtext('🔬 Upgrade stats at Research Facility: `-travel rf` ➔ `-sptrain <attr>`')
  ];

  return new EmbedBuilder()
    .setColor(THEME_COLORS.CYAN)
    .setTitle(`📊 ${player.username} ${flag}'s Player Attributes`)
    .setThumbnail(thumbUrl)
    .setDescription(attrSections.join(UI.SPACER) + '\n\u200b')
    .setImage('attachment://biomechanics_card.png')
    .setFooter({ text: `Used by ${player.username} • Biomechanics Matrix • Tab 3/3`, iconURL: botIcon })
    .setTimestamp();
}

/**
 * Builds the complete -profile message payload (embed, buttons, main/stat/bio card, and equipped custom avatar thumbnail).
 */
export async function buildProfileViewPayload(
  player: any,
  targetUser: User,
  tab: 'main' | 'stats' | 'attr' = 'main',
  guild?: Guild | null
) {
  const files: AttachmentBuilder[] = [];
  let thumbOverride: string | null = null;

  const customAvatarPath = resolveCosmeticAssetPath('AVATAR', player.equippedAvatar);
  if (customAvatarPath) {
    const ext = path.extname(customAvatarPath) || '.png';
    const fileName = `custom_avatar${ext}`;
    files.push(new AttachmentBuilder(customAvatarPath, { name: fileName }));
    thumbOverride = `attachment://${fileName}`;
  }

  let hasBannerImage = false;
  if (tab === 'main') {
    const bannerCard = await buildProfileBannerAttachment(player, targetUser);
    if (bannerCard) {
      files.push(bannerCard);
      hasBannerImage = true;
    }
  } else if (tab === 'stats') {
    files.push(await buildPlayerStatCardAttachment(player, targetUser, 'career'));
  } else {
    files.push(await buildPlayerBiomechanicsAttachment(player, targetUser));
  }

  const embed = buildProfileEmbed(player, targetUser, tab, guild, thumbOverride, hasBannerImage);
  const row = buildProfileTabsRow(targetUser.id, tab);

  return { embed, files, components: [row] };
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
          currentLocation: 'none',
          playstyle: 'NONE',
          position: 'ATT'
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

    if (message.guild && targetUser.id === message.author.id && message.member) {
      const derived = calculateDerivedRatings(player);
      const ovr = Math.round((derived.atk + derived.mid + derived.def) / 3);
      await syncMemberGameRoles(message.member, {
        ovr,
        matchesPlayed: player.matchesPlayed || 0,
        vipTier: player.vipTier || 0
      });
      await syncMemberLocationVisibility(message.guild, message.author.id, player.currentLocation || 'tc');
    }

    const payload = await buildProfileViewPayload(player, targetUser, 'main', message.guild);

    await updateLoadingMessage(thinkingMsg, {
      embeds: [payload.embed],
      files: payload.files,
      components: payload.components
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

  const botIcon = client?.user?.displayAvatarURL?.() || guild?.client?.user?.displayAvatarURL?.() || undefined;
  const embed = new EmbedBuilder()
    .setColor(embedColor)
    .setTitle(`🏆 ${title}`)
    .setDescription(
      `${quickList}\n` +
      subtext('💡 Switch leaderboards live using the buttons below or `-lb goals` / `-lb wealth` / `-lb followers`.')
    )
    .setImage('attachment://leaderboard.png')
    .setFooter({ text: 'Beyond The Final Whistle • Official Global Standings', iconURL: botIcon })
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
    const nations = await prisma.nationalTeam.findMany({
      include: { _count: { select: { players: true } } },
      orderBy: { name: 'asc' }
    });
    const openNations = nations.filter(n => !n.isLocked);
    const list = nations.map(n => {
      if (n.isLocked) {
        return `• **${n.name}** ${n.flag} 🔒 \`[LOCKED]\``;
      }
      const cap = n.maxPlayers || 23;
      const isFull = n._count.players >= cap;
      const badge = isFull ? ' `[FULL]`' : ` \`(${n._count.players}/${cap})\``;
      return `• **${n.name}** ${n.flag}${badge} (\`-joinnation ${n.alias}\`)`;
    }).join('\n');
    return await message.reply(
      `🌍 **Available National Teams (${openNations.length} Open):**\n\n${list || 'No nations created yet.'}\n\n*Usage:* \`-joinnation <alias>\``
    );
  }

  const nation = await prisma.nationalTeam.findUnique({
    where: { alias: nationAlias },
    include: { _count: { select: { players: true } } }
  });
  if (!nation) {
    return await message.reply(`❌ National team \`${nationAlias}\` not found.`);
  }

  // Check if nation is locked
  if (nation.isLocked) {
    return await message.reply(
      `🔒 **Nation Locked:** **${nation.name}** ${nation.flag} is currently locked by tournament officials. Registration is closed!`
    );
  }

  const player = await prisma.player.findUnique({ where: { id: message.author.id } });
  const isFirstTime = !player?.nationId;

  // If already registered for this nation
  if (player?.nationId === nation.id) {
    return await message.reply(`ℹ️ You are already an active player for **${nation.name}** ${nation.flag}!`);
  }

  // Squad Capacity Limit Check
  const maxPlayers = nation.maxPlayers || 23;
  if (nation._count.players >= maxPlayers) {
    return await message.reply(
      `❌ **National Squad Full:** **${nation.name}** ${nation.flag} has reached its maximum roster capacity of **${maxPlayers} players** (${nation._count.players}/${maxPlayers})!\n*Only the national coaching staff or an administrator can expand squad limits (\`-setlimit nation ${nation.alias} <limit>\`).*`
    );
  }

  // FIFA Nation Allegiance Lockout: If player has played 3+ official caps, lock nation switching
  if (player?.nationId && player.nationId !== nation.id) {
    const officialCaps = player.capsPlayedOfficial || player.matchesPlayed || 0;
    if (officialCaps >= 3) {
      return await message.reply(
        `❌ **FIFA Nation Lockout:** You have played **${officialCaps} official matches** for your country and cannot switch national allegiance. Your international loyalty is locked! 🔒`
      );
    }
  }

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

  // Auto-assign Discord nation role (clearing previous nation) & tier role if present in the guild
  if (message.guild && message.member) {
    await syncMemberNationRole(message.member, nation.name);
    const updatedPlayer = await prisma.player.findUnique({ where: { id: message.author.id } });
    if (updatedPlayer) {
      const d = calculateDerivedRatings(updatedPlayer);
      await syncMemberGameRoles(message.member, {
        ovr: Math.round((d.atk + d.mid + d.def) / 3),
        matchesPlayed: updatedPlayer.matchesPlayed || 0,
        vipTier: updatedPlayer.vipTier || 0
      });
    }
  }

  const coinEmoji = getEmoji(message.guild, 'coin');
  const bonusMsg = isFirstTime ? `\n🎁 **Welcome Bonus:** Received **+100k coins** ${coinEmoji} and **+100k followers 👤** for joining your first National Team!\n🚪 **Locker Room Unlocked:** Your national team room is now visible in the **Nations** category!` : '';
  await message.reply(`🎉 You are now officially capped for **${nation.name}** ${nation.flag}!${bonusMsg}`);
}

export async function handleJoinClubCommand(message: Message, args: string[]) {
  const clubAlias = args[0]?.toLowerCase();
  if (!clubAlias) {
    const clubs = await prisma.footballClub.findMany({
      include: { _count: { select: { players: true } } },
      orderBy: { name: 'asc' }
    });
    const openClubs = clubs.filter(c => !c.isLocked);
    const list = clubs.map(c => {
      if (c.isLocked) {
        return `• **${c.name}** ${c.badge} 🔒 \`[LOCKED]\``;
      }
      const cap = c.maxPlayers || 23;
      const isFull = c._count.players >= cap;
      const badge = isFull ? ' `[FULL]`' : ` \`(${c._count.players}/${cap})\``;
      return `• **${c.name}** ${c.badge}${badge} (\`-joinclub ${c.alias}\`)`;
    }).join('\n');
    return await message.reply(
      `🛡️ **Available Football Clubs (${openClubs.length} Open):**\n\n${list || 'No football clubs registered yet.'}\n\n*Usage:* \`-joinclub <alias>\``
    );
  }

  const club = await prisma.footballClub.findUnique({
    where: { alias: clubAlias },
    include: { _count: { select: { players: true } } }
  });
  if (!club) {
    return await message.reply(`❌ Football club \`${clubAlias}\` not found.`);
  }

  // Check if club is locked
  if (club.isLocked) {
    return await message.reply(
      `🔒 **Club Locked:** **${club.name}** ${club.badge} is currently locked by club executives. Transfer registrations are closed!`
    );
  }

  const player = await prisma.player.findUnique({ where: { id: message.author.id } });
  if (player?.clubId === club.id) {
    return await message.reply(`ℹ️ You are already signed with **${club.name}** ${club.badge}!`);
  }

  // Club Squad Capacity Limit Check
  const maxPlayers = club.maxPlayers || 23;
  if (club._count.players >= maxPlayers) {
    return await message.reply(
      `❌ **Club Squad Full:** **${club.name}** ${club.badge} has reached its maximum roster capacity of **${maxPlayers} players** (${club._count.players}/${maxPlayers})!\n*Only club executives or an administrator can expand squad limits (\`-setlimit club ${club.alias} <limit>\`).*`
    );
  }

  await prisma.player.upsert({
    where: { id: message.author.id },
    update: { clubId: club.id },
    create: {
      id: message.author.id,
      username: message.author.username,
      clubId: club.id
    }
  });

  await message.reply(`🤝 **Transfer Complete!** You have officially signed for **${club.name}** ${club.badge}! Welcome to your new club squad!`);
}

export async function handleDailyCommand(message: Message) {
  const player = await prisma.player.findUnique({ where: { id: message.author.id } });
  if (!player) {
    return await message.reply('❌ You have not registered yet. Use `-profile` to register.');
  }

  const now = new Date();
  if (player.lastDailyAt) {
    const elapsedMs = now.getTime() - player.lastDailyAt.getTime();
    const cooldownMs = 24 * 60 * 60 * 1000;
    if (elapsedMs < cooldownMs) {
      const waitMinutes = Math.ceil((cooldownMs - elapsedMs) / 60000);
      const hours = Math.floor(waitMinutes / 60);
      const mins = waitMinutes % 60;
      return await message.reply(
        `⏳ **Daily Already Claimed!** Next daily available in **${hours}h ${mins}m**.`
      );
    }
  }

  let newStreak = 1;
  if (player.lastDailyAt) {
    const elapsedMs = now.getTime() - player.lastDailyAt.getTime();
    if (elapsedMs <= 48 * 60 * 60 * 1000) {
      newStreak = (player.dailyStreak || 0) + 1;
    }
  }

  const baseCoins = 10000n;
  const streakBonus = BigInt((newStreak - 1) * 2500);
  let totalCoins = baseCoins + streakBonus;

  let milestoneBonus = '';
  let tpBonus = 0;
  if (newStreak % 7 === 0) {
    totalCoins += 50000n;
    tpBonus = 2;
    milestoneBonus = `\n🔥 **7-DAY MILESTONE BONUS!** Received extra **+50k coins** 🪙 and **+2 TP** 🏋️!`;
  }

  const coinEmoji = getEmoji(message.guild, 'coin');

  await prisma.player.update({
    where: { id: player.id },
    data: {
      coins: { increment: totalCoins },
      trainingPoints: { increment: tpBonus },
      dailyStreak: newStreak,
      lastDailyAt: now
    }
  });

  const embed = new EmbedBuilder()
    .setColor(THEME_COLORS.GOLD)
    .setTitle(`☀️ Daily Matchday Stipend — Day ${newStreak} Streak`)
    .setDescription(
      `You checked in for matchday duty!\n\n` +
      `🪙 **Daily Reward:** **+${formatK(totalCoins)} coins** ${coinEmoji}\n` +
      `🔥 **Current Streak:** **${newStreak} days** (Earn +2.5k more coins each consecutive day!)${milestoneBonus}\n\n` +
      subtext('Check back tomorrow within 48 hours to preserve your check-in streak!')
    )
    .setFooter({ text: 'Beyond The Final Whistle • Daily Economy' })
    .setTimestamp();

  await message.reply({ embeds: [embed] });
}
