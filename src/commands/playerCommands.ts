import { Message, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, User, Guild } from 'discord.js';
import { prisma } from '../database/prisma.js';
import { CAMPUS_LOCATIONS, PLAYSTYLES, ITEM_CATALOG, VEHICLE_CATALOG } from '../config/constants.js';
import { calculateDerivedRatings } from '../engines/matchSimulationEngine.js';
import { giveMoney } from '../engines/socialEngine.js';
import { formatK, getNationFlag } from '../utils/formatHelper.js';
import { getEmoji } from '../utils/emojiHelper.js';
import { THEME_COLORS, UI, makeProgressBar, subtext } from '../utils/themeHelper.js';

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
    const staminaBar = makeProgressBar(player.stamina, 100, 10);
    const color = isVip ? THEME_COLORS.GOLD : THEME_COLORS.PRIMARY;

    return new EmbedBuilder()
      .setColor(color)
      .setTitle(`⚽ ${player.username} ${flag} Career Dossier ${vipBadge}`)
      .setDescription(
        `> *"${player.bio || 'Rising football prodigy aiming for the World Cup trophy.'}"*\n\n` +
        `### ⚡ BIOMETRIC STATUS & VITALS\n` +
        `${staminaEmoji} **Stamina:** \`${player.stamina}/100\`\n` +
        `${staminaBar} **${player.stamina}%**\n` +
        `${tpEmoji} **Training Points:** \`${player.trainingPoints} TP\`\n` +
        `📍 **Campus Facility:** ${loc.emoji} **${loc.name}** \`(-travel ${loc.alias})\`\n\n` +
        `### 💰 FINANCIALS & CLOUT\n` +
        `${coinEmoji} **Net Worth:** \`${formatK(player.coins)}\`\n` +
        `${followersEmoji} **Global Fans:** \`${formatK(player.followers)}\`\n` +
        `👟 **Active Boots:** \`${player.activeBoots ? player.activeBoots.toUpperCase() + ' (+10 Boost)' : 'Standard Cleats'}\`\n` +
        `🛰️ **Tactical Intel:** \`${player.intelBonus > 0 ? '+' + player.intelBonus + ' ' + (player.intelStat || 'Boost') : 'None (-intel)'}\``
      )
      .addFields(
        {
          name: '📊 Tactical Ratings Matrix',
          value:
            '```\n' +
            `🎯 ATK: ${derived.atk.toString().padEnd(3)}   •   🪄 MID: ${derived.mid.toString().padEnd(3)}   •   🛡️ DEF: ${derived.def.toString().padEnd(3)}   •   ⭐ OVR: ${ovr}\n` +
            '```',
          inline: false
        },
        {
          name: `🎭 Tactical Role: ${style.emoji} ${style.name} (${style.position})`,
          value: `*${style.description}*\n**Key Biometrics:** ${style.keyStats.map(s => `\`${s.toUpperCase()}\``).join(' • ')}`,
          inline: false
        },
        {
          name: '🛡️ Affiliations & Squad',
          value: `• **National Team:** **${player.nation?.name || 'Free Agent (-joinnation)'}** ${flag}\n• **Club Franchise:** **${player.club?.name || 'Free Agent'}**`,
          inline: true
        },
        {
          name: '📈 Recent Form (5 Matches)',
          value: `\`${recentForm.join('  •  ')}\``,
          inline: true
        },
        {
          name: '🎁 Fleet & Trophy Cabinet',
          value: collectablesText,
          inline: false
        }
      )
      .setThumbnail(targetUser.displayAvatarURL())
      .setFooter({ text: 'Beyond The Final Whistle • Career Dossier • Tab 1/3' })
      .setTimestamp();
  }

  if (tab === 'stats') {
    const motmEmoji = getEmoji(guild, 'motm');
    return new EmbedBuilder()
      .setColor(THEME_COLORS.TURF)
      .setTitle(`📊 ${player.username} ${flag} Career Match Telemetry`)
      .setDescription(
        `Comprehensive on-pitch performance records for **${player.username}** across all competitions.\n` +
        `${UI.DIVIDER}`
      )
      .addFields(
        {
          name: '🎯 Attacking & Playmaking Telemetry',
          value:
            `• **Matches Played:** \`${player.matchesPlayed}\` 🎯\n` +
            `• **Goals Scored:** \`${player.goalsScored}\` ⚽\n` +
            `• **Assists Provided:** \`${player.assists}\` 👟\n` +
            `• **Shots (On Target):** \`${player.shots}\` (\`${player.shotsOnTarget}\` on target)\n` +
            `• **Passes (Completed):** \`${player.passesAttempted}\` (\`${player.passesCompleted}\` completed)\n` +
            `• **Key Chances Created:** \`${player.keyPasses}\` 🪄\n` +
            `• **Second Assists:** \`${player.secondAssists}\`\n` +
            `• **Dribbles Attempted:** \`${player.dribblesAttempted}\``,
          inline: true
        },
        {
          name: '🛡️ Defending & Discipline',
          value:
            `• **Dribbles Won:** \`${player.dribblesCompleted}\`\n` +
            `• **Tackles (Won):** \`${player.tacklesAttempted}\` (\`${player.tacklesWon}\` won) 🛑\n` +
            `• **Interceptions:** \`${player.interceptions}\` 🧠\n` +
            `• **Defensive Clearances:** \`${player.clearances}\` 🧹\n` +
            `• **Clean Sheets:** \`${player.cleanSheets}\` 🧤\n` +
            `• **Yellow Cards:** \`${player.yellowCards}\` 🟨\n` +
            `• **Red Cards:** \`${player.redCards}\` 🟥\n` +
            `• **MOTM Accolades:** \`${player.motmCount}\` ${motmEmoji}`,
          inline: true
        }
      )
      .setThumbnail(targetUser.displayAvatarURL())
      .setFooter({ text: 'Beyond The Final Whistle • Match Telemetry • Tab 2/3' })
      .setTimestamp();
  }

  // Attributes tab
  return new EmbedBuilder()
    .setColor(THEME_COLORS.CYAN)
    .setTitle(`🎯 ${player.username} ${flag} Biomechanical Attributes (15)`)
    .setDescription(
      `Role: ${style.emoji} **${style.name} (${style.code})** • Position: **${style.position}**\n` +
      subtext('Spend TP at the Research Facility: `-travel rf` ➔ `-sptrain <attr>` to permanently level up stats.') + '\n' +
      `${UI.DIVIDER}`
    )
    .addFields(
      {
        name: '🎯 Attacking Attributes',
        value:
          `• Finishing (FIN): \`${player.fin}\` ${makeProgressBar(player.fin, 99, 5)}\n` +
          `• Shot Power (POW): \`${player.pow}\` ${makeProgressBar(player.pow, 99, 5)}\n` +
          `• Heading (HEA): \`${player.hea}\` ${makeProgressBar(player.hea, 99, 5)}`,
        inline: true
      },
      {
        name: '🪄 Technical Attributes',
        value:
          `• Passing (PAS): \`${player.pas}\` ${makeProgressBar(player.pas, 99, 5)}\n` +
          `• Vision (VIS): \`${player.vis}\` ${makeProgressBar(player.vis, 99, 5)}\n` +
          `• Crossing (CRO): \`${player.cro}\` ${makeProgressBar(player.cro, 99, 5)}\n` +
          `• Dribbling (DRI): \`${player.dri}\` ${makeProgressBar(player.dri, 99, 5)}`,
        inline: true
      },
      {
        name: '🛡️ Defending Attributes',
        value:
          `• Tackling (TCK): \`${player.tck}\` ${makeProgressBar(player.tck, 99, 5)}\n` +
          `• Interceptions (INT): \`${player.int}\` ${makeProgressBar(player.int, 99, 5)}\n` +
          `• Marking (MRK): \`${player.mrk}\` ${makeProgressBar(player.mrk, 99, 5)}`,
        inline: true
      },
      {
        name: '⚡ Physical & Mental Attributes',
        value:
          `• Pace (PAC): \`${player.pac}\` ${makeProgressBar(player.pac, 99, 6)}\n` +
          `• Physicality (PHY): \`${player.phy}\` ${makeProgressBar(player.phy, 99, 6)}\n` +
          `• Composure (CMP): \`${player.cmp}\` ${makeProgressBar(player.cmp, 99, 6)}\n` +
          `• Agility (AGI): \`${player.agi}\` ${makeProgressBar(player.agi, 99, 6)}\n` +
          `• Work Rate (WRK): \`${player.wrk}\` ${makeProgressBar(player.wrk, 99, 6)}`,
        inline: false
      }
    )
    .setThumbnail(targetUser.displayAvatarURL())
    .setFooter({ text: 'Beyond The Final Whistle • Biomechanics Matrix • Tab 3/3' })
    .setTimestamp();
}

