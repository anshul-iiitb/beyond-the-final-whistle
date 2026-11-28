import { Client, TextChannel, EmbedBuilder } from 'discord.js';
import { prisma } from '../database/prisma.js';
import { buildLiveMatchTeam, runLiveEpisodicMatch } from '../engines/liveMatchEngine.js';
import { simulateFullMatch } from '../engines/matchSimulationEngine.js';
import { logger } from '../utils/logger.js';

export async function playTournamentFixture(params: {
  tournamentId: string;
  fixtureQuery?: string;
  client?: Client;
  channel?: TextChannel;
  fast?: boolean;
}) {
  const tourney = await prisma.tournament.findUnique({
    where: { id: params.tournamentId },
    include: {
      teams: true,
      fixtures: {
        include: { homeTeam: true, awayTeam: true },
        orderBy: [{ matchday: 'asc' }, { matchNumber: 'asc' }],
      },
    },
  });
  if (!tourney) throw new Error('Tournament not found.');

  let fixture: any = null;

  if (!params.fixtureQuery || params.fixtureQuery.toLowerCase() === 'next') {
    fixture = tourney.fixtures.find((f) => f.status === 'SCHEDULED');
    if (!fixture) {
      throw new Error(`All fixtures in the current stage of **${tourney.name}** have already been played! Run \`-tourney advance ${tourney.name}\` to move to the next stage.`);
    }
  } else {
    const num = Number.parseInt(params.fixtureQuery, 10);
    if (!Number.isNaN(num)) {
      fixture = tourney.fixtures.find((f) => f.matchNumber === num && f.status === 'SCHEDULED');
      if (!fixture) {
        fixture = tourney.fixtures.find((f) => f.matchNumber === num);
        if (fixture && fixture.status === 'PLAYED') {
          throw new Error(`Match #${num} has already been played (${fixture.homeTeam.name} ${fixture.homeScore} - ${fixture.awayScore} ${fixture.awayTeam.name}).`);
        }
      }
    } else {
      fixture = tourney.fixtures.find(
        (f) =>
          f.id === params.fixtureQuery ||
          f.homeTeam.alias.toLowerCase() === params.fixtureQuery?.toLowerCase() ||
          f.awayTeam.alias.toLowerCase() === params.fixtureQuery?.toLowerCase()
      );
    }
  }

  if (!fixture) {
    throw new Error('Could not find scheduled tournament fixture.');
  }

  const homeTeam = fixture.homeTeam;
  const awayTeam = fixture.awayTeam;
  const isKnockout = fixture.stage !== 'GROUP';

  logger.info(`Starting tournament match #${fixture.matchNumber} (${tourney.name}): ${homeTeam.name} vs ${awayTeam.name}`);

  let homeScore = 0;
  let awayScore = 0;
  let motmName = 'Standout Player';
  let motmRating = 8.0;
  let homePoss = 50;
  let awayPoss = 50;
  let penaltyDecision: string | null = null;

  const isLive = !params.fast && Boolean(params.channel && params.client);

  if (isLive && params.client && params.channel) {
    if (params.channel.guild && fixture.matchNumber === 1 && fixture.matchday === 1) {
      const announceChannel = params.channel.guild.channels.cache.find(
        (c) =>
          c.isTextBased() &&
          (c.name.includes('announcement') ||
            c.name.includes('announcements') ||
            c.name.includes('btfw-news') ||
            c.name.includes('news')) &&
          !c.name.includes('bot-cmd')
      ) as TextChannel | null;

      if (announceChannel && announceChannel.id !== params.channel.id) {
        await announceChannel.send({
          content: `@everyone ⚽ **${tourney.name} OPENING KICKOFF!** Match #1 (**${homeTeam.name} vs ${awayTeam.name}**) is now LIVE in <#${params.channel.id}>! Tune in to watch!`,
          allowedMentions: { parse: ['everyone'] }
        }).catch(() => {});
      }
    }

    const homeMatchTeam = await buildLiveMatchTeam(homeTeam.alias, true);
    const awayMatchTeam = await buildLiveMatchTeam(awayTeam.alias, false);

    const liveRes = await runLiveEpisodicMatch(
      params.client,
      params.channel,
      homeMatchTeam,
      awayMatchTeam,
      { isExhibition: false }
    );

    homeScore = liveRes.homeScore;
    awayScore = liveRes.awayScore;
    homePoss = liveRes.homePossession;
    awayPoss = liveRes.awayPossession;
    motmName = liveRes.motmPlayerName;
    motmRating = liveRes.motmRating;
  } else {
    // Fast Algorithmic Match Simulation
    const simRes = await simulateFullMatch('', '', {
      homeTeamKey: homeTeam.alias,
      awayTeamKey: awayTeam.alias,
      isExhibition: false,
    });

    homeScore = simRes.homeScore;
    awayScore = simRes.awayScore;
    homePoss = simRes.homePossession;
    awayPoss = simRes.awayPossession;
    motmName = simRes.motmPlayerName;
    motmRating = simRes.motmRating;
  }

  // Knockout Tie-Break (Penalties if draw in single-leg knockout)
  if (isKnockout && homeScore === awayScore && fixture.leg === 1) {
    const homePens = 4 + Math.floor(Math.random() * 2);
    const awayPens = homePens === 5 ? (Math.random() > 0.5 ? 4 : 3) : 5;
    const penWinner = homePens > awayPens ? homeTeam.name : awayTeam.name;
    penaltyDecision = ` (${homePens} - ${awayPens} on penalties)`;
    if (homePens > awayPens) {
      homeScore += 1;
    } else {
      awayScore += 1;
    }
    logger.info(`Knockout tie resolved on penalties: ${penWinner} advances!`);
  }

  // Update Fixture in Database
  await prisma.tournamentFixture.update({
    where: { id: fixture.id },
    data: {
      status: 'PLAYED',
      homeScore,
      awayScore,
      playedAt: new Date(),
    },
  });

  // Update Standings in Database
  const homeWon = homeScore > awayScore;
  const awayWon = awayScore > homeScore;
  const isDraw = homeScore === awayScore;

  await prisma.tournamentTeam.update({
    where: { id: homeTeam.id },
    data: {
      played: { increment: 1 },
      goalsFor: { increment: homeScore },
      goalsAgainst: { increment: awayScore },
      goalDifference: { increment: homeScore - awayScore },
      won: homeWon ? { increment: 1 } : undefined,
      drawn: isDraw ? { increment: 1 } : undefined,
      lost: awayWon ? { increment: 1 } : undefined,
      points: homeWon ? { increment: 3 } : isDraw ? { increment: 1 } : undefined,
    },
  });

  await prisma.tournamentTeam.update({
    where: { id: awayTeam.id },
    data: {
      played: { increment: 1 },
      goalsFor: { increment: awayScore },
      goalsAgainst: { increment: homeScore },
      goalDifference: { increment: awayScore - homeScore },
      won: awayWon ? { increment: 1 } : undefined,
      drawn: isDraw ? { increment: 1 } : undefined,
      lost: homeWon ? { increment: 1 } : undefined,
      points: awayWon ? { increment: 3 } : isDraw ? { increment: 1 } : undefined,
    },
  });

  // Award Official Caps if NATION Tournament
  if (tourney.type === 'NATION') {
    if (homeTeam.nationId) {
      await prisma.player.updateMany({
        where: { nationId: homeTeam.nationId },
        data: { capsPlayedOfficial: { increment: 1 } },
      });
    }
    if (awayTeam.nationId) {
      await prisma.player.updateMany({
        where: { nationId: awayTeam.nationId },
        data: { capsPlayedOfficial: { increment: 1 } },
      });
    }
  }

  const resultEmbed = new EmbedBuilder()
    .setTitle(`🏆 ${tourney.name} • Matchday ${fixture.matchday}`)
    .setColor(homeWon ? '#22c55e' : awayWon ? '#3b82f6' : '#eab308')
    .setDescription(
      `### ${homeTeam.name} ${homeScore} – ${awayScore} ${awayTeam.name}${penaltyDecision || ''}\n\n` +
      `**Stage:** \`${fixture.stage}\` ${fixture.group ? `(Group ${fixture.group})` : ''} • **Match #${fixture.matchNumber}**\n` +
      `**Possession:** ${homePoss}% ▰▰▰▰▱▱▱▱▱▱ ${awayPoss}%\n` +
      `**👑 MOTM:** **${motmName}** (Rating: \`${motmRating}\`)\n` +
      (tourney.type === 'NATION' ? `*Official International Caps credited to active national squad players.*` : `*Official Club stats credited to registered club players.*`)
    )
    .setFooter({ text: `${tourney.name} • ${tourney.currentPhase}` })
    .setTimestamp();

  return {
    fixture,
    homeScore,
    awayScore,
    homeTeam,
    awayTeam,
    motmName,
    motmRating,
    embed: resultEmbed,
  };
}
