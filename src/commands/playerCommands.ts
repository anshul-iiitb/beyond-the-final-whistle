import { Message, EmbedBuilder } from 'discord.js';
import { prisma } from '../database/prisma.js';
import { CAMPUS_LOCATIONS, PLAYSTYLES } from '../config/constants.js';
import { calculateDerivedRatings } from '../engines/matchSimulationEngine.js';
import { giveMoney } from '../engines/socialEngine.js';

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

  const derived = calculateDerivedRatings(player);
  const loc = CAMPUS_LOCATIONS[player.currentLocation] || CAMPUS_LOCATIONS.tc;
  const style = PLAYSTYLES[player.playstyle] || PLAYSTYLES.PCH;

  const vipBadge = player.vipTier >= 2 ? '👑 [PREMIUM]' : player.vipTier === 1 ? '⭐ [VIP]' : '';
  const bootStatus = player.activeBoots ? `👟 Boots: \`${player.activeBoots.toUpperCase()}\`` : '👟 Boots: `None`';
  const intelStatus = player.intelBonus > 0 ? `🛰️ Intel: \`+${player.intelBonus} ${player.intelStat || 'Boost'}\`` : '🛰️ Intel: `None`';

  const embed = new EmbedBuilder()
    .setColor('#3b82f6')
    .setTitle(`⚽ ${player.username}'s Football Career Profile ${vipBadge}`)
    .setDescription(
      `*"${player.bio}"*\n\n` +
      `📍 **Current Location:** ${loc.emoji} **${loc.name}**\n` +
      `⚡ **Stamina:** \`${player.stamina}/100\` | 🏃 **Training Points:** \`${player.trainingPoints} TP\`\n` +
      `🪙 **Net Worth:** \`${Number(player.coins).toLocaleString()} coins\` | 👥 **Followers:** \`${Number(player.followers).toLocaleString()}\`\n` +
      `${bootStatus} | ${intelStatus}`
    )
    .addFields(
      {
        name: '📊 Derived Overall Ratings',
        value: `🅰️ **ATK:** \`${derived.atk}\` | 🏃 **MID:** \`${derived.mid}\` | 🛡️ **DEF:** \`${derived.def}\``,
        inline: false
      },
      {
        name: `🎭 Playstyle: ${style.emoji} ${style.name} (${style.position})`,
        value: `*${style.description}*\n**Key Stats:** ${style.keyStats.map(s => `\`${s.toUpperCase()}\``).join(', ')}`,
        inline: false
      },
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
        value: `• Pace (PAC): \`${player.pac}\` | Phys (PHY): \`${player.phy}\`\n• Composure (CMP): \`${player.cmp}\` | Agility (AGI): \`${player.agi}\`\n• Work Rate (WRK): \`${player.wrk}\``,
        inline: false
      },
      {
        name: '🏆 Individual Career Stats',
        value: `• Matches: **${player.matchesPlayed}** | Goals: **${player.goalsScored}** ⚽ | Assists: **${player.assists}** 👟\n` +
               `• Shots: **${player.shots}** | Tackles Won: **${player.tacklesWon}** | Clean Sheets: **${player.cleanSheets}**\n` +
               `• Yellow: **${player.yellowCards}** 🟨 | Red: **${player.redCards}** 🟥 | MOTM Awards: **${player.motmCount} 👑**`,
        inline: false
      },
      {
        name: '🛡️ Teams & Garage',
        value: `• National Team: **${player.nation?.name || 'Free Agent (Use -joinnation)'}**\n` +
               `• Football Club: **${player.club?.name || 'Free Agent'}**\n` +
               `• Garage: **${player.vehicles.length} vehicle(s)** owned`,
        inline: false
      }
    )
    .setThumbnail(targetUser.displayAvatarURL())
    .setFooter({ text: 'Beyond The Final Whistle (BTFW) Football RPG' })
    .setTimestamp();

  await message.reply({ embeds: [embed] });
}

/**
 * Handles -setdesc <text>
 */
export async function handleSetDescCommand(message: Message, args: string[]) {
  const bio = args.join(' ').trim();
  if (!bio) {
    return await message.reply('❌ Please provide a description. Example: `-setdesc Lethal box striker chasing the Golden Boot.`');
  }

  if (bio.length > 100) {
    return await message.reply(`❌ Description exceeds maximum of 100 characters (Your length: ${bio.length} chars).`);
  }

  await prisma.player.upsert({
    where: { id: message.author.id },
    update: { bio },
    create: {
      id: message.author.id,
      username: message.author.username,
      bio
    }
  });

  await message.reply(`✅ Your profile description has been updated to:\n*"${bio}"*`);
}

/**
 * Handles -lb [category]
 */
