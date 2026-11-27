import { Message, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, User, Guild, AttachmentBuilder, Client } from 'discord.js';
import { prisma } from '../database/prisma.js';
import {
  CAMPUS_LOCATIONS,
  PLAYSTYLES,
  ITEM_CATALOG,
  VEHICLE_CATALOG,
  COSMETIC_CATALOG,
  PROFILE_THEMES
} from '../config/constants.js';
import { calculateDerivedRatings } from '../engines/matchSimulationEngine.js';
import { giveMoney } from '../engines/socialEngine.js';
import { generatePlayerProfileCard } from '../utils/chartHelper.js';
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
    milestones
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

  // Collectables symbols
  const itemSymbols = (player.inventory || []).map((i: any) => `${i.emoji} \`${i.name}\``);
  const vehicleSymbols = (player.vehicles || []).map((v: any) => {
    const vDef = VEHICLE_CATALOG.find(cat => cat.key === v.vehicleKey);
    return `${vDef?.emoji || carEmoji} \`${v.name}\``;
  });
  const allCollectables = [...itemSymbols, ...vehicleSymbols];
  const collectablesText = allCollectables.length > 0 ? allCollectables.join(' • ') : '*(empty - visit `-showroom` & `-gm`)*';

  if (tab === 'main') {
    const ovr = Math.round((derived.atk + derived.mid + derived.def) / 3);
    const seasonRank = computeSeasonRank(ovr, player.matchesPlayed || 0);
    const staminaBar = makeProgressBar(player.stamina, 100, 8);
    const color = isVip ? THEME_COLORS.GOLD : THEME_COLORS.PRIMARY;
    const themeObj = PROFILE_THEMES.find(t => t.key === player.profileTheme) || PROFILE_THEMES[0];
    const eqAvatar = COSMETIC_CATALOG.find(c => c.key === player.equippedAvatar);
    const eqBanner = COSMETIC_CATALOG.find(c => c.key === player.equippedBanner);

    return new EmbedBuilder()
      .setColor(color)
      .setTitle(`⚽ ${player.username} ${flag} Career Dossier ${vipBadge}`)
      .setDescription(
        `> *"${player.bio || 'Rising football prodigy aiming for the World Cup trophy.'}"*\n\n` +
        `### ⚡ VITALS & STUDIO SETUP\n` +
        `${staminaEmoji} **Stamina:** ${staminaBar} \`${player.stamina}/100\`\n` +
        `${tpEmoji} **TP:** \`${player.trainingPoints}\` • 🏆 **Rank:** \`${seasonRank}\` • 📍 ${loc.emoji} \`-travel ${loc.alias}\`\n` +
        `🎨 **Theme:** \`${themeObj.name}\` • **Avatar:** \`${eqAvatar ? eqAvatar.name : 'Default'}\` • **Banner:** \`${eqBanner ? eqBanner.name : 'None'}\`\n\n` +
        `### 💰 FINANCES & LOADOUT\n` +
        `${coinEmoji} **Coins:** \`${formatK(player.coins)}\` • ${followersEmoji} **Fans:** \`${formatK(player.followers)}\`\n` +
        `👟 **Boots:** \`${player.activeBoots ? player.activeBoots.toUpperCase() + ' (+10)' : 'Standard'}\` • 🛰️ **Intel:** \`${player.intelBonus > 0 ? '+' + player.intelBonus + ' ' + (player.intelStat || 'Boost') : 'None (-intel)'}\``
      )
      .addFields(
        {
          name: '📊 Tactical Ratings Matrix',
          value: `🎯 \`ATK ${derived.atk}\`  •  🪄 \`MID ${derived.mid}\`  •  🛡️ \`DEF ${derived.def}\`  •  ⭐ \`OVR ${ovr}\``,
          inline: false
        },
        {
          name: `🎭 Tactical Role: ${style.emoji} ${style.name} (${style.position})`,
          value: `*${style.description}*\n**Key Biometrics:** ${style.keyStats.map(s => `\`${s.toUpperCase()}\``).join(' • ')}`,
          inline: false
        },
        {
          name: '🛡️ Affiliations',
          value: `• **Nation:** ${flag} **${player.nation?.name || 'Free Agent'}** (\`-joinnation\`)\n• **Club:** **${player.club?.name || 'Free Agent'}**`,
          inline: true
        },
        {
          name: '📈 Recent Form (5 Matches)',
          value: recentForm.map(r => `\`${r}\``).join(' · '),
          inline: true
        },
        {
          name: '🎁 Fleet & Trophy Cabinet',
          value: collectablesText,
          inline: false
        }
      )
      .setImage('attachment://profile_banner.png')
      .setFooter({ text: 'Beyond The Final Whistle • Career Dossier • Tab 1/3 (-theme to customize)' })
      .setTimestamp();
  }

  if (tab === 'stats') {
    const motmEmoji = getEmoji(guild, 'motm');
    const ovr = Math.round((derived.atk + derived.mid + derived.def) / 3);
    const seasonRank = computeSeasonRank(ovr, player.matchesPlayed || 0);
    const milestones = getUnlockedMilestones(player);
    const gaTotal = (player.goalsScored || 0) + (player.assists || 0);
    const wins = player.wins || 0;
    const draws = player.draws || 0;
    const losses = player.losses || 0;

    return new EmbedBuilder()
      .setColor(THEME_COLORS.TURF)
      .setTitle(`📊 ${player.username} ${flag} Career Match Telemetry`)
      .setDescription(
        `Comprehensive on-pitch performance records for **${player.username}** across all competitions.\n` +
        `🏅 **Season Rank:** \`${seasonRank}\` • 🎖️ **Record (W-D-L):** \`${wins}-${draws}-${losses}\` • 🔥 **Total G/A:** \`${gaTotal}\`\n` +
        (milestones.length > 0 ? `🏆 **Milestone Plaques:** ${milestones.map(m => `\`${m}\``).join(' ')}\n` : '') +
        `${UI.DIVIDER}`
      )
      .addFields(
        {
          name: '🎯 Attacking & Playmaking',
          value:
            `• **Matches (W-D-L):** \`${player.matchesPlayed}\` (\`${wins}-${draws}-${losses}\`)\n` +
            `• **Goals / Assists (G/A):** \`${player.goalsScored}G\` / \`${player.assists}A\` (\`${gaTotal}\`) ⚽\n` +
            `• **Shots (On Target):** \`${player.shots}\` (\`${player.shotsOnTarget}\` OT)\n` +
            `• **Passes (Comp):** \`${player.passesAttempted}\` (\`${player.passesCompleted}\`) 🪄\n` +
            `• **Key Chances:** \`${player.keyPasses}\` • **2nd Assists:** \`${player.secondAssists}\`\n` +
            `• **Dribbles (Won):** \`${player.dribblesAttempted}\` (\`${player.dribblesCompleted}\` won)`,
          inline: true
        },
        {
          name: '🛡️ Defending & Control',
          value:
            `• **Tackles (Won):** \`${player.tacklesAttempted}\` (\`${player.tacklesWon}\`) 🛑\n` +
            `• **Interceptions:** \`${player.interceptions}\` 🧠 • **Clearances:** \`${player.clearances}\` 🧹\n` +
            `• **Possession Won / Lost:** \`${player.possessionWon || 0}\` / \`${player.possessionLost || 0}\`\n` +
            `• **Fouls Comm / Earned:** \`${player.foulsCommitted || 0}\` / \`${player.foulsEarned || 0}\`\n` +
            `• **Saves / Clean Sheets:** \`${player.savesMade || 0}\` / \`${player.cleanSheets}\` 🧤\n` +
            `• **Cards (🟨/🟥) & MOTM:** \`${player.yellowCards}/${player.redCards}\` • \`${player.motmCount}\` ${motmEmoji}`,
          inline: true
        },
        {
          name: '🥅 Spot-Kick & Discipline Ledger',
          value:
            `• **Penalties Won:** \`${player.penaltiesWon || 0}\` • **Penalties Conceded:** \`${player.penaltiesLost || 0}\`\n` +
            `• **Penalties Scored:** \`${player.penaltiesScored || 0}\` ⚽ • **Penalties Saved:** \`${player.penaltiesSaved || 0}\` 🧤`,
          inline: false
        }
      )
      .setThumbnail(targetUser.displayAvatarURL())
      .setImage('attachment://player_stat_card.png')
      .setFooter({ text: 'Beyond The Final Whistle • Match Telemetry • Tab 2/3' })
      .setTimestamp();
  }

  // Attributes tab
  const ovr = Math.round((derived.atk + derived.mid + derived.def) / 3);
  const seasonRank = computeSeasonRank(ovr, player.matchesPlayed || 0);
  const keySet = new Set(style.keyStats.map(s => s.toLowerCase()));
  const fmtAttr = (code: string, key: string, val: number) =>
    keySet.has(key) ? `⭐ \`${code} ${val}\`` : `\`${code} ${val}\``;

  return new EmbedBuilder()
    .setColor(THEME_COLORS.CYAN)
    .setTitle(`🎯 ${player.username} ${flag} Biomechanical Matrix (15)`)
    .setDescription(
      `${style.emoji} **${style.name} (${style.code})** • **${style.position}** • ${tpEmoji} **${player.trainingPoints} TP Available** • 🏆 \`${seasonRank}\`\n` +
      `⭐ **Key Biometrics:** ${style.keyStats.map(s => `\`${s.toUpperCase()}\``).join(' • ')}\n` +
      `⚔️ **Attack & Tech:** ${fmtAttr('FIN', 'fin', player.fin)} · ${fmtAttr('POW', 'pow', player.pow)} · ${fmtAttr('HEA', 'hea', player.hea)} · ${fmtAttr('PAS', 'pas', player.pas)} · ${fmtAttr('VIS', 'vis', player.vis)} · ${fmtAttr('CRO', 'cro', player.cro)} · ${fmtAttr('DRI', 'dri', player.dri)}\n` +
      `🛡️ **Def & Physical:** ${fmtAttr('TCK', 'tck', player.tck)} · ${fmtAttr('INT', 'int', player.int)} · ${fmtAttr('MRK', 'mrk', player.mrk)} · ${fmtAttr('PAC', 'pac', player.pac)} · ${fmtAttr('PHY', 'phy', player.phy)} · ${fmtAttr('CMP', 'cmp', player.cmp)} · ${fmtAttr('AGI', 'agi', player.agi)} · ${fmtAttr('WRK', 'wrk', player.wrk)}\n` +
      subtext('🔬 Spend TP at Research Facility: `-travel rf` ➔ `-sptrain <attr>` to permanently level up stats.')
    )
    .setImage('attachment://biomechanics_card.png')
    .setFooter({ text: 'Beyond The Final Whistle • Biomechanics Matrix • Tab 3/3' })
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
