import { Message, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, Guild, PermissionFlagsBits } from 'discord.js';
import { prisma } from '../database/prisma.js';
import { calculateDerivedRatings } from '../engines/matchSimulationEngine.js';
import { THEME_COLORS, UI, subtext } from '../utils/themeHelper.js';
import { formatK } from '../utils/formatHelper.js';
import { resolveTargetUser } from '../utils/userResolver.js';

export async function handleIntTeamCommand(message: Message, args: string[]) {
  const caller = await prisma.player.findUnique({
    where: { id: message.author.id },
    include: { nation: true }
  });

  const queryAlias = args[0]?.toLowerCase();
  let nation: any = null;

  if (queryAlias) {
    nation = await prisma.nationalTeam.findUnique({
      where: { alias: queryAlias },
      include: { players: true }
    });
  } else if (caller?.nationId) {
    nation = await prisma.nationalTeam.findUnique({
      where: { id: caller.nationId },
      include: { players: true }
    });
  }

  if (!nation) {
    return await message.reply(
      '❌ National team not found. Usage: `-intteam <alias>` (e.g. `-intteam eng`, `-intteam bra`) or join a nation with `-joinnation <alias>`.'
    );
  }

  const isOwnNation = caller?.nationId === nation.id;

  // Parse starting XI
  let lineupIds: string[] = [];
  try {
    lineupIds = JSON.parse(nation.lineup || '[]');
  } catch {
    lineupIds = [];
  }

  const formatPlayerTag = (id?: string | null) => {
    if (!id) return '*Unassigned*';
    const p = nation.players.find((pl: any) => pl.id === id);
    return p ? `**${p.username}** (<@${id}>)` : `<@${id}>`;
  };

  const capText = nation.captainId ? formatPlayerTag(nation.captainId) : '*None appointed*';
  const vcText = nation.viceCaptainId ? formatPlayerTag(nation.viceCaptainId) : '*None appointed*';

  const atkStarter = formatPlayerTag(lineupIds[0]);
  const midStarter = formatPlayerTag(lineupIds[1]);
  const defStarter = formatPlayerTag(lineupIds[2]);

  // Set-piece takers (FK, Corner, Pen)
  const fkText = nation.fkTakerId ? formatPlayerTag(nation.fkTakerId) : (nation.setPieceTakerId ? formatPlayerTag(nation.setPieceTakerId) : '*Best Active Specialist*');
  const cornerText = nation.cornerTakerId ? formatPlayerTag(nation.cornerTakerId) : (nation.setPieceTakerId ? formatPlayerTag(nation.setPieceTakerId) : '*Best Active Specialist*');
  const penText = nation.penTakerId ? formatPlayerTag(nation.penTakerId) : (nation.setPieceTakerId ? formatPlayerTag(nation.setPieceTakerId) : '*Best Active Specialist*');

  // Squad list
  const squadLines = nation.players.map((p: any) => {
    const d = calculateDerivedRatings(p);
    const ovr = Math.round((d.atk + d.mid + d.def) / 3);
    const isCap = p.id === nation.captainId ? ' 👑 (C)' : p.id === nation.viceCaptainId ? ' 🎖️ (VC)' : '';
    return `• **${p.username}** \`[${ovr} OVR | ${p.position}]\`${isCap} — <@${p.id}>`;
  });

  const embed = new EmbedBuilder()
    .setColor(isOwnNation ? THEME_COLORS.GOLD : THEME_COLORS.PRIMARY)
    .setTitle(`🌍 ${nation.name} ${nation.flag} — National Team Dossier`)
    .setDescription(
      `**Federation Alias:** \`${nation.alias.toUpperCase()}\` • **Registered Squad:** ${nation.players.length} Players\n\n` +
      `### 👑 Leadership\n` +
      `• **Captain (C):** ${capText}\n` +
      `• **Vice-Captain (VC):** ${vcText}\n\n` +
      `### ⚡ Starting 3 Lineup\n` +
      `• ⚔️ **Striker (ATK):** ${atkStarter}\n` +
      `• 🪄 **Playmaker (MID):** ${midStarter}\n` +
      `• 🛡️ **Anchor (DEF):** ${defStarter}\n\n` +
      `### 🎯 Set-Piece Specialists\n` +
      `• 🎯 **Direct Free Kicks:** ${fkText}\n` +
      `• 🚩 **Corner Kicks:** ${cornerText}\n` +
      `• 🥅 **Penalty Taker:** ${penText}\n\n` +
      `### 📋 Active Roster (${nation.players.length})\n` +
      (squadLines.length > 0 ? squadLines.join('\n') : '*No players currently registered. Sign up with `-joinnation`!*')
    )
    .setFooter({
      text: isOwnNation
        ? 'Set all 3 starters at once: -intlineup <atk> <mid> <def> (or -intset <role> <player>)'
        : 'Beyond The Final Whistle • International Federation'
    })
    .setTimestamp();

  if (isOwnNation) {
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`team_tactics_${nation.id}`)
        .setLabel('Tactical Playbook')
        .setEmoji('🧠')
        .setStyle(ButtonStyle.Primary)
    );
    await message.reply({ embeds: [embed], components: [row] });
  } else {
    await message.reply({ embeds: [embed] });
  }
}

