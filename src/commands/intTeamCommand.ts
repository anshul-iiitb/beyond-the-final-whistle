import { Message, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, Guild } from 'discord.js';
import { prisma } from '../database/prisma.js';
import { calculateDerivedRatings } from '../engines/matchSimulationEngine.js';
import { THEME_COLORS, UI, subtext } from '../utils/themeHelper.js';
import { formatK } from '../utils/formatHelper.js';

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
      [
        `Record: \`${nation.wins}W - ${nation.draws}D - ${nation.losses}L\` • Points: \`${nation.points}\` • Goals: \`${nation.goalsFor}:${nation.goalsAgainst}\``,
        `### 👑 Leadership\n` +
        `• **Captain:** ${capText}\n` +
        `• **Vice-Captain:** ${vcText}`,
        `### 📋 Starting Tactical Lineup\n` +
        `• ⚡ **Striker (ATK):** ${atkStarter}\n` +
        `• 🎯 **Playmaker (MID):** ${midStarter}\n` +
        `• 🛡️ **Anchor (DEF):** ${defStarter}`,
        isOwnNation
          ? `### 🎯 Set-Piece Specialists\n` +
            `• 🎯 **Direct Free Kicks:** ${fkText}\n` +
            `• 🚩 **Corner Kicks:** ${cornerText}\n` +
            `• 🥅 **Penalties:** ${penText}`
          : `### 🎯 Set-Piece Specialists\n` +
            `🔒 **[CONFIDENTIAL SCOUTING DATA]**\n` +
            `*Set-piece designations are classified and hidden from rival teams.*`,
        `### 👥 Official Squad Roster (${nation.players.length}/${nation.maxPlayers || 23})\n` +
        (squadLines.length > 0 ? squadLines.join('\n') : '*No registered players yet.*'),
        `${UI.DIVIDER}\n` +
        (isOwnNation
          ? subtext('💡 Leaders can assign roles using `-intset <vc|atk|mid|def|fk|corner|pen> @player`. Click below to open tactics!')
          : subtext(`Scouting dossier for rival nation ${nation.name} ${nation.flag}.`))
      ].join(UI.SPACER)
    )
    .setFooter({ text: 'Beyond The Final Whistle • International Football Federation' })
    .setTimestamp();

  if (isOwnNation) {
    const tacticsButton = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`tactics_page_attack_nation_${nation.id}`)
        .setLabel('⚙️ Tactical Playbook')
        .setStyle(ButtonStyle.Primary)
    );
    await message.reply({ embeds: [embed], components: [tacticsButton] });
  } else {
    await message.reply({ embeds: [embed] });
  }
}

export async function handleIntSetCommand(message: Message, args: string[]) {
  const role = args[0]?.toLowerCase();
  const targetUser = message.mentions.users.first();

  const validRoles = ['vc', 'atk', 'mid', 'def', 'fk', 'corner', 'pen'];
  if (!role || !validRoles.includes(role) || !targetUser) {
    return await message.reply(
      '❌ **Usage:** `-intset <vc|atk|mid|def|fk|corner|pen> @player`\n' +
      '• `vc`: Appoint Vice-Captain\n' +
      '• `atk` / `mid` / `def`: Set Starting Lineup position\n' +
      '• `fk` / `corner` / `pen`: Designate Set-Piece specialist'
    );
  }

  const caller = await prisma.player.findUnique({
    where: { id: message.author.id },
    include: { nation: true }
  });

  if (!caller?.nationId || !caller.nation) {
    return await message.reply('❌ You are not affiliated with any national team. Join one with `-joinnation <alias>`.');
  }

  const nation = caller.nation;
  const isLeader = caller.id === nation.captainId || caller.id === nation.viceCaptainId || message.member?.permissions.has('Administrator');
  if (!isLeader) {
    return await message.reply('❌ Only the national team **Captain** or **Vice-Captain** can set team assignments!');
  }

  // Ensure target is member of same national team
  const targetPlayer = await prisma.player.findUnique({ where: { id: targetUser.id } });
  if (!targetPlayer || targetPlayer.nationId !== nation.id) {
    return await message.reply(`❌ **${targetUser.username}** is not a member of **${nation.name}**!`);
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
    case 'vc':
      updateData.viceCaptainId = targetUser.id;
      roleTitle = 'Vice-Captain 🎖️';
      break;
    case 'atk':
      lineupIds[0] = targetUser.id;
      updateData.lineup = JSON.stringify(lineupIds);
      roleTitle = 'Starting Striker (ATK) ⚡';
      break;
    case 'mid':
      lineupIds[1] = targetUser.id;
      updateData.lineup = JSON.stringify(lineupIds);
      roleTitle = 'Starting Playmaker (MID) 🎯';
      break;
    case 'def':
      lineupIds[2] = targetUser.id;
      updateData.lineup = JSON.stringify(lineupIds);
      roleTitle = 'Starting Anchor (DEF) 🛡️';
      break;
    case 'fk':
      updateData.fkTakerId = targetUser.id;
      roleTitle = 'Direct Free Kick Specialist 🎯';
      break;
    case 'corner':
      updateData.cornerTakerId = targetUser.id;
      roleTitle = 'Corner Kick Specialist 🚩';
      break;
    case 'pen':
      updateData.penTakerId = targetUser.id;
      roleTitle = 'Penalty Taker 🥅';
      break;
  }

  await prisma.nationalTeam.update({
    where: { id: nation.id },
    data: updateData
  });

  await message.reply(
    `✅ Successfully designated **${targetUser.username}** as **${nation.name}**'s **${roleTitle}**!`
  );
}
