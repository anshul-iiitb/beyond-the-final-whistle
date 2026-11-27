const dotenv = require('dotenv');
dotenv.config();

function getFreshMorocco() {
  return {
    name: 'Morocco',
    alias: 'mor',
    flag: '🇲🇦',
    penaltyTakerName: 'Shane',
    freeKickTakerName: 'Shane',
    cornerTakerName: 'Mercking',
    tactics: {
      teamMentality: 'Attacking',
      focusPassing: 'Through The Middle',
      passingStyle: 'Short',
      forceCounter: 'On',
      pressingStyle: 'High',
      tacklingStyle: 'Hard',
      markingStyle: 'Man-To-Man',
      offsideTrap: 'On'
    },
    color: [16, 185, 129],
    score: 0,
    possession: 55,
    players: {
      atk: {
        id: 'mor-1',
        name: 'Shane',
        position: 'ATK',
        playstyle: 'PCH',
        flag: '🇲🇦',
        fin: 59, pas: 57, tck: 55, dri: 59, int: 56, pac: 59, cmp: 58, vis: 57, phy: 58, wrk: 58, hea: 58, pow: 58,
        goals: 0, assists: 0, shots: 0, tackles: 0, interceptions: 0, passesCompleted: 24, dribblesWon: 0, fouls: 0, yellowCards: 0, redCards: 0, rating: 6.0
      },
      mid: {
        id: 'mor-2',
        name: 'Idkunknown',
        position: 'MID',
        playstyle: 'ANC',
        flag: '🇲🇦',
        fin: 56, pas: 59, tck: 59, dri: 57, int: 58, pac: 57, cmp: 58, vis: 59, phy: 58, wrk: 59, hea: 57, pow: 58,
        goals: 0, assists: 0, shots: 0, tackles: 0, interceptions: 0, passesCompleted: 35, dribblesWon: 0, fouls: 0, yellowCards: 0, redCards: 0, rating: 6.0
      },
      def: {
        id: 'mor-3',
        name: 'Mercking',
        position: 'DEF',
        playstyle: 'BPD',
        flag: '🇲🇦',
        fin: 55, pas: 58, tck: 59, dri: 56, int: 59, pac: 58, cmp: 57, vis: 57, phy: 59, wrk: 58, hea: 59, pow: 59,
        goals: 0, assists: 0, shots: 0, tackles: 0, interceptions: 0, passesCompleted: 20, dribblesWon: 0, fouls: 0, yellowCards: 0, redCards: 0, rating: 6.0
      }
    }
  };
}

function getFreshMexico() {
  return {
    name: 'Mexico',
    alias: 'mex',
    flag: '🇲🇽',
    penaltyTakerName: 'Shaquib',
    freeKickTakerName: 'Shaquib',
    cornerTakerName: 'Theexampleofmiracle',
    tactics: {
      teamMentality: 'Defensive',
      focusPassing: 'Flank Long Ball',
      passingStyle: 'Long',
      forceCounter: 'On',
      pressingStyle: 'Low',
      tacklingStyle: 'Hard',
      markingStyle: 'Zonal',
      offsideTrap: 'Off'
    },
    color: [5, 150, 105],
    score: 0,
    possession: 45,
    players: {
      atk: {
        id: 'mex-1',
        name: 'Shaquib',
        position: 'ATK',
        playstyle: 'TGT',
        flag: '🇲🇽',
        fin: 52, pas: 50, tck: 50, dri: 51, int: 50, pac: 52, cmp: 51, vis: 50, phy: 52, wrk: 51, hea: 52, pow: 52,
        goals: 0, assists: 0, shots: 0, tackles: 0, interceptions: 0, passesCompleted: 15, dribblesWon: 0, fouls: 0, yellowCards: 0, redCards: 0, rating: 6.0
      },
      mid: {
        id: 'mex-2',
        name: 'Darkvoid',
        position: 'MID',
        playstyle: 'DLP',
        flag: '🇲🇽',
        fin: 50, pas: 52, tck: 51, dri: 50, int: 51, pac: 50, cmp: 51, vis: 52, phy: 51, wrk: 52, hea: 50, pow: 51,
        goals: 0, assists: 0, shots: 0, tackles: 0, interceptions: 0, passesCompleted: 22, dribblesWon: 0, fouls: 0, yellowCards: 0, redCards: 0, rating: 6.0
      },
      def: {
        id: 'mex-3',
        name: 'Theexampleofmiracle',
        position: 'DEF',
        playstyle: 'SWP',
        flag: '🇲🇽',
        fin: 50, pas: 50, tck: 52, dri: 50, int: 52, pac: 51, cmp: 50, vis: 50, phy: 52, wrk: 51, hea: 51, pow: 51,
        goals: 0, assists: 0, shots: 0, tackles: 0, interceptions: 0, passesCompleted: 14, dribblesWon: 0, fouls: 0, yellowCards: 0, redCards: 0, rating: 6.0
      }
    }
  };
}