export async function handleIntSetCommand(message: Message, args: string[]) {
  const role = args[0]?.toLowerCase();
  const targetToken = args.slice(1).join(' ').trim();

  const validRoles = ['cap', 'captain', 'c', 'vc', 'atk', 'mid', 'def', 'fk', 'corner', 'pen'];
  if (!role || !validRoles.includes(role) || !targetToken) {
    return await message.reply(
      '❌ **Usage:** `-intset <cap|vc|atk|mid|def|fk|corner|pen> <username or @player>`\n' +
      '• `cap`: Appoint Team Captain 👑\n' +
      '• `vc`: Appoint Vice-Captain 🎖️\n' +
      '• `atk` / `mid` / `def`: Set Starting Lineup position\n' +
      '• `fk` / `corner` / `pen`: Designate Set-Piece specialist\n\n' +
      '*💡 Tip: You can type their username or display name without pinging, or set all 3 starters at once with `-intlineup <atk> <mid> <def>`!*'
    );
  }

  const caller = await prisma.player.findUnique({
    where: { id: message.author.id },
    include: { nation: { include: { players: true } } }
  });

  if (!caller?.nationId || !caller.nation) {
    return await message.reply('❌ You are not affiliated with any national team. Join one with `-joinnation <alias>`.');
  }

  const nation = caller.nation;
  const isLeader = caller.id === nation.captainId || caller.id === nation.viceCaptainId || message.member?.permissions.has(PermissionFlagsBits.Administrator) || message.author.id === '478599245276905495';
  if (!isLeader) {
    return await message.reply('❌ Only the national team **Captain**, **Vice-Captain**, or an **Administrator** can set team assignments!');
  }

  // Resolve target from mention or username among nation players or general users
  const resolved = await resolveTargetUser(message, targetToken, nation.players);
  if (!resolved) {
    return await message.reply(`❌ Player "${targetToken}" not found. You can pass their username, display name, or ping.`);
  }

  // Ensure target is member of same national team
  const isMember = nation.players.some((p: any) => p.id === resolved.id);
  if (!isMember) {
    return await message.reply(`❌ **${resolved.username}** is not a member of **${nation.name}**!`);
  }

  let lineupIds: string[] = [];
  try {
    lineupIds = JSON.parse(nation.lineup || '[]');
  } catch {
    lineupIds = [];
  }
  while (lineupIds.length < 3) lineupIds.push('');

  let updateData: any = {};
  let roleTitle = '';

  switch (role) {
    case 'cap':
    case 'captain':
    case 'c': {
      const canSetCap = caller.id === nation.captainId || !nation.captainId || message.member?.permissions.has(PermissionFlagsBits.Administrator) || message.author.id === '478599245276905495';
      if (!canSetCap) {
        return await message.reply('❌ Only the current **Captain** or a server **Administrator** can appoint or transfer the captaincy armband 👑!');
      }
      updateData.captainId = resolved.id;
      roleTitle = 'Team Captain 👑 (C)';
      break;
    }
    case 'vc':
      updateData.viceCaptainId = resolved.id;
      roleTitle = 'Vice-Captain 🎖️';
      break;
    case 'atk':
      lineupIds[0] = resolved.id;
      updateData.lineup = JSON.stringify(lineupIds);
      roleTitle = 'Starting Striker (ATK) ⚡';
      break;
    case 'mid':
      lineupIds[1] = resolved.id;
      updateData.lineup = JSON.stringify(lineupIds);
      roleTitle = 'Starting Playmaker (MID) 🎯';
      break;
    case 'def':
      lineupIds[2] = resolved.id;
      updateData.lineup = JSON.stringify(lineupIds);
      roleTitle = 'Starting Anchor (DEF) 🛡️';
      break;
    case 'fk':
      updateData.fkTakerId = resolved.id;
      roleTitle = 'Direct Free Kick Specialist 🎯';
      break;
    case 'corner':
      updateData.cornerTakerId = resolved.id;
      roleTitle = 'Corner Kick Specialist 🚩';
      break;
    case 'pen':
      updateData.penTakerId = resolved.id;
      roleTitle = 'Penalty Taker 🥅';
      break;
  }

  await prisma.nationalTeam.update({
    where: { id: nation.id },
    data: updateData
  });

  await message.reply(
    `✅ Successfully designated **${resolved.username}** as **${nation.name}**'s **${roleTitle}**!`
  );
}