export async function handleLeaderboardCommand(message: Message, args: string[]) {
  const category = args[0]?.toLowerCase() || 'goals';

  let title = '⚽ Most Goals Scored';
  let orderByField: any = { goalsScored: 'desc' };
  let formatter = (p: any) => `${p.goalsScored} goals (${(p.goalsScored / Math.max(1, p.matchesPlayed)).toFixed(2)} / match)`;

  if (category === 'assists' || category === 'a') {
    title = '👟 Most Assists';
    orderByField = { assists: 'desc' };
    formatter = (p: any) => `${p.assists} assists`;
  } else if (category === 'motm' || category === 'mvp') {
    title = '👑 Man of the Match (MOTM) Leaderboard';
    orderByField = { motmCount: 'desc' };
    formatter = (p: any) => `${p.motmCount} MOTM awards`;
  } else if (category === 'wealth' || category === 'coins') {
    title = '🪙 Wealth Leaderboard';
    orderByField = { coins: 'desc' };
    formatter = (p: any) => `${Number(p.coins).toLocaleString()} coins`;
  } else if (category === 'followers' || category === 'fans') {
    title = '👥 Fame & Follower Leaderboard';
    orderByField = { followers: 'desc' };
    formatter = (p: any) => `${Number(p.followers).toLocaleString()} followers`;
  } else if (category === 'tp' || category === 'training') {
    title = '🏃 Training Points (TP) Leaderboard';
    orderByField = { trainingPoints: 'desc' };
    formatter = (p: any) => `${p.trainingPoints} TP`;
  } else if (category === 'matches' || category === 'apps') {
    title = '🎯 Most Appearances';
    orderByField = { matchesPlayed: 'desc' };
    formatter = (p: any) => `${p.matchesPlayed} matches`;
  }

  const topPlayers = await prisma.player.findMany({
    orderBy: orderByField,
    take: 10
  });

  const medals = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];
  const lines = topPlayers.map((p, i) => `${medals[i] || '•'} **${p.username}** — ${formatter(p)}`);

  const embed = new EmbedBuilder()
    .setColor('#f1c40f')
    .setTitle(`🏆 Beyond The Final Whistle: ${title}`)
    .setDescription(lines.length > 0 ? lines.join('\n') : '*No player data recorded yet.*')
    .setFooter({ text: 'Categories: goals, assists, motm, coins, followers, tp, matches • Usage: -lb <category>' })
    .setTimestamp();

  await message.reply({ embeds: [embed] });
}

/**
 * Handles -give @user <amount>
 */
export async function handleGiveCommand(message: Message, args: string[]) {
  const targetUser = message.mentions.users.first();
  if (!targetUser) {
    return await message.reply('❌ Usage: `-give @user <amount>`');
  }

  const amountStr = args.find(a => !a.startsWith('<@') && !isNaN(Number(a.replace(/k|m/gi, ''))));
  if (!amountStr) {
    return await message.reply('❌ Please specify a valid coin amount. Example: `-give @user 50000` or `-give @user 100k`');
  }

  let amount = 0n;
  const clean = amountStr.toLowerCase().trim();
  if (clean.endsWith('k')) {
    amount = BigInt(Math.floor(parseFloat(clean.slice(0, -1)) * 1000));
  } else if (clean.endsWith('m')) {
    amount = BigInt(Math.floor(parseFloat(clean.slice(0, -1)) * 1000000));
  } else {
    amount = BigInt(Math.floor(parseFloat(clean)));
  }

  const result = await giveMoney(message.author.id, targetUser.id, amount);
  await message.reply(result.message);
}

/**
 * Handles -joinnation <alias>
 */
export async function handleJoinNationCommand(message: Message, args: string[]) {
  const nationAlias = args[0]?.toLowerCase();

  const defaultNations = [
    { name: 'Germany', flag: '🇩🇪', alias: 'ger' },
    { name: 'Spain', flag: '🇪🇸', alias: 'esp' },
    { name: 'Italy', flag: '🇮🇹', alias: 'ita' },
    { name: 'Croatia', flag: '🇭🇷', alias: 'cro' },
    { name: 'Morocco', flag: '🇲🇦', alias: 'mar' },
    { name: 'Brazil', flag: '🇧🇷', alias: 'bra' },
    { name: 'Belgium', flag: '🇧🇪', alias: 'bel' },
    { name: 'Portugal', flag: '🇵🇹', alias: 'por' },
    { name: 'France', flag: '🇫🇷', alias: 'fra' },
    { name: 'England', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', alias: 'eng' },
    { name: 'Norway', flag: '🇳🇴', alias: 'nor' },
    { name: 'Colombia', flag: '🇨🇴', alias: 'col' }
  ];

  if (!nationAlias) {
    const list = defaultNations.map(n => `• \`${n.alias}\` — ${n.flag} **${n.name}**`).join('\n');
    return await message.reply(`🌍 **Available National Teams:**\n${list}\n\n*Usage:* \`-joinnation <alias>\` (e.g. \`-joinnation ger\`, \`-joinnation por\`)`);
  }

  const target = defaultNations.find(n => n.alias === nationAlias || n.name.toLowerCase() === nationAlias);
  if (!target) {
    return await message.reply(`❌ Unknown nation \`${nationAlias}\`. Use \`-joinnation\` without arguments to see the roster.`);
  }

  const nationRecord = await prisma.nationalTeam.upsert({
    where: { alias: target.alias },
    update: {},
    create: {
      name: target.name,
      flag: target.flag,
      alias: target.alias
    }
  });

  await prisma.player.upsert({
    where: { id: message.author.id },
    update: { nationId: nationRecord.id },
    create: {
      id: message.author.id,
      username: message.author.username,
      nationId: nationRecord.id
    }
  });

  await message.reply(`🌍 **Call-Up Confirmed!**\nYou have proudly pledged allegiance to **${target.flag} ${target.name}**!\nYour nation stats and crest are now active.`);
}
