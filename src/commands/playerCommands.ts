import { Message, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, User, Guild } from 'discord.js';
import { prisma } from '../database/prisma.js';
import { CAMPUS_LOCATIONS, PLAYSTYLES, ITEM_CATALOG } from '../config/constants.js';
import { calculateDerivedRatings } from '../engines/matchSimulationEngine.js';
import { giveMoney } from '../engines/socialEngine.js';
import { formatK, getNationFlag } from '../utils/formatHelper.js';
import { getEmoji } from '../utils/emojiHelper.js';

export function buildProfileTabsRow(targetUserId: string, currentTab: 'main' | 'stats' | 'attr') {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`profile_main_${targetUserId}`)
      .setLabel('Main Profile')
      .setEmoji('👤')
      .setStyle(currentTab === 'main' ? ButtonStyle.Primary : ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`profile_stats_${targetUserId}`)
      .setLabel('Detailed Stats')
      .setEmoji('📊')
      .setStyle(currentTab === 'stats' ? ButtonStyle.Primary : ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`profile_attr_${targetUserId}`)
      .setLabel('Attributes')
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
  const vipBadge = player.vipTier >= 2 ? '👑 [PREMIUM]' : player.vipTier === 1 ? '⭐ [VIP]' : '';
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
  const itemSymbols = (player.inventory || []).map((i: any) => `${i.emoji} ${i.name}`);
  const vehicleSymbols = (player.vehicles || []).map((v: any) => `${carEmoji} ${v.name}`);
  const allCollectables = [...itemSymbols, ...vehicleSymbols];
  const collectablesText = allCollectables.length > 0 ? allCollectables.join(' • ') : '(empty)';

  if (tab === 'main') {
    const bootStatus = player.activeBoots ? `👟 Boots: \`${player.activeBoots.toUpperCase()}\`` : '👟 Boots: `None`';
    const intelStatus = player.intelBonus > 0 ? `🛰️ Intel: \`+${player.intelBonus} ${player.intelStat || 'Boost'}\`` : '🛰️ Intel: `None`';

    return new EmbedBuilder()
      .setColor('#2b2d31')
      .setTitle(`⚽ ${player.username} ${flag} Career Profile ${vipBadge}`)
      .setDescription(
        `*"${player.bio || 'Rookie footballer aiming for the World Cup.'}"*\n\n` +
        `📍 **Location:** ${loc.emoji} **${loc.name}**\n` +
        `${staminaEmoji} **Stamina:** \`${player.stamina}/100\` | ${tpEmoji} **Training Points:** \`${player.trainingPoints} TP\`\n` +
        `${coinEmoji} **Net Worth:** \`${formatK(player.coins)}\` | ${followersEmoji} **Followers:** \`${formatK(player.followers)}\`\n` +
        `${bootStatus} | ${intelStatus}`
      )
      .addFields(
        {
          name: '📊 Overall Ratings',
          value: `🅰️ **ATK:** \`${derived.atk}\` | 🏃 **MID:** \`${derived.mid}\` | 🛡️ **DEF:** \`${derived.def}\``,
          inline: false
        },
        {
          name: `🎭 Playstyle: ${style.emoji} ${style.name} (${style.position})`,
          value: `*${style.description}*\n**Key Stats:** ${style.keyStats.map(s => `\`${s.toUpperCase()}\``).join(', ')}`,
          inline: false
        },
        {
          name: '🛡️ Teams & Nation',
          value: `• National Team: **${player.nation?.name || 'Free Agent (-joinnation)'}** ${flag}\n• Club: **${player.club?.name || 'Free Agent'}**`,
          inline: true
        },
        {
          name: '📈 Recent Form (Last 5)',
          value: `\`${recentForm.join('  •  ')}\``,
          inline: true
        },
        {
          name: '🎁 Collectables & Garage',
          value: collectablesText,
          inline: false
        }
      )
      .setThumbnail(targetUser.displayAvatarURL())
      .setFooter({ text: 'WITS • Career Player Profile • Tab 1/3' });
  }

  if (tab === 'stats') {
    return new EmbedBuilder()
      .setColor('#2b2d31')
      .setTitle(`📊 ${player.username} ${flag} Detailed Career Match Stats`)
      .setDescription(`Career match record for **${player.username}** across all competitions.`)
      .addFields(
        {
          name: '🎯 Attacking & Passing Telemetry',
          value:
            `• Matches Played: **${player.matchesPlayed}**\n` +
            `• Goals Scored: **${player.goalsScored}** ⚽\n` +
            `• Assists: **${player.assists}** 👟\n` +
            `• Shots (On Target): **${player.shots}** (**${player.shotsOnTarget}**)\n` +
            `• Passes (Completed): **${player.passesAttempted}** (**${player.passesCompleted}**)\n` +
            `• Key Passes: **${player.keyPasses}** | Second Assists: **${player.secondAssists}**\n` +
            `• Dribbles Attempted: **${player.dribblesAttempted}**`,
          inline: true
        },
        {
          name: '🛡️ Defending & Discipline',
          value:
            `• Dribbles Completed: **${player.dribblesCompleted}**\n` +
            `• Tackles (Won): **${player.tacklesAttempted}** (**${player.tacklesWon}**)\n` +
            `• Interceptions: **${player.interceptions}**\n` +
            `• Clearances: **${player.clearances}**\n` +
            `• Clean Sheets: **${player.cleanSheets}** 🧤\n` +
            `• Yellow Cards: **${player.yellowCards}** 🟨 | Red Cards: **${player.redCards}** 🟥\n` +
            `• MOTM Awards: **${player.motmCount}** 👑`,
          inline: true
        }
      )
      .setThumbnail(targetUser.displayAvatarURL())
      .setFooter({ text: 'WITS • Detailed Match Telemetry • Tab 2/3' });
  }

  // Attributes tab
  return new EmbedBuilder()
    .setColor('#2b2d31')
    .setTitle(`🎯 ${player.username} ${flag} 15 Football Attributes`)
    .setDescription(
      `Role: ${style.emoji} **${style.name} (${style.code})** • Position: **${style.position}**\n` +
      `*Spend TP at the Research Facility (\`-travel rf\` ➔ \`-sptrain <attr>\`)*`
    )
    .addFields(
      {
        name: '🎯 Attacking Attributes',
        value: `• Finishing (FIN): \`${player.fin}\`\n• Shot Power (POW): \`${player.pow}\`\n• Heading (HEA): \`${player.hea}\``,
        inline: true
      },
      {
        name: '🪄 Technical Attributes',
        value: `• Passing (PAS): \`${player.pas}\`\n• Vision (VIS): \`${player.vis}\`\n• Crossing (CRO): \`${player.cro}\`\n• Dribbling (DRI): \`${player.dri}\``,
        inline: true
      },
      {
        name: '🛡️ Defending Attributes',
        value: `• Tackling (TCK): \`${player.tck}\`\n• Interceptions (INT): \`${player.int}\`\n• Marking (MRK): \`${player.mrk}\``,
        inline: true
      },
      {
        name: '⚡ Physical & Mental',
        value: `• Pace (PAC): \`${player.pac}\`\n• Physicality (PHY): \`${player.phy}\`\n• Composure (CMP): \`${player.cmp}\`\n• Agility (AGI): \`${player.agi}\`\n• Work Rate (WRK): \`${player.wrk}\``,
        inline: false
      }
    )
    .setThumbnail(targetUser.displayAvatarURL())
    .setFooter({ text: 'WITS • Attributes Matrix • Tab 3/3' });
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
    const lines = leaders.map((p, i) => `${i + 1}. **${p.username}** ${getNationFlag(p.nation)} — **${p.goalsScored} goals** ⚽`);
    const embed = new EmbedBuilder()
      .setColor('#f59e0b')
      .setTitle('🏆 Top Goalscorers Leaderboard')
      .setDescription(lines.join('\n') || 'No goals recorded yet.')
      .setFooter({ text: 'Beyond The Final Whistle Leaderboards' });
    return await message.reply({ embeds: [embed] });
  }

  if (category === 'wealth' || category === 'money' || category === 'coins') {
    const coinEmoji = getEmoji(message.guild, 'coin');
    const leaders = await prisma.player.findMany({
      orderBy: { coins: 'desc' },
      take: 10,
      include: { nation: true }
    });
    const lines = leaders.map((p, i) => `${i + 1}. **${p.username}** ${getNationFlag(p.nation)} — **${formatK(p.coins)}** ${coinEmoji}`);
    const embed = new EmbedBuilder()
      .setColor('#eab308')
      .setTitle(`${coinEmoji} Net Worth & Wealth Leaderboard`)
      .setDescription(lines.join('\n') || 'No wealth recorded.')
      .setFooter({ text: 'Beyond The Final Whistle Leaderboards' });
    return await message.reply({ embeds: [embed] });
  }

  if (category === 'followers' || category === 'fans') {
    const leaders = await prisma.player.findMany({
      orderBy: { followers: 'desc' },
      take: 10,
      include: { nation: true }
    });
    const lines = leaders.map((p, i) => `${i + 1}. **${p.username}** ${getNationFlag(p.nation)} — **${formatK(p.followers)} 👤**`);
    const embed = new EmbedBuilder()
      .setColor('#38bdf8')
      .setTitle('👥 Reputation & Followers Leaderboard')
      .setDescription(lines.join('\n') || 'No players found.')
      .setFooter({ text: 'Beyond The Final Whistle Leaderboards' });
    return await message.reply({ embeds: [embed] });
  }

  // Default overall ratings leaderboard
  const allPlayers = await prisma.player.findMany({ include: { nation: true }, take: 100 });
  const sorted = allPlayers.map(p => {
    const d = calculateDerivedRatings(p);
    const ovr = Math.round((d.atk + d.mid + d.def) / 3);
    return { player: p, ovr, derived: d };
  }).sort((a, b) => b.ovr - a.ovr).slice(0, 10);

  const lines = sorted.map((s, i) =>
    `${i + 1}. **${s.player.username}** ${getNationFlag(s.player.nation)} — **${s.ovr} OVR** (🅰️ ${s.derived.atk} | 🏃 ${s.derived.mid} | 🛡️ ${s.derived.def})`
  );

  const embed = new EmbedBuilder()
    .setColor('#3b82f6')
    .setTitle('🏆 World Overall Ratings Leaderboard')
    .setDescription(
      lines.join('\n') +
      `\n\n*Other leaderboards:* \`-lb goals\`, \`-lb wealth\`, \`-lb followers\``
    )
    .setFooter({ text: 'Beyond The Final Whistle Leaderboards' });

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

  const coinEmoji = getEmoji(message.guild, 'coin');
  const bonusMsg = isFirstTime ? `\n🎁 **Welcome Bonus:** Received **+100k coins** ${coinEmoji} and **+100k followers 👤** for joining your first National Team!` : '';
  await message.reply(`🎉 You are now officially capped for **${nation.name}** ${nation.flag}!${bonusMsg}`);
}