export async function handleIntLineupCommand(message: Message, args: string[]) {
  const caller = await prisma.player.findUnique({
    where: { id: message.author.id },
    include: { nation: { include: { players: true } } }
  });

  if (!caller?.nationId || !caller.nation) {
    return await message.reply('❌ You are not affiliated with any national team. Join one with `-joinnation <alias>`.');
  }

  const nation = caller.nation;

  // If no arguments, show current starting 3
  if (args.length === 0) {
    let currentLineup: string[] = [];
    try { currentLineup = JSON.parse(nation.lineup || '[]'); } catch { currentLineup = []; }
    const getP = (id?: string) => {
      if (!id) return '*Unassigned*';
      const pl = nation.players.find((p: any) => p.id === id);
      return pl ? `**${pl.username}** (<@${id}>)` : `<@${id}>`;
    };

    const embed = new EmbedBuilder()
      .setColor('#22c55e')
      .setTitle(`⚡ ${nation.name} ${nation.flag} — Starting 3 Lineup`)
      .setDescription(
        `• ⚔️ **Starting ATK:** ${getP(currentLineup[0])}\n` +
        `• 🪄 **Starting MID:** ${getP(currentLineup[1])}\n` +
        `• 🛡️ **Starting DEF:** ${getP(currentLineup[2])}\n\n` +
        `*Update all 3 anytime:* \`-intlineup <atk> <mid> <def>\`\n` +
        `*Example:* \`-intlineup ronaldo messi ramos\` (no pings needed!)`
      );
    return await message.reply({ embeds: [embed] });
  }

  const isLeader = caller.id === nation.captainId || caller.id === nation.viceCaptainId || message.member?.permissions.has(PermissionFlagsBits.Administrator) || message.author.id === '478599245276905495';
  if (!isLeader) {
    return await message.reply('❌ Only the national team **Captain**, **Vice-Captain**, or an **Administrator** can update the starting lineup!');
  }

  if (args.length < 3) {
    return await message.reply(
      '⚠️ Please provide all 3 starting players: **ATK**, **MID**, and **DEF**.\n' +
      '**Usage:** `-intlineup <atk_player> <mid_player> <def_player>`\n' +
      '**Example:** `-intlineup ronaldo messi ramos` (you can use plain usernames or @mentions!)'
    );
  }

  const atkTarget = await resolveTargetUser(message, args[0], nation.players);
  const midTarget = await resolveTargetUser(message, args[1], nation.players);
  const defTarget = await resolveTargetUser(message, args[2], nation.players);

  if (!atkTarget) return await message.reply(`❌ Could not find striker (ATK) player: "${args[0]}" in ${nation.name}.`);
  if (!midTarget) return await message.reply(`❌ Could not find playmaker (MID) player: "${args[1]}" in ${nation.name}.`);
  if (!defTarget) return await message.reply(`❌ Could not find anchor (DEF) player: "${args[2]}" in ${nation.name}.`);

  // Verify all 3 belong to nation
  const isAtkMember = nation.players.some((p: any) => p.id === atkTarget.id);
  const isMidMember = nation.players.some((p: any) => p.id === midTarget.id);
  const isDefMember = nation.players.some((p: any) => p.id === defTarget.id);

  if (!isAtkMember) return await message.reply(`❌ **${atkTarget.username}** is not registered in **${nation.name}**!`);
  if (!isMidMember) return await message.reply(`❌ **${midTarget.username}** is not registered in **${nation.name}**!`);
  if (!isDefMember) return await message.reply(`❌ **${defTarget.username}** is not registered in **${nation.name}**!`);

  // Ensure unique starters
  const uniqueIds = new Set([atkTarget.id, midTarget.id, defTarget.id]);
  if (uniqueIds.size < 3) {
    return await message.reply('❌ A player cannot be assigned to multiple starting slots simultaneously! Choose 3 distinct footballers.');
  }

  const newLineup = [atkTarget.id, midTarget.id, defTarget.id];
  await prisma.nationalTeam.update({
    where: { id: nation.id },
    data: { lineup: JSON.stringify(newLineup) }
  });

  const successEmbed = new EmbedBuilder()
    .setColor('#22c55e')
    .setTitle(`✅ Starting Lineup Locked: ${nation.name} ${nation.flag}`)
    .setDescription(
      `The national team starting three have been updated for upcoming fixtures:\n\n` +
      `• ⚔️ **Starting Striker (ATK):** **${atkTarget.username}** (<@${atkTarget.id}>)\n` +
      `• 🪄 **Starting Playmaker (MID):** **${midTarget.username}** (<@${midTarget.id}>)\n` +
      `• 🛡️ **Starting Anchor (DEF):** **${defTarget.username}** (<@${defTarget.id}>)\n\n` +
      `*Updated by Captain/Leader <@${caller.id}>.*`
    )
    .setFooter({ text: `${nation.name} • Matchday Ready` })
    .setTimestamp();

  await message.reply({ embeds: [successEmbed] });
}