async function runBenchmark() {
  const { runLiveEpisodicMatch } = await import('../dist/engines/liveMatchEngine.js');

  // Mock client and channel
  const mockChannel = {
    name: 'benchmark',
    isTextBased: () => true,
    send: async () => ({ id: 'mock-msg' })
  };
  const mockClient = {
    user: { displayAvatarURL: () => 'https://example.com/bot.png' },
    channels: {
      cache: {
        get: () => mockChannel,
        find: () => mockChannel
      }
    }
  };

  const TOTAL_RUNS = 40;
  console.log(`Running ${TOTAL_RUNS} headless match simulations (Morocco 57-59 vs Mexico 50-52)...\n`);

  let homeWins = 0;
  let awayWins = 0;
  let draws = 0;
  let blowouts = 0; // margin >= 4
  let normalWins = 0; // margin 1 or 2
  let scorelines = {};
  let totalHomeGoals = 0;
  let totalAwayGoals = 0;
  let mexicoScoredCount = 0;

  for (let i = 1; i <= TOTAL_RUNS; i++) {
    const morocco = getFreshMorocco();
    const mexico = getFreshMexico();

    const result = await runLiveEpisodicMatch(mockClient, mockChannel, morocco, mexico, {
      tickDelayMs: 0,
      halfTimePauseMs: 0
    });

    const key = `${result.homeScore}-${result.awayScore}`;
    scorelines[key] = (scorelines[key] || 0) + 1;
    totalHomeGoals += result.homeScore;
    totalAwayGoals += result.awayScore;

    if (result.awayScore > 0) mexicoScoredCount++;

    const margin = Math.abs(result.homeScore - result.awayScore);
    if (result.homeScore > result.awayScore) {
      homeWins++;
      if (margin >= 4) blowouts++;
      else normalWins++;
    } else if (result.awayScore > result.homeScore) {
      awayWins++;
      if (margin >= 4) blowouts++;
      else normalWins++;
    } else {
      draws++;
    }
  }

  console.log(`=== SIMULATION RESULTS (${TOTAL_RUNS} MATCHES) ===`);
  console.log(`Morocco Wins (Favorite): ${homeWins} (${((homeWins / TOTAL_RUNS) * 100).toFixed(1)}%)`);
  console.log(`Mexico Wins (Underdog Upset): ${awayWins} (${((awayWins / TOTAL_RUNS) * 100).toFixed(1)}%)`);
  console.log(`Draws (Competitive): ${draws} (${((draws / TOTAL_RUNS) * 100).toFixed(1)}%)`);
  console.log(`Normal Wins (1-0, 2-0, 2-1, 3-1): ${normalWins} (${((normalWins / TOTAL_RUNS) * 100).toFixed(1)}%)`);
  console.log(`Blowouts (Margin >= 4): ${blowouts} (${((blowouts / TOTAL_RUNS) * 100).toFixed(1)}%)`);
  console.log(`Matches Mexico Scored In: ${mexicoScoredCount}/${TOTAL_RUNS} (${((mexicoScoredCount / TOTAL_RUNS) * 100).toFixed(1)}%)`);
  console.log(`Average Goals: Morocco ${(totalHomeGoals / TOTAL_RUNS).toFixed(2)} - ${(totalAwayGoals / TOTAL_RUNS).toFixed(2)} Mexico`);
  console.log(`\nScoreline Distribution:`);
  console.log(scorelines);
}

runBenchmark().catch(console.error);
