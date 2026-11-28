import { prisma } from '../database/prisma.js';
import { calculateDerivedRatings } from './matchSimulationEngine.js';
import { logger } from '../utils/logger.js';

export const MATCHDAY_LOCKOUT_WHITELIST = new Set([
  'tweet', 'chirp',
  'tactics',
  'intteam', 'team',
  'profile', 'p', 'bio', 'setdesc',
  'lb', 'leaderboard',
  'cd', 'cooldown', 'cooldowns',
  'inv', 'inventory', 'locker', 'bag',
  'locations', 'locs',
  'odds', 'bets', 'fixtures',
  'roster', 'intstats', 'clubstats',
  'help', 'setup', 'gitpull', 'fixture'
]);

/**
 * Checks if a matchday lockout is currently active:
 * Freezes economy/stats/training from 30min before kickoff to 15min after full-time.
 */
export async function checkMatchdayLockout(cmd: string): Promise<{ locked: boolean; message?: string }> {
  if (MATCHDAY_LOCKOUT_WHITELIST.has(cmd.toLowerCase())) {
    return { locked: false };
  }

  const now = new Date();
  const thirtyMinsFromNow = new Date(now.getTime() + 30 * 60 * 1000);

  // Find any fixture scheduled within next 30m, currently LIVE, or completed within last 15m
  const activeFixtures = await prisma.matchFixture.findMany({
    where: {
      OR: [
        {
          status: 'SCHEDULED',
          scheduledAt: { lte: thirtyMinsFromNow }
        },
        {
          status: 'LIVE'
        },
        {
          status: 'COMPLETED',
          endedAt: { gte: new Date(now.getTime() - 15 * 60 * 1000) }
        }
      ]
    }
  });

  if (activeFixtures.length === 0) {
    return { locked: false };
  }

  const f = activeFixtures[0];
  const matchDesc = `${f.homeTeamName} vs ${f.awayTeamName}`;
  const statusDesc = f.status === 'LIVE' ? 'is currently **LIVE ON PITCH**' : f.status === 'COMPLETED' ? 'just ended (**Post-Match Cooldown**)' : 'kicks off in under **30 minutes**';

  return {
    locked: true,
    message:
      `🏟️ **MATCHDAY LOCKOUT IN EFFECT!**\n\n` +
      `**${matchDesc}** ${statusDesc}.\n` +
      `To ensure competitive integrity, all training, economy, inventory transfers, and sports betting are frozen from **30 minutes prior to kickoff until 15 minutes after full-time**.\n\n` +
      `📢 *Permitted during lockout:* \`-tactics\`, \`-intteam\`, and \`-tweet\` (TwitFeed).`
  };
}

/**
 * Calculates algorithmic team strength considering player OVRs, position-matched boots,
 * capped TP stat boosts (+10 max), intel scouting, tactics, and home stadium level.
 */
export async function calculateTeamStrengthRating(teamKey: string, isHome: boolean = false): Promise<{
  ovr: number;
  atk: number;
  mid: number;
  def: number;
  tpBoostTotal: number;
  activeBootsCount: number;
  stadiumBonus: number;
  teamName: string;
}> {
  const nation = await prisma.nationalTeam.findFirst({
    where: { OR: [{ alias: teamKey }, { id: teamKey }] },
    include: { players: true }
  });

  const club = !nation ? await prisma.footballClub.findFirst({
    where: { OR: [{ alias: teamKey }, { id: teamKey }] },
    include: { players: true }
  }) : null;

  const team = nation || club;
  if (!team) {
    return {
      ovr: 65, atk: 65, mid: 65, def: 65,
      tpBoostTotal: 0, activeBootsCount: 0, stadiumBonus: 0,
      teamName: teamKey.toUpperCase()
    };
  }

  let lineupIds: string[] = [];
  try {
    lineupIds = JSON.parse(team.lineup || '[]');
  } catch {
    lineupIds = [];
  }

  const getPlayerForSlot = (idx: number, fallbackPos: string) => {
    if (lineupIds[idx]) {
      const match = team.players.find(p => p.id === lineupIds[idx]);
      if (match) return match;
    }
    const posMatch = team.players.find(p => p.position === fallbackPos);
    return posMatch || team.players[idx] || null;
  };

  const atkPlayer = getPlayerForSlot(0, 'ATT');
  const midPlayer = getPlayerForSlot(1, 'MID');
  const defPlayer = getPlayerForSlot(2, 'DEF');

  const atkDerived = atkPlayer ? calculateDerivedRatings(atkPlayer, 'ATK') : { atk: 65, mid: 60, def: 55 };
  const midDerived = midPlayer ? calculateDerivedRatings(midPlayer, 'MID') : { atk: 60, mid: 65, def: 60 };
  const defDerived = defPlayer ? calculateDerivedRatings(defPlayer, 'DEF') : { atk: 55, mid: 60, def: 65 };

  let tpBoostTotal = 0;
  let activeBootsCount = 0;

  if (atkPlayer) {
    tpBoostTotal += Math.min(10, Math.floor((atkPlayer.trainingPoints || 0) / 4));
    if (atkPlayer.activeBoots === 'strika') activeBootsCount++;
  }
  if (midPlayer) {
    tpBoostTotal += Math.min(10, Math.floor((midPlayer.trainingPoints || 4) / 4));
    if (midPlayer.activeBoots === 'passa') activeBootsCount++;
  }
  if (defPlayer) {
    tpBoostTotal += Math.min(10, Math.floor((defPlayer.trainingPoints || 0) / 4));
    if (defPlayer.activeBoots === 'bully') activeBootsCount++;
  }

  const stadiumBonus = isHome ? Math.min(6, (team.stadiumLevel || 1) * 1.5) : 0;

  const teamAtk = Math.min(99, atkDerived.atk + Math.round(stadiumBonus * 0.5));
  const teamMid = Math.min(99, midDerived.mid + Math.round(stadiumBonus * 0.8));
  const teamDef = Math.min(99, defDerived.def + Math.round(stadiumBonus * 0.5));
  const teamOvr = Math.round((teamAtk + teamMid + teamDef) / 3);

  return {
    ovr: teamOvr,
    atk: teamAtk,
    mid: teamMid,
    def: teamDef,
    tpBoostTotal,
    activeBootsCount,
    stadiumBonus,
    teamName: team.name
  };
}

/**
 * Calculates fair European decimal odds for home, draw, and away based on dynamic algorithmic strength ratings.
 */
export async function calculateAlgorithmicOdds(homeKey: string, awayKey: string) {
  const home = await calculateTeamStrengthRating(homeKey, true);
  const away = await calculateTeamStrengthRating(awayKey, false);

  const diff = home.ovr - away.ovr;
  const pHomeRaw = 1 / (1 + Math.pow(10, -diff / 22));
  const pDraw = 0.26 * Math.exp(-Math.pow(diff / 18, 2));
  const pHome = Math.max(0.12, Math.min(0.76, pHomeRaw * (1 - pDraw)));
  const pAway = Math.max(0.12, Math.min(0.76, 1 - pHome - pDraw));

  const margin = 1.05; // 5% bookmaker vigorish
  const homeOdds = +Math.max(1.15, Math.min(8.50, margin / pHome)).toFixed(2);
  const drawOdds = +Math.max(2.20, Math.min(6.50, margin / pDraw)).toFixed(2);
  const awayOdds = +Math.max(1.15, Math.min(8.50, margin / pAway)).toFixed(2);

  return {
    home,
    away,
    odds: {
      home: homeOdds,
      draw: drawOdds,
      away: awayOdds
    }
  };
}