export async function handleClubSetCommand(message: Message, args: string[]) {
  const role = args[0]?.toLowerCase();
  const targetToken = args.slice(1).join(' ').trim();

  const validRoles = ['cap', 'captain', 'c', 'vc', 'atk', 'mid', 'def', 'fk', 'corner', 'pen'];
  if (!role || !validRoles.includes(role) || !targetToken) {
    return await message.reply(
      '❌ **Usage:** `-clubset <cap|vc|atk|mid|def|fk|corner|pen> <username or @player>`\n' +
      '• `cap`: Appoint Club Captain 👑\n' +
      '• `vc`: Appoint Vice-Captain 🎖️\n' +
      '• `atk` / `mid` / `def`: Set Starting Lineup position\n' +
      '• `fk` / `corner` / `pen`: Designate Set-Piece specialist\n\n' +
      '*💡 Tip: You can type their username or display name without pinging, or set all 3 starters with `-clublineup <atk> <mid> <def>`!*'
    );
  }

  const caller = await prisma.player.findUnique({
    where: { id: message.author.id },
    include: { club: { include: { players: true } } }
  });

  if (!caller?.clubId || !caller.club) {
    return await message.reply('❌ You are not affiliated with any football club. Join one with `-joinclub <alias>`.');
  }

  const club = caller.club;
  const isLeader = caller.id === club.captainId || caller.id === club.viceCaptainId || message.member?.permissions.has(PermissionFlagsBits.Administrator) || message.author.id === '478599245276905495';
  if (!isLeader) {
    return await message.reply('❌ Only the club **Captain**, **Vice-Captain**, or an **Administrator** can set team assignments!');
  }

  // Resolve target from mention or username
  const resolved = await resolveTargetUser(message, targetToken, club.players);
  if (!resolved) {
    return await message.reply(`❌ Player "${targetToken}" not found. You can pass their username, display name, or ping.`);
  }

  const isMember = club.players.some((p: any) => p.id === resolved.id);
  if (!isMember) {
    return await message.reply(`❌ **${resolved.username}** is not a registered player of **${club.name}**!`);
  }

  let lineupIds: string[] = [];
  try {
    lineupIds = JSON.parse(club.lineup || '[]');
  } catch {
    lineupIds = [];
  }
  while (lineupIds.length < 3) lineupIds.push('');

  let updateData: any = {};
  let roleTitle = '';

  switch (role) {
    case 'cap':
    case 'captain':
    case 'c': {
      const canSetCap = caller.id === club.captainId || !club.captainId || message.member?.permissions.has(PermissionFlagsBits.Administrator) || message.author.id === '478599245276905495';
      if (!canSetCap) {
        return await message.reply('❌ Only the current **Captain** or a server **Administrator** can appoint the club captaincy armband 👑!');
      }
      updateData.captainId = resolved.id;
      roleTitle = 'Club Captain 👑 (C)';
      break;
    }
    case 'vc':
      updateData.viceCaptainId = resolved.id;
      roleTitle = 'Vice-Captain 🎖️';
      break;
    case 'atk':
      lineupIds[0] = resolved.id;
      updateData.lineup = JSON.stringify(lineupIds);
      roleTitle = 'Starting Striker (ATK) ⚡';
      break;
    case 'mid':
      lineupIds[1] = resolved.id;
      updateData.lineup = JSON.stringify(lineupIds);
      roleTitle = 'Starting Playmaker (MID) 🎯';
      break;
    case 'def':
      lineupIds[2] = resolved.id;
      updateData.lineup = JSON.stringify(lineupIds);
      roleTitle = 'Starting Anchor (DEF) 🛡️';
      break;
    case 'fk':
      updateData.fkTakerId = resolved.id;
      roleTitle = 'Direct Free Kick Specialist 🎯';
      break;
    case 'corner':
      updateData.cornerTakerId = resolved.id;
      roleTitle = 'Corner Kick Specialist 🚩';
      break;
    case 'pen':
      updateData.penTakerId = resolved.id;
      roleTitle = 'Penalty Taker 🥅';
      break;
  }

  await prisma.footballClub.update({
    where: { id: club.id },
    data: updateData
  });

  await message.reply(
    `✅ Successfully designated **${resolved.username}** as **${club.name}**'s **${roleTitle}**!`
  );
}

