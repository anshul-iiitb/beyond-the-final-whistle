import { Message, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, TextChannel } from 'discord.js';
import { prisma } from '../database/prisma.js';
import { placeBet, MAX_BET_AMOUNT, settleFixtureBets } from '../engines/bettingEngine.js';
import { calculateAlgorithmicOdds, calculateTeamStrengthRating } from '../engines/fixtureEngine.js';
import { runLiveEpisodicMatch, MatchTeam } from '../engines/liveMatchEngine.js';
import { formatK } from '../utils/formatHelper.js';
import { THEME_COLORS, UI, subtext } from '../utils/themeHelper.js';
import { parseTeamTactics } from './tacticsCommand.js';

export async function handleBetCommand(message: Message, args: string[]) {
  const fixtureNumRaw = args[0];
  const pickRaw = args[1];
  const amountRaw = args[2];

  if (!fixtureNumRaw || !pickRaw || !amountRaw) {
    return await message.reply(
      `❌ **Usage:** \`-bet <fixture#> <home|draw|away> <amount>\`\n` +
      `• Example: \`-bet 1 home 25k\`\n` +
      `• Max bet: **${formatK(MAX_BET_AMOUNT)} coins** (\`50k\` limit strictly enforced)\n` +
      `• Check matches and odds with \`-fixtures\` or \`-odds 1\`.`
    );
  }

  const fixtureNum = parseInt(fixtureNumRaw, 10);
  if (isNaN(fixtureNum)) {
    return await message.reply('❌ Invalid fixture number. Check active matches with `-fixtures`.');
  }

  const result = await placeBet(message.author.id, fixtureNum, pickRaw, amountRaw);
  await message.reply(result.message);
}

export async function handleOddsCommand(message: Message, args: string[]) {
  const fixtureNumRaw = args[0];
  let fixture: any = null;

  if (fixtureNumRaw) {
    fixture = await prisma.matchFixture.findUnique({
      where: { fixtureNumber: parseInt(fixtureNumRaw, 10) }
    });
  } else {
    fixture = await prisma.matchFixture.findFirst({
      where: { status: 'SCHEDULED' },
      orderBy: { scheduledAt: 'asc' }
    });
  }

  if (!fixture) {
    return await message.reply('❌ No upcoming fixtures found. Check `-fixtures` or ask an administrator to schedule a match.');
  }

  const algorithmicData = await calculateAlgorithmicOdds(fixture.homeTeamKey, fixture.awayTeamKey);
  const { home, away, odds } = algorithmicData;

  const now = new Date();
  const cutoffTime = new Date(fixture.scheduledAt.getTime() - 30 * 60 * 1000);
  const isClosed = now >= cutoffTime;

  const embed = new EmbedBuilder()
    .setColor(THEME_COLORS.GOLD)
    .setTitle(`📊 Sportsbook Telemetry & Odds — Fixture #${fixture.fixtureNumber}`)
    .setDescription(
      [
        `### 🏟️ **${fixture.homeTeamName}** vs **${fixture.awayTeamName}**\n` +
        `📅 **Kickoff:** <t:${Math.floor(fixture.scheduledAt.getTime() / 1000)}:F> (<t:${Math.floor(fixture.scheduledAt.getTime() / 1000)}:R>)\n` +
        `🔒 **Betting Cutoff:** <t:${Math.floor(cutoffTime.getTime() / 1000)}:t> (${isClosed ? '**CLOSED (Within 30m)**' : '**OPEN**'})\n\n` +
        `### 🎲 Algorithmic Multipliers (Dynamic Bot Odds)\n` +
        `• 🏠 **${fixture.homeTeamName} (HOME):** \`x${odds.home.toFixed(2)}\`\n` +
        `• 🤝 **DRAW (X):** \`x${odds.draw.toFixed(2)}\`\n` +
        `• ✈️ **${fixture.awayTeamName} (AWAY):** \`x${odds.away.toFixed(2)}\`\n\n` +
        `### 🧠 Deep Algorithmic Strength Matrix\n` +
        `**${home.teamName} (Home):**\n` +
        `• Base OVR: \`${home.ovr}\` (ATK: \`${home.atk}\` | MID: \`${home.mid}\` | DEF: \`${home.def}\`)\n` +
        `• Boots Matched: \`${home.activeBootsCount}/3\` • Pre-Match TP Boost: \`+${home.tpBoostTotal} stat pts\`\n` +
        `• Stadium Advantage: \`+${home.stadiumBonus.toFixed(1)} home surge\`\n\n` +
        `**${away.teamName} (Away):**\n` +
        `• Base OVR: \`${away.ovr}\` (ATK: \`${away.atk}\` | MID: \`${away.mid}\` | DEF: \`${away.def}\`)\n` +
        `• Boots Matched: \`${away.activeBootsCount}/3\` • Pre-Match TP Boost: \`+${away.tpBoostTotal} stat pts\`\n` +
        `${UI.DIVIDER}\n` +
        (isClosed
          ? subtext('🔒 Betting is closed for this match (within 30m cutoff).')
          : subtext(`💡 Place a wager up to 50k: \`-bet ${fixture.fixtureNumber} <home|draw|away> <amount>\``))
      ].join(UI.SPACER)
    )
    .setFooter({ text: 'Beyond The Final Whistle • Algorithmic Sportsbook Engine' })
    .setTimestamp();

  await message.reply({ embeds: [embed] });
}

