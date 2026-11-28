import { Message, EmbedBuilder, TextChannel, Guild } from 'discord.js';
import { prisma } from '../database/prisma.js';
import {
  createTournament,
  enrollTeamToTournament,
  enrollAllTeamsToTournament,
  applyBlueprintToTournament,
  generateTournamentStageFixtures,
  advanceTournamentStage,
} from '../tournaments/tournamentEngine.js';
import { playTournamentFixture } from '../tournaments/tournamentMatchRunner.js';
import { sendThinkingMessage, updateLoadingMessage } from '../utils/loadingHelper.js';
import { logger } from '../utils/logger.js';

function findAnnouncementChannel(guild: Guild): TextChannel | null {
  return (
    guild.channels.cache.find(
      (c) =>
        c.isTextBased() &&
        (c.name.includes('announcement') ||
          c.name.includes('announcements') ||
          c.name.includes('btfw-news') ||
          c.name.includes('news') ||
          c.name.includes('gazette')) &&
        !c.name.includes('bot-cmd')
    ) as TextChannel | null
  ) || null;
}

async function resolveTournament(identifier: string) {
  const trimmed = identifier.trim();
  const byId = await prisma.tournament.findUnique({
    where: { id: trimmed },
    include: { teams: true, fixtures: true },
  });
  if (byId) return byId;

  const byName = await prisma.tournament.findFirst({
    where: { name: { equals: trimmed, mode: 'insensitive' } },
    include: { teams: true, fixtures: true },
  });
  if (byName) return byName;

  const contains = await prisma.tournament.findFirst({
    where: { name: { contains: trimmed, mode: 'insensitive' } },
    include: { teams: true, fixtures: true },
    orderBy: { createdAt: 'desc' },
  });
  return contains;
}