export async function handleClubLineupCommand(message: Message, args: string[]) {
  const caller = await prisma.player.findUnique({
    where: { id: message.author.id },
    include: { club: { include: { players: true } } }
  });

  if (!caller?.clubId || !caller.club) {
    return await message.reply('❌ You are not affiliated with any football club. Join one with `-joinclub <alias>`.');
  }

  const club = caller.club;

  // If no arguments, show current starting 3
  if (args.length === 0) {
    let currentLineup: string[] = [];
    try { currentLineup = JSON.parse(club.lineup || '[]'); } catch { currentLineup = []; }
    const getP = (id?: string) => {
      if (!id) return '*Unassigned*';
      const pl = club.players.find((p: any) => p.id === id);
      return pl ? `**${pl.username}** (<@${id}>)` : `<@${id}>`;
    };

    const embed = new EmbedBuilder()
      .setColor('#38bdf8')
      .setTitle(`⚡ ${club.name} — Starting 3 Lineup`)
      .setDescription(
        `• ⚔️ **Starting ATK:** ${getP(currentLineup[0])}\n` +
        `• 🪄 **Starting MID:** ${getP(currentLineup[1])}\n` +
        `• 🛡️ **Starting DEF:** ${getP(currentLineup[2])}\n\n` +
        `*Update all 3 anytime:* \`-clublineup <atk> <mid> <def>\`\n` +
        `*Example:* \`-clublineup ronaldo messi ramos\` (no pings needed!)`
      );
    return await message.reply({ embeds: [embed] });
  }

  const isLeader = caller.id === club.captainId || caller.id === club.viceCaptainId || message.member?.permissions.has(PermissionFlagsBits.Administrator) || message.author.id === '478599245276905495';
  if (!isLeader) {
    return await message.reply('❌ Only the club **Captain**, **Vice-Captain**, or an **Administrator** can update the starting lineup!');
  }

  if (args.length < 3) {
    return await message.reply(
      '⚠️ Please provide all 3 starting players: **ATK**, **MID**, and **DEF**.\n' +
      '**Usage:** `-clublineup <atk_player> <mid_player> <def_player>`\n' +
      '**Example:** `-clublineup ronaldo messi ramos` (you can use plain usernames or @mentions!)'
    );
  }

  const atkTarget = await resolveTargetUser(message, args[0], club.players);
  const midTarget = await resolveTargetUser(message, args[1], club.players);
  const defTarget = await resolveTargetUser(message, args[2], club.players);

  if (!atkTarget) return await message.reply(`❌ Could not find striker (ATK) player: "${args[0]}" in ${club.name}.`);
  if (!midTarget) return await message.reply(`❌ Could not find playmaker (MID) player: "${args[1]}" in ${club.name}.`);
  if (!defTarget) return await message.reply(`❌ Could not find anchor (DEF) player: "${args[2]}" in ${club.name}.`);

  const isAtkMember = club.players.some((p: any) => p.id === atkTarget.id);
  const isMidMember = club.players.some((p: any) => p.id === midTarget.id);
  const isDefMember = club.players.some((p: any) => p.id === defTarget.id);

  if (!isAtkMember) return await message.reply(`❌ **${atkTarget.username}** is not registered in **${club.name}**!`);
  if (!isMidMember) return await message.reply(`❌ **${midTarget.username}** is not registered in **${club.name}**!`);
  if (!isDefMember) return await message.reply(`❌ **${defTarget.username}** is not registered in **${club.name}**!`);

  const uniqueIds = new Set([atkTarget.id, midTarget.id, defTarget.id]);
  if (uniqueIds.size < 3) {
    return await message.reply('❌ A player cannot be assigned to multiple starting slots simultaneously! Choose 3 distinct footballers.');
  }

  const newLineup = [atkTarget.id, midTarget.id, defTarget.id];
  await prisma.footballClub.update({
    where: { id: club.id },
    data: { lineup: JSON.stringify(newLineup) }
  });

  const successEmbed = new EmbedBuilder()
    .setColor('#38bdf8')
    .setTitle(`✅ Starting Lineup Locked: ${club.name}`)
    .setDescription(
      `The club starting three have been updated for upcoming fixtures:\n\n` +
      `• ⚔️ **Starting Striker (ATK):** **${atkTarget.username}** (<@${atkTarget.id}>)\n` +
      `• 🪄 **Starting Playmaker (MID):** **${midTarget.username}** (<@${midTarget.id}>)\n` +
      `• 🛡️ **Starting Anchor (DEF):** **${defTarget.username}** (<@${defTarget.id}>)\n\n` +
      `*Updated by Captain/Leader <@${caller.id}>.*`
    )
    .setFooter({ text: `${club.name} • Matchday Ready` })
    .setTimestamp();

  await message.reply({ embeds: [successEmbed] });
}

export async function handleLineupCommand(message: Message, args: string[]) {
  const caller = await prisma.player.findUnique({
    where: { id: message.author.id },
    include: { nation: true, club: true }
  });

  // If caller is in club and not nation, route to club
  if (!caller?.nationId && caller?.clubId) {
    return await handleClubLineupCommand(message, args);
  }

  // Default to national team lineup
  return await handleIntLineupCommand(message, args);
}