export async function handleFixturesCommand(message: Message, _args: string[]) {
  const fixtures = await prisma.matchFixture.findMany({
    where: { status: { in: ['SCHEDULED', 'LIVE'] } },
    orderBy: { scheduledAt: 'asc' },
    take: 10
  });

  if (fixtures.length === 0) {
    return await message.reply('📅 No upcoming fixtures scheduled currently. Admins can schedule matches with `-fixture add <home> <away> <minutes>`.');
  }

  const lines = fixtures.map(f => {
    const isLive = f.status === 'LIVE';
    const statusTag = isLive ? '🔴 **LIVE ON PITCH**' : `<t:${Math.floor(f.scheduledAt.getTime() / 1000)}:R>`;
    return `**Fixture #${f.fixtureNumber}:** **${f.homeTeamName}** vs **${f.awayTeamName}**\n` +
      `• Status: ${statusTag} • Multipliers: \`Home x${f.homeOdds.toFixed(2)} | Draw x${f.drawOdds.toFixed(2)} | Away x${f.awayOdds.toFixed(2)}\`\n` +
      `• Bet Command: \`-bet ${f.fixtureNumber} <home|draw|away> <amount>\` (Max 50k)`;
  });

  const embed = new EmbedBuilder()
    .setColor(THEME_COLORS.PRIMARY)
    .setTitle('📅 Official Match Fixtures & Sportsbook Calendar')
    .setDescription(
      [
        'Upcoming league and international matches eligible for sports betting.\n*Wagers close 30 minutes before kickoff!*',
        ...lines,
        `${UI.DIVIDER}\n` +
        subtext('💡 Inspect full algorithmic telemetry and strength factors with `-odds <fixture#>`.')
      ].join(UI.SPACER)
    )
    .setFooter({ text: 'Beyond The Final Whistle • Sportsbook Bureau' })
    .setTimestamp();

  await message.reply({ embeds: [embed] });
}

export async function handleMyBetsCommand(message: Message) {
  const bets = await prisma.matchBet.findMany({
    where: { bettorId: message.author.id },
    include: { fixture: true },
    orderBy: { createdAt: 'desc' },
    take: 10
  });

  if (bets.length === 0) {
    return await message.reply('🎟️ You have not placed any sports bets yet. View upcoming matches with `-fixtures` and bet with `-bet <fixture#> <pick> <amount>`.');
  }

  const lines = bets.map(b => {
    const statusEmoji = b.status === 'WON' ? '✅ WON' : b.status === 'LOST' ? '❌ LOST' : b.status === 'REFUNDED' ? '↩️ REFUNDED' : '⏳ PENDING';
    const payoutText = b.status === 'WON' ? ` • Payout: **+${formatK(b.payout)} coins**` : '';
    return `• **Fixture #${b.fixture.fixtureNumber} (${b.fixture.homeTeamName} vs ${b.fixture.awayTeamName}):**\n` +
      `  Selection: \`${b.pick}\` @ \`x${b.lockedMultiplier.toFixed(2)}\` • Stake: \`${formatK(b.amount)} coins\` • Status: **${statusEmoji}**${payoutText}`;
  });

  const embed = new EmbedBuilder()
    .setColor(THEME_COLORS.GOLD)
    .setTitle(`🎟️ Sportsbook Slips & Betting History — ${message.author.username}`)
    .setDescription(
      [
        'Your recent wagers across official matchday fixtures:',
        ...lines,
        `${UI.DIVIDER}\n` +
        subtext('💡 Winnings are settled automatically and deposited immediately upon final whistle!')
      ].join(UI.SPACER)
    )
    .setFooter({ text: 'Beyond The Final Whistle • Sportsbook' })
    .setTimestamp();

  await message.reply({ embeds: [embed] });
}