export async function handleTournamentCommand(message: Message, args: string[]) {
  const sub = args[0]?.toLowerCase();

  if (!sub || sub === 'help') {
    const helpEmbed = new EmbedBuilder()
      .setColor('#38bdf8')
      .setTitle('🏆 Tournament & Cup Engine')
      .setDescription(
        `Host and compete in massive multi-stage tournaments linked to **National Teams** or **Clubs**!\n\n` +
        `**Lifecycle Commands:**\n` +
        `• \`-tourney create "<name>" [NATION|CLUB] [blueprintSlug]\` — Create a new tournament\n` +
        `• \`-tourney enroll "<name>" <alias | all>\` — Enroll nations or clubs\n` +
        `• \`-tourney blueprint "<name>" <slug>\` — Apply a custom blueprint to groups\n` +
        `• \`-tourney schedule "<name>"\` — Generate stage fixtures\n` +
        `• \`-tourney table "<name>" [group]\` — View live group standings & points\n` +
        `• \`-tourney fixtures "<name>" [matchday]\` — List upcoming & played fixtures\n` +
        `• \`-tourney play "<name>" [next | match#] [fast]\` — Broadcast or simulate a tournament match\n` +
        `• \`-tourney advance "<name>" [force]\` — Advance stage or crown the champion!\n` +
        `• \`-tourney list\` — View active and completed tournaments\n\n` +
        `*Tip: Blueprints are created with \`-blueprint create\`.*`
      )
      .setFooter({ text: 'Beyond The Final Whistle • Tournament Manager' });
    await message.reply({ embeds: [helpEmbed] });
    return;
  }

  // LIST TOURNAMENTS
  if (sub === 'list' || sub === 'ls') {
    const tourneys = await prisma.tournament.findMany({
      orderBy: { createdAt: 'desc' },
      include: { teams: true, fixtures: true },
      take: 15,
    });

    if (tourneys.length === 0) {
      await message.reply('ℹ️ No tournaments found. Create one with `-tourney create "World Cup" NATION`.');
      return;
    }

    const embed = new EmbedBuilder()
      .setColor('#38bdf8')
      .setTitle('🏆 Tournaments & Competitions')
      .setDescription(
        tourneys
          .map((t, i) => {
            const played = t.fixtures.filter((f) => f.status === 'PLAYED').length;
            const statusIcon = t.status === 'COMPLETED' ? '👑' : t.status === 'ACTIVE' ? '🟢' : '🟡';
            return `**${i + 1}. ${statusIcon} ${t.name}** (\`${t.type}\`)\n` +
              `Status: \`${t.status}\` • Phase: \`${t.currentPhase}\` • Teams: **${t.teams.length}** • Fixtures: **${played}/${t.fixtures.length}**`;
          })
          .join('\n\n')
      )
      .setFooter({ text: 'Use -tourney table <name> or -tourney fixtures <name>' });

    await message.reply({ embeds: [embed] });
    return;
  }

  // CREATE TOURNAMENT
  if (sub === 'create' || sub === 'new') {
    // Check if quoted name
    const rawArgs = args.slice(1).join(' ');
    const match = rawArgs.match(/^"([^"]+)"\s*(.*)$/) || rawArgs.match(/^'([^']+)'\s*(.*)$/);
    let name = '';
    let remainder = '';

    if (match) {
      name = match[1];
      remainder = match[2].trim();
    } else {
      const parts = rawArgs.split(/\s+/);
      name = parts[0];
      remainder = parts.slice(1).join(' ');
    }

    if (!name) {
      await message.reply('⚠️ Please provide a tournament name. Usage: `-tourney create "<name>" [NATION|CLUB] [blueprintSlug]`.');
      return;
    }

    const remParts = remainder.split(/\s+/).filter(Boolean);
    let type: 'NATION' | 'CLUB' = 'NATION';
    let bpSlug: string | undefined;

    if (remParts.length > 0) {
      const t = remParts[0].toUpperCase();
      if (t === 'NATION' || t === 'CLUB') {
        type = t;
        bpSlug = remParts[1];
      } else {
        bpSlug = remParts[0];
      }
    }

    try {
      const created = await createTournament({
        name,
        type,
        blueprintSlug: bpSlug,
      });

      const embed = new EmbedBuilder()
        .setColor('#22c55e')
        .setTitle(`🏆 Tournament Created: ${created.name}`)
        .setDescription(
          `**Type:** \`${created.type}\` (${created.type === 'NATION' ? 'National Teams' : 'Football Clubs'})\n` +
          `**Status:** \`${created.status}\`\n` +
          (bpSlug ? `**Blueprint:** \`${bpSlug}\`\n` : '') +
          `\n**Next Steps:**\n` +
          `1. Enroll teams: \`-tourney enroll "${created.name}" all\` (or add individual teams)\n` +
          (bpSlug ? `2. Schedule matches: \`-tourney schedule "${created.name}"\`` : `2. Attach blueprint: \`-tourney blueprint "${created.name}" <blueprintSlug>\``)
        )
        .setFooter({ text: `Tournament ID: ${created.id}` })
        .setTimestamp();

      await message.reply({ embeds: [embed] });
    } catch (err: any) {
      await message.reply(`❌ Failed to create tournament: ${err.message}`);
    }
    return;
  }

  // ENROLL TEAMS
  if (sub === 'enroll' || sub === 'addteam' || sub === 'add') {
    const tourneyQuery = args[1];
    const teamArg = args[2];

    if (!tourneyQuery || !teamArg) {
      await message.reply('⚠️ Usage: `-tourney enroll "<tournament>" <teamAlias | "all">`.');
      return;
    }

    const tourney = await resolveTournament(tourneyQuery);
    if (!tourney) {
      await message.reply(`❌ Tournament "${tourneyQuery}" not found.`);
      return;
    }

    if (teamArg.toLowerCase() === 'all') {
      const res = await enrollAllTeamsToTournament(tourney.id);
      await message.reply(`✅ Enrolled **${res.added}** teams into **${tourney.name}**! Total active teams: **${res.total}**.`);
      return;
    }

    try {
      const res = await enrollTeamToTournament(tourney.id, teamArg);
      await message.reply(`✅ Added **${res.team.name}** (\`${res.team.alias}\`) to **${res.tourneyName}**!`);
    } catch (err: any) {
      await message.reply(`❌ ${err.message}`);
    }
    return;
  }

  // ATTACH BLUEPRINT
  if (sub === 'blueprint' || sub === 'apply' || sub === 'bp') {
    const tourneyQuery = args[1];
    const bpSlug = args[2];

    if (!tourneyQuery || !bpSlug) {
      await message.reply('⚠️ Usage: `-tourney blueprint "<tournament>" <blueprintSlug>`.');
      return;
    }

    const tourney = await resolveTournament(tourneyQuery);
    if (!tourney) {
      await message.reply(`❌ Tournament "${tourneyQuery}" not found.`);
      return;
    }

    try {
      const res = await applyBlueprintToTournament(tourney.id, bpSlug);
      const embed = new EmbedBuilder()
        .setColor('#a855f7')
        .setTitle(`🧩 Blueprint Applied: ${res.blueprint.name}`)
        .setDescription(
          `**Tournament:** **${tourney.name}**\n` +
          `**Enrolled Teams:** ${tourney.teams.length}\n` +
          `**Current Phase:** \`${res.tourney.currentPhase}\`\n\n` +
          `Generate Stage 1 fixtures anytime with \`-tourney schedule "${tourney.name}"\`.`
        )
        .setFooter({ text: `${res.blueprint.slug} • Ready to schedule` });

      await message.reply({ embeds: [embed] });
    } catch (err: any) {
      await message.reply(`❌ ${err.message}`);
    }
    return;
  }

  // SCHEDULE FIXTURES / START TOURNAMENT
  if (sub === 'schedule' || sub === 'start' || sub === 'kickoff' || sub === 'generate' || sub === 'fixturesgen') {
    const tourneyQuery = args[1];
    if (!tourneyQuery) {
      await message.reply('⚠️ Usage: `-tourney schedule "<tournament>"` (or `-tourney start "<tournament>"`).');
      return;
    }

    const tourney = await resolveTournament(tourneyQuery);
    if (!tourney) {
      await message.reply(`❌ Tournament "${tourneyQuery}" not found.`);
      return;
    }

    try {
      const fixtures = await generateTournamentStageFixtures(tourney.id);
      const embed = new EmbedBuilder()
        .setColor('#22c55e')
        .setTitle(`📅 Fixtures Scheduled: ${tourney.name}`)
        .setDescription(
          `Generated **${fixtures.length}** fixture(s) for **${tourney.currentPhase}**!\n\n` +
          `• View table: \`-tourney table "${tourney.name}"\`\n` +
          `• View match list: \`-tourney fixtures "${tourney.name}"\`\n` +
          `• Kick off match 1: \`-tourney play "${tourney.name}" 1\``
        )
        .setFooter({ text: `${tourney.name} • Fixtures Ready` });

      await message.reply({ embeds: [embed] });

      // Automatically broadcast tournament kickoff to announcement channel pinging @everyone
      if (message.guild) {
        const announceChannel = findAnnouncementChannel(message.guild);
        if (announceChannel) {
          const liveChannel = message.guild.channels.cache.find(
            (c) => c.isTextBased() && c.name.includes('live-match')
          );
          const announceEmbed = new EmbedBuilder()
            .setColor('#f59e0b')
            .setTitle(`🏆 TOURNAMENT COMMENCED: ${tourney.name.toUpperCase()}! 🏆`)
            .setDescription(
              `@everyone The whistle has blown and the competition is officially underway!\n\n` +
              `🏆 **Tournament:** **${tourney.name}**\n` +
              `⚔️ **Initial Stage:** \`${tourney.currentPhase}\`\n` +
              `👥 **Enrolled Teams:** **${tourney.teams.length}** teams (${tourney.type === 'NATION' ? 'National Teams 🌍' : 'Football Clubs 🛡️'})\n` +
              `📅 **Scheduled Fixtures:** **${fixtures.length}** match(es)\n\n` +
              `### 📌 How to Follow the Action\n` +
              `• Standings & Table: \`-tourney table "${tourney.name}"\`\n` +
              `• Fixtures Schedule: \`-tourney fixtures "${tourney.name}"\`\n` +
              `• Matchday Broadcasts: ${liveChannel ? `<#${liveChannel.id}>` : '#live-match'}`
            )
            .setFooter({ text: `${tourney.name} • Beyond The Final Whistle Tournament Federation` })
            .setTimestamp();

          await announceChannel.send({
            content: `@everyone 📢 **${tourney.name}** has officially commenced! Fixtures and groups are now live:`,
            embeds: [announceEmbed],
            allowedMentions: { parse: ['everyone'] }
          }).catch((err) => logger.warn({ err: err.message }, 'Failed to broadcast tournament start announcement'));
        }
      }
    } catch (err: any) {
      await message.reply(`❌ ${err.message}`);
    }
    return;
  }

  // TABLE / STANDINGS
  if (sub === 'table' || sub === 'standings' || sub === 'rankings') {
    const tourneyQuery = args[1];
    const groupFilter = args[2]?.toUpperCase();

    if (!tourneyQuery) {
      await message.reply('⚠️ Usage: `-tourney table "<tournament>" [group]`.');
      return;
    }

    const tourney = await resolveTournament(tourneyQuery);
    if (!tourney) {
      await message.reply(`❌ Tournament "${tourneyQuery}" not found.`);
      return;
    }

    const teams = await prisma.tournamentTeam.findMany({
      where: {
        tournamentId: tourney.id,
        isEliminated: false,
        ...(groupFilter ? { group: groupFilter } : {}),
      },
      orderBy: [
        { points: 'desc' },
        { goalDifference: 'desc' },
        { goalsFor: 'desc' },
        { name: 'asc' },
      ],
    });

    if (teams.length === 0) {
      await message.reply(`ℹ️ No active teams found in **${tourney.name}**${groupFilter ? ` (Group ${groupFilter})` : ''}.`);
      return;
    }

    // Group teams by group
    const groupsMap = new Map<string, typeof teams>();
    for (const t of teams) {
      const g = t.group || 'Standings';
      if (!groupsMap.has(g)) groupsMap.set(g, []);
      groupsMap.get(g)!.push(t);
    }

    const embed = new EmbedBuilder()
      .setColor('#38bdf8')
      .setTitle(`📊 Standings: ${tourney.name} (${tourney.currentPhase})`)
      .setFooter({ text: `${tourney.name} • Phase: ${tourney.currentPhase}` })
      .setTimestamp();

    for (const [grp, grpTeams] of groupsMap.entries()) {
      const lines = grpTeams.map((t, idx) => {
        const gd = t.goalDifference > 0 ? `+${t.goalDifference}` : `${t.goalDifference}`;
        return `\`${idx + 1}.\` **${t.name}** — **${t.points}** pts \`[${t.played}P ${t.won}W ${t.drawn}D ${t.lost}L | GD: ${gd}]\``;
      });
      embed.addFields({
        name: grp === 'Standings' ? '🏆 Table' : `📌 Group ${grp}`,
        value: lines.join('\n'),
      });
    }

    await message.reply({ embeds: [embed] });
    return;
  }

  // FIXTURES
  if (sub === 'fixtures' || sub === 'matches') {
    const tourneyQuery = args[1];
    const matchdayFilter = args[2] ? Number.parseInt(args[2], 10) : undefined;

    if (!tourneyQuery) {
      await message.reply('⚠️ Usage: `-tourney fixtures "<tournament>" [matchday]`.');
      return;
    }

    const tourney = await resolveTournament(tourneyQuery);
    if (!tourney) {
      await message.reply(`❌ Tournament "${tourneyQuery}" not found.`);
      return;
    }

    const fixtures = await prisma.tournamentFixture.findMany({
      where: {
        tournamentId: tourney.id,
        ...(matchdayFilter ? { matchday: matchdayFilter } : {}),
      },
      include: { homeTeam: true, awayTeam: true },
      orderBy: [{ matchday: 'asc' }, { matchNumber: 'asc' }],
      take: 20,
    });

    if (fixtures.length === 0) {
      await message.reply(`ℹ️ No fixtures found for **${tourney.name}**.`);
      return;
    }

    const lines = fixtures.map((f) => {
      const statusIcon = f.status === 'PLAYED' ? '✅' : '⏳';
      const score = f.status === 'PLAYED' ? `**${f.homeScore} - ${f.awayScore}**` : 'vs';
      return `\`#${f.matchNumber}\` ${statusIcon} **${f.homeTeam.name}** ${score} **${f.awayTeam.name}** (MD ${f.matchday} • \`${f.stage}\`)`;
    });

    const embed = new EmbedBuilder()
      .setColor('#38bdf8')
      .setTitle(`📅 Matchday Schedule: ${tourney.name}`)
      .setDescription(lines.join('\n'))
      .setFooter({ text: `Play next match: -tourney play "${tourney.name}" next` });

    await message.reply({ embeds: [embed] });
    return;
  }

  // PLAY FIXTURE
  if (sub === 'play' || sub === 'match' || sub === 'sim') {
    const tourneyQuery = args[1];
    const fixtureArg = args[2] || 'next';
    const isFast = args.includes('fast') || args.includes('sim');

    if (!tourneyQuery) {
      await message.reply('⚠️ Usage: `-tourney play "<tournament>" [next | match#] [fast]`.');
      return;
    }

    const tourney = await resolveTournament(tourneyQuery);
    if (!tourney) {
      await message.reply(`❌ Tournament "${tourneyQuery}" not found.`);
      return;
    }

    const channel = message.channel as TextChannel;
    const thinking = await sendThinkingMessage(
      message,
      `Setting up matchday broadcast for ${tourney.name}...`
    );

    try {
      const result = await playTournamentFixture({
        tournamentId: tourney.id,
        fixtureQuery: fixtureArg,
        client: message.client,
        channel: isFast ? undefined : channel,
        fast: isFast,
      });

      await updateLoadingMessage(thinking, { embeds: [result.embed] });
    } catch (err: any) {
      logger.error({ err: err.message }, 'Failed to play tournament fixture');
      await updateLoadingMessage(thinking, `❌ ${err.message}`);
    }
    return;
  }

  // ADVANCE STAGE
  if (sub === 'advance' || sub === 'nextstage') {
    const tourneyQuery = args[1];
    const force = args.includes('force');

    if (!tourneyQuery) {
      await message.reply('⚠️ Usage: `-tourney advance "<tournament>" [force]`.');
      return;
    }

    const tourney = await resolveTournament(tourneyQuery);
    if (!tourney) {
      await message.reply(`❌ Tournament "${tourneyQuery}" not found.`);
      return;
    }

    const thinking = await sendThinkingMessage(
      message,
      `Evaluating stage routes and advancing ${tourney.name}...`
    );

    try {
      const adv = await advanceTournamentStage(tourney.id, force);

      if (adv.concluded) {
        const crownEmbed = new EmbedBuilder()
          .setColor('#f1c40f')
          .setTitle('👑 TOURNAMENT CHAMPION CROWNED!')
          .setDescription(
            `🎉 **Congratulations to ${adv.championName}!** 🎉${adv.scoreText || ''}\n\n` +
            `All stages of **${tourney.name}** have completed! Glory is forever etched in the annals of football history.`
          )
          .setFooter({ text: `${tourney.name} • Concluded` })
          .setTimestamp();

        await updateLoadingMessage(thinking, { embeds: [crownEmbed] });

        if (message.guild) {
          const announceChannel = findAnnouncementChannel(message.guild);
          if (announceChannel) {
            const champName = adv.championName || 'Champion';
            const championEmbed = new EmbedBuilder()
              .setColor('#f1c40f')
              .setTitle(`👑 TOURNAMENT CHAMPIONS: ${champName.toUpperCase()}! 👑`)
              .setDescription(
                `@everyone 🎉 **Congratulations to ${champName}!** 🎉${adv.scoreText || ''}\n\n` +
                `All stages of **${tourney.name}** have concluded! Their name is immortalized in Beyond The Final Whistle history.`
              )
              .setFooter({ text: `${tourney.name} • Champion Crowned` })
              .setTimestamp();

            await announceChannel.send({
              content: `@everyone 👑 **WE HAVE A CHAMPION! All hail ${champName}, winner of ${tourney.name}!**`,
              embeds: [championEmbed],
              allowedMentions: { parse: ['everyone'] }
            }).catch((err) => logger.warn({ err: err.message }, 'Failed to broadcast tournament champion announcement'));
          }
        }
        return;
      }

      const nextName = adv.nextStage?.name || 'Next Stage';
      const advEmbed = new EmbedBuilder()
        .setColor('#22c55e')
        .setTitle(`🚀 ${nextName} Unlocked!`)
        .setDescription(
          `Stage advancement complete for **${tourney.name}**!\n\n` +
          `• Generated **${adv.fixturesCount}** fixture(s) starting at Matchday **${adv.startMatchday}**.\n` +
          (adv.eliminated && adv.eliminated.length > 0
            ? `• ❌ **Eliminated (${adv.eliminated.length}):** ${adv.eliminated.map((t) => t.name).join(', ')}\n\n`
            : '\n') +
          `Check fixtures with \`-tourney fixtures "${tourney.name}"\` or table with \`-tourney table "${tourney.name}"\`.`
        )
        .setFooter({ text: `${tourney.name} • ${nextName}` })
        .setTimestamp();

      await updateLoadingMessage(thinking, { embeds: [advEmbed] });
    } catch (err: any) {
      logger.error({ err: err.message }, 'Failed to advance tournament');
      await updateLoadingMessage(thinking, `❌ ${err.message}`);
    }
    return;
  }

  await message.reply('⚠️ Unknown tournament command. Run `-tourney help` for all commands.');
}
