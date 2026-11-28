import { prisma } from '../database/prisma.js';
import { calculateAlgorithmicOdds } from './fixtureEngine.js';
import { formatK, parseCoinAmount } from '../utils/formatHelper.js';
import { logger } from '../utils/logger.js';

export const MAX_BET_AMOUNT = 50000n; // Strict 50k limit as specified by user

export interface PlaceBetResult {
  success: boolean;
  message: string;
  bet?: any;
}

/**
 * Places a sports bet on an upcoming match fixture.
 * Strictly enforces:
 * 1. 50k max bet limit
 * 2. 30-minute pre-match betting cutoff
 * 3. Dynamic odds calculated algorithmically by bot
 */
export async function placeBet(
  playerId: string,
  fixtureNumber: number,
  pickRaw: string,
  amountRaw: string
): Promise<PlaceBetResult> {
  const player = await prisma.player.findUnique({ where: { id: playerId } });
  if (!player) {
    return { success: false, message: '❌ Player not found. Run `-profile` first to register.' };
  }

  const amount = parseCoinAmount(amountRaw);
  if (!amount || amount <= 0n) {
    return { success: false, message: '❌ Invalid bet amount. Examples: `10000`, `25k`, `50k`.' };
  }

  if (amount > MAX_BET_AMOUNT) {
    return {
      success: false,
      message: `🚫 **Maximum Bet Limit Exceeded!** The maximum wager is strictly **${formatK(MAX_BET_AMOUNT)} coins** (\`50k\`) per slip.`
    };
  }

  if (player.coins < amount) {
    return {
      success: false,
      message: `🪙 Insufficient funds! You wagered **${formatK(amount)} coins**, but your balance is only **${formatK(player.coins)} coins**.`
    };
  }

  const normalizedPick = pickRaw.toUpperCase();
  const validPicks = ['HOME', 'DRAW', 'AWAY', '1', 'X', '2'];
  if (!validPicks.includes(normalizedPick)) {
    return {
      success: false,
      message: '❌ Invalid pick! Must be `home` (or `1`), `draw` (or `x`), or `away` (or `2`).'
    };
  }

  const pick = normalizedPick === '1' ? 'HOME' : normalizedPick === 'X' ? 'DRAW' : normalizedPick === '2' ? 'AWAY' : normalizedPick;

  const fixture = await prisma.matchFixture.findUnique({
    where: { fixtureNumber }
  });

  if (!fixture) {
    return { success: false, message: `❌ Fixture #${fixtureNumber} not found. Check active matches with \`-fixtures\`.` };
  }

  if (fixture.status !== 'SCHEDULED') {
    return { success: false, message: `❌ Fixture #${fixtureNumber} is already ${fixture.status} and no longer accepting bets.` };
  }

  const now = new Date();
  const cutoffTime = new Date(fixture.scheduledAt.getTime() - 30 * 60 * 1000);

  if (now >= cutoffTime) {
    const minsBefore = Math.round((fixture.scheduledAt.getTime() - now.getTime()) / 60000);
    return {
      success: false,
      message: `🔒 **Betting Closed!** Betting closes strictly **30 minutes prior to kickoff**. (${minsBefore > 0 ? `${minsBefore}m to kickoff` : 'Match starting/active'}).`
    };
  }

  // Calculate live algorithmic odds factoring current boots, TP, and stadium
  const algorithmicData = await calculateAlgorithmicOdds(fixture.homeTeamKey, fixture.awayTeamKey);
  const liveOdds = algorithmicData.odds;

  // Update fixture odds if live calculated odds shifted
  if (liveOdds.home !== fixture.homeOdds || liveOdds.away !== fixture.awayOdds) {
    await prisma.matchFixture.update({
      where: { id: fixture.id },
      data: {
        homeOdds: liveOdds.home,
        drawOdds: liveOdds.draw,
        awayOdds: liveOdds.away
      }
    });
  }

  const lockedMultiplier = pick === 'HOME' ? liveOdds.home : pick === 'DRAW' ? liveOdds.draw : liveOdds.away;
  const potentialPayout = BigInt(Math.floor(Number(amount) * lockedMultiplier));

  // Deduct coins & create bet in transaction
  const [updatedPlayer, createdBet] = await prisma.$transaction([
    prisma.player.update({
      where: { id: playerId },
      data: { coins: { decrement: amount } }
    }),
    prisma.matchBet.create({
      data: {
        fixtureId: fixture.id,
        bettorId: playerId,
        pick,
        amount,
        lockedMultiplier,
        status: 'PENDING'
      }
    })
  ]);

  const pickName = pick === 'HOME' ? fixture.homeTeamName : pick === 'AWAY' ? fixture.awayTeamName : 'Draw (X)';

  return {
    success: true,
    message:
      `🎟️ **SPORTSBOOK SLIP CONFIRMED!**\n\n` +
      `• **Fixture #${fixture.fixtureNumber}:** ${fixture.homeTeamName} vs ${fixture.awayTeamName}\n` +
      `• **Selection:** **${pickName}** \`[${pick}]\`\n` +
      `• **Locked Multiplier:** \`x${lockedMultiplier.toFixed(2)}\`\n` +
      `• **Wager:** **${formatK(amount)} coins**\n` +
      `• **Potential Return:** **${formatK(potentialPayout)} coins** (Profit: +${formatK(potentialPayout - amount)})\n\n` +
      `💰 *Remaining Balance:* \`${formatK(updatedPlayer.coins)} coins\`\n` +
      `⏱️ *Closes 30m before kickoff at <t:${Math.floor(cutoffTime.getTime() / 1000)}:t>.*`,
    bet: createdBet
  };
}

/**
 * Settles all pending bets for a finished fixture.
 */
export async function settleFixtureBets(fixtureId: string, homeScore: number, awayScore: number) {
  const fixture = await prisma.matchFixture.findUnique({
    where: { id: fixtureId },
    include: { bets: { include: { bettor: true } } }
  });

  if (!fixture) return;

  const winningPick = homeScore > awayScore ? 'HOME' : awayScore > homeScore ? 'AWAY' : 'DRAW';
  logger.info(`Settling ${fixture.bets.length} bets for Fixture #${fixture.fixtureNumber} (Result: ${winningPick})`);

  for (const bet of fixture.bets) {
    if (bet.status !== 'PENDING') continue;

    if (bet.pick === winningPick) {
      const payout = BigInt(Math.floor(Number(bet.amount) * bet.lockedMultiplier));
      await prisma.$transaction([
        prisma.player.update({
          where: { id: bet.bettorId },
          data: { coins: { increment: payout } }
        }),
        prisma.matchBet.update({
          where: { id: bet.id },
          data: { status: 'WON', payout }
        })
      ]);
      logger.info(`Bet #${bet.id} WON: Payout of ${payout} coins delivered to Player ${bet.bettorId}`);
    } else {
      await prisma.matchBet.update({
        where: { id: bet.id },
        data: { status: 'LOST', payout: 0n }
      });
    }
  }
}