export async function handleFixtureAdminCommand(message: Message, args: string[]) {
  if (!message.member?.permissions.has('Administrator')) {
    return await message.reply('❌ Administrator permissions required to manage matchday fixtures.');
  }

  const sub = args[0]?.toLowerCase();

  if (sub === 'add') {
    const homeKey = args[1]?.toLowerCase();
    const awayKey = args[2]?.toLowerCase();
    const minutes = parseInt(args[3] || '60', 10);

    if (!homeKey || !awayKey) {
      return await message.reply('❌ Usage: `-fixture add <homeKey> <awayKey> [minutesFromNow]` (e.g. `-fixture add eng fra 60`)');
    }

    const homeTeam = (await prisma.nationalTeam.findUnique({ where: { alias: homeKey } })) ||
                     (await prisma.footballClub.findUnique({ where: { alias: homeKey } }));
    const awayTeam = (await prisma.nationalTeam.findUnique({ where: { alias: awayKey } })) ||
                     (await prisma.footballClub.findUnique({ where: { alias: awayKey } }));

    if (!homeTeam || !awayTeam) {
      return await message.reply(`❌ Could not locate team alias \`${!homeTeam ? homeKey : awayKey}\`. Check \`-intstats\` or \`-clubstats\`.`);
    }

    const scheduledAt = new Date(Date.now() + minutes * 60 * 1000);
    const oddsData = await calculateAlgorithmicOdds(homeKey, awayKey);

    const highest = await prisma.matchFixture.findFirst({ orderBy: { fixtureNumber: 'desc' } });
    const nextNum = (highest?.fixtureNumber || 0) + 1;

    const fixture = await prisma.matchFixture.create({
      data: {
        fixtureNumber: nextNum,
        homeTeamKey: homeKey,
        awayTeamKey: awayKey,
        homeTeamName: homeTeam.name,
        awayTeamName: awayTeam.name,
        scheduledAt,
        homeOdds: oddsData.odds.home,
        drawOdds: oddsData.odds.draw,
        awayOdds: oddsData.odds.away,
        status: 'SCHEDULED'
      }
    });

    return await message.reply(
      `✅ **Fixture #${fixture.fixtureNumber} Scheduled!**\n` +
      `• **Match:** ${fixture.homeTeamName} vs ${fixture.awayTeamName}\n` +
      `• **Kickoff:** <t:${Math.floor(scheduledAt.getTime() / 1000)}:F> (<t:${Math.floor(scheduledAt.getTime() / 1000)}:R>)\n` +
      `• **Odds:** Home x${fixture.homeOdds.toFixed(2)} | Draw x${fixture.drawOdds.toFixed(2)} | Away x${fixture.awayOdds.toFixed(2)}\n` +
      `• Betting open now! Closes 30m prior to kickoff.`
    );
  }

  if (sub === 'start') {
    const fixtureNum = parseInt(args[1], 10);
    if (isNaN(fixtureNum)) {
      return await message.reply('❌ Usage: `-fixture start <fixture#>`');
    }

    const fixture = await prisma.matchFixture.findUnique({
      where: { fixtureNumber: fixtureNum }
    });

    if (!fixture || fixture.status !== 'SCHEDULED') {
      return await message.reply(`❌ Fixture #${fixtureNum} not found or not in SCHEDULED status.`);
    }

    await prisma.matchFixture.update({
      where: { id: fixture.id },
      data: { status: 'LIVE', startedAt: new Date() }
    });

    await message.reply(`▶️ **Starting Live Episodic Match for Fixture #${fixture.fixtureNumber}:** ${fixture.homeTeamName} vs ${fixture.awayTeamName}...`);

    // Build MatchTeam objects for both sides
    const buildLiveTeam = async (teamKey: string, isHome: boolean): Promise<MatchTeam> => {
      const nation = await prisma.nationalTeam.findFirst({
        where: { OR: [{ alias: teamKey }, { id: teamKey }] },
        include: { players: true }
      });
      const club = !nation ? await prisma.footballClub.findFirst({
        where: { OR: [{ alias: teamKey }, { id: teamKey }] },
        include: { players: true }
      }) : null;
      const team: any = nation || club;

      const tactics = parseTeamTactics(team?.tactics);

      let lineupIds: string[] = [];
      try { lineupIds = JSON.parse(team?.lineup || '[]'); } catch { lineupIds = []; }

      const getP = (idx: number, pos: 'ATK' | 'MID' | 'DEF') => {
        const p = (lineupIds[idx] ? team?.players?.find((pl: any) => pl.id === lineupIds[idx]) : null) ||
                  team?.players?.find((pl: any) => pl.position === pos) ||
                  team?.players?.[idx];
        return {
          id: p?.id || `bot_${teamKey}_${pos}`,
          name: p?.username || `${team?.name || teamKey} ${pos}`,
          position: pos,
          playstyle: p?.playstyle || 'PCH',
          flag: (team as any)?.flag || (team as any)?.badge || '⚽',
          discordId: p?.id,
          fin: p?.fin || 65, pas: p?.pas || 65, tck: p?.tck || 65, dri: p?.dri || 65,
          int: p?.int || 65, pac: p?.pac || 65, cmp: p?.cmp || 65, vis: p?.vis || 65,
          phy: p?.phy || 65, wrk: p?.wrk || 65,
          goals: 0, assists: 0, shots: 0, tackles: 0, interceptions: 0, passesCompleted: 0,
          dribblesWon: 0, fouls: 0, yellowCards: 0, redCards: 0, rating: 6.0
        };
      };

      const specialistName = (type: string) => {
        const specId = type === 'fk' ? team?.fkTakerId : type === 'corner' ? team?.cornerTakerId : team?.penTakerId;
        const match = team?.players?.find((pl: any) => pl.id === specId);
        return match?.username || getP(0, 'ATK').name;
      };

      return {
        name: team?.name || teamKey.toUpperCase(),
        alias: team?.alias || teamKey,
        flag: team?.flag || team?.badge || '⚽',
        tactics,
        freeKickTakerName: specialistName('fk'),
        cornerTakerName: specialistName('corner'),
        penaltyTakerName: specialistName('pen'),
        captainName: team?.players?.find((pl: any) => pl.id === team?.captainId)?.username,
        players: {
          atk: getP(0, 'ATK'),
          mid: getP(1, 'MID'),
          def: getP(2, 'DEF')
        },
        score: 0,
        possession: 50,
        color: isHome ? [30, 64, 175] : [220, 38, 38]
      };
    };

    const homeMatchTeam = await buildLiveTeam(fixture.homeTeamKey, true);
    const awayMatchTeam = await buildLiveTeam(fixture.awayTeamKey, false);

    const channel = message.channel as TextChannel;
    const simResult = await runLiveEpisodicMatch(message.client, channel, homeMatchTeam, awayMatchTeam, {
      tickDelayMs: 2500, // fast broadcast simulation for commands
      halfTimePauseMs: 5000
    });

    // Match finished: update fixture status & settle bets
    await prisma.matchFixture.update({
      where: { id: fixture.id },
      data: {
        status: 'COMPLETED',
        endedAt: new Date(),
        homeScore: simResult.homeScore,
        awayScore: simResult.awayScore
      }
    });

    await settleFixtureBets(fixture.id, simResult.homeScore, simResult.awayScore);
    await channel.send(`🏁 **Fixture #${fixture.fixtureNumber} Completed!** Final Score: **${fixture.homeTeamName} ${simResult.homeScore} : ${simResult.awayScore} ${fixture.awayTeamName}**. All sports bets have been settled!`);
    return;
  }

  return await message.reply('❌ Usage: `-fixture <add|start>`');
}