/**
 * Handles -profile [@user]
 */
export async function handleProfileCommand(message: Message, args: string[]) {
  const targetUser = message.mentions.users.first() || message.author;

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
    return await message.reply('❌ That player has not registered on Beyond The Final Whistle yet.');
  }

  const embed = buildProfileEmbed(player, targetUser, 'main', message.guild);
  const row = buildProfileTabsRow(targetUser.id, 'main');

  await message.reply({ embeds: [embed], components: [row] });
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
  const amountStr = args[1];

  if (!targetUser || !amountStr) {
    return await message.reply('❌ Usage: `-give @user <amount>` (e.g. `-give @teammate 50000`)');
  }

  const amount = BigInt(amountStr.replace(/[^0-9]/g, ''));
  if (amount <= 0n) {
    return await message.reply('❌ Invalid amount.');
  }

  const result = await giveMoney(message.author.id, targetUser.id, amount);
  await message.reply(result.message);
}

export async function handleLeaderboardCommand(message: Message, args: string[]) {
  const category = args[0]?.toLowerCase() || 'ovr';

  if (category === 'goals' || category === 'g') {
    const leaders = await prisma.player.findMany({
      orderBy: { goalsScored: 'desc' },
      take: 10,
      include: { nation: true }
    });
    const lines = leaders.map((p, i) => {
      const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `\`#${i + 1}\``;
      return `${medal} **${p.username}** ${getNationFlag(p.nation)} ➔ \`${p.goalsScored} Goals\` ⚽`;
    });
    const embed = new EmbedBuilder()
      .setColor(THEME_COLORS.GOLD)
      .setTitle('🏆 World Golden Boot Leaderboard — Top Scorers')
      .setDescription(lines.join('\n') || 'No goals recorded yet.')
      .setFooter({ text: 'Beyond The Final Whistle • Global Standings' })
      .setTimestamp();
    return await message.reply({ embeds: [embed] });
  }

  if (category === 'wealth' || category === 'money' || category === 'coins') {
    const coinEmoji = getEmoji(message.guild, 'coin');
    const leaders = await prisma.player.findMany({
      orderBy: { coins: 'desc' },
      take: 10,
      include: { nation: true }
    });
    const lines = leaders.map((p, i) => {
      const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `\`#${i + 1}\``;
      return `${medal} **${p.username}** ${getNationFlag(p.nation)} ➔ \`${formatK(p.coins)}\` ${coinEmoji}`;
    });
    const embed = new EmbedBuilder()
      .setColor(THEME_COLORS.GOLD)
      .setTitle(`${coinEmoji} World Wealth & Net Worth Leaderboard`)
      .setDescription(lines.join('\n') || 'No wealth recorded.')
      .setFooter({ text: 'Beyond The Final Whistle • Global Standings' })
      .setTimestamp();
    return await message.reply({ embeds: [embed] });
  }

  if (category === 'followers' || category === 'fans') {
    const leaders = await prisma.player.findMany({
      orderBy: { followers: 'desc' },
      take: 10,
      include: { nation: true }
    });
    const lines = leaders.map((p, i) => {
      const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `\`#${i + 1}\``;
      return `${medal} **${p.username}** ${getNationFlag(p.nation)} ➔ \`${formatK(p.followers)}\` 👤`;
    });
    const embed = new EmbedBuilder()
      .setColor(THEME_COLORS.PURPLE)
      .setTitle('👥 Global Fan Following & Clout Leaderboard')
      .setDescription(lines.join('\n') || 'No players found.')
      .setFooter({ text: 'Beyond The Final Whistle • Global Standings' })
      .setTimestamp();
    return await message.reply({ embeds: [embed] });
  }

  // Default overall ratings leaderboard
  const allPlayers = await prisma.player.findMany({ include: { nation: true }, take: 100 });
  const sorted = allPlayers.map(p => {
    const d = calculateDerivedRatings(p);
    const ovr = Math.round((d.atk + d.mid + d.def) / 3);
    return { player: p, ovr, derived: d };
  }).sort((a, b) => b.ovr - a.ovr).slice(0, 10);

  const lines = sorted.map((s, i) => {
    const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `\`#${i + 1}\``;
    return `${medal} **${s.player.username}** ${getNationFlag(s.player.nation)} ➔ **${s.ovr} OVR** \`[ A:${s.derived.atk} | M:${s.derived.mid} | D:${s.derived.def} ]\``;
  });

  const embed = new EmbedBuilder()
    .setColor(THEME_COLORS.PRIMARY)
    .setTitle('🏆 World Overall Ratings Leaderboard')
    .setDescription(
      lines.join('\n') +
      `\n\n${subtext('💡 Other leaderboards: `-lb goals`, `-lb wealth`, `-lb followers`')}`
    )
    .setFooter({ text: 'Beyond The Final Whistle • Global Standings' })
    .setTimestamp();

  await message.reply({ embeds: [embed] });
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
