const { Client, GatewayIntentBits } = require('discord.js');
const dotenv = require('dotenv');
dotenv.config();

const token = process.env.DISCORD_TOKEN;
const GUILD_ID = '1574068651915743272';
const CHANNEL_ID = '1574439115783409845'; // #๑•⚽│live-match
const NEWS_CHANNEL_ID = '1574439119227064402'; // #๑•📰│btfw-news

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
  ]
});

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
    color: [16, 185, 129], // Emerald #10b981
    score: 0,
    possession: 55,
    players: {
      atk: {
        id: 'mor-1',
        name: 'Shane',
        position: 'ATK',
        playstyle: 'PCH',
        flag: '🇲🇦',
        fin: 59, pas: 57, tck: 55, dri: 59, int: 56, pac: 59, cmp: 58, vis: 57, phy: 58, wrk: 58,
        goals: 0, assists: 0, shots: 0, tackles: 0, interceptions: 0, passesCompleted: 24, dribblesWon: 0, fouls: 0, yellowCards: 0, redCards: 0, rating: 6.0
      },
      mid: {
        id: 'mor-2',
        name: 'Idkunknown',
        position: 'MID',
        playstyle: 'ANC',
        flag: '🇲🇦',
        fin: 56, pas: 59, tck: 59, dri: 57, int: 58, pac: 57, cmp: 58, vis: 59, phy: 58, wrk: 59,
        goals: 0, assists: 0, shots: 0, tackles: 0, interceptions: 0, passesCompleted: 35, dribblesWon: 0, fouls: 0, yellowCards: 0, redCards: 0, rating: 6.0
      },
      def: {
        id: 'mor-3',
        name: 'Mercking',
        position: 'DEF',
        playstyle: 'BPD',
        flag: '🇲🇦',
        fin: 55, pas: 58, tck: 59, dri: 56, int: 59, pac: 57, cmp: 58, vis: 58, phy: 59, wrk: 58,
        goals: 0, assists: 0, shots: 0, tackles: 0, interceptions: 0, passesCompleted: 42, dribblesWon: 0, fouls: 0, yellowCards: 0, redCards: 0, rating: 6.0
      }
    }
  };
}

function getFreshMexico() {
  return {
    name: 'Mexico',
    alias: 'mex',
    flag: '🇲🇽',
    penaltyTakerName: 'Darkvoid',
    freeKickTakerName: 'Shaquib',
    cornerTakerName: 'Shaquib',
    tactics: {
      teamMentality: 'Defensive',
      focusPassing: 'Down Both Flanks',
      passingStyle: 'Long',
      forceCounter: 'On',
      pressingStyle: 'High',
      tacklingStyle: 'Hard',
      markingStyle: 'Zonal',
      offsideTrap: 'Off'
    },
    color: [4, 120, 87], // Dark Forest Green #047857
    score: 0,
    possession: 45,
    players: {
      atk: {
        id: 'mex-1',
        name: 'Darkvoid',
        position: 'ATK',
        playstyle: 'ATT',
        flag: '🇲🇽',
        fin: 52, pas: 50, tck: 51, dri: 52, int: 50, pac: 52, cmp: 51, vis: 50, phy: 51, wrk: 52,
        goals: 0, assists: 0, shots: 0, tackles: 0, interceptions: 0, passesCompleted: 14, dribblesWon: 0, fouls: 0, yellowCards: 0, redCards: 0, rating: 6.0
      },
      mid: {
        id: 'mex-2',
        name: 'Shaquib',
        position: 'MID',
        playstyle: 'MID',
        flag: '🇲🇽',
        fin: 50, pas: 52, tck: 51, dri: 51, int: 51, pac: 50, cmp: 51, vis: 52, phy: 51, wrk: 52,
        goals: 0, assists: 0, shots: 0, tackles: 0, interceptions: 0, passesCompleted: 18, dribblesWon: 0, fouls: 0, yellowCards: 0, redCards: 0, rating: 6.0
      },
      def: {
        id: 'mex-3',
        name: 'Theexampleofmiracle',
        position: 'DEF',
        playstyle: 'DEF',
        flag: '🇲🇽',
        fin: 50, pas: 51, tck: 52, dri: 50, int: 52, pac: 51, cmp: 50, vis: 51, phy: 52, wrk: 51,
        goals: 0, assists: 0, shots: 0, tackles: 0, interceptions: 0, passesCompleted: 19, dribblesWon: 0, fouls: 0, yellowCards: 0, redCards: 0, rating: 6.0
      }
    }
  };
}

client.once('clientReady', async () => {
  console.log(`🤖 Logged in as ${client.user.tag}`);
  const guild = client.guilds.cache.get(GUILD_ID);
  if (!guild) {
    console.error('❌ Guild not found!');
    process.exit(1);
  }

  const channel = guild.channels.cache.get(CHANNEL_ID);
  if (!channel || !channel.isTextBased()) {
    console.error('❌ Target #live-match channel not found!');
    process.exit(1);
  }

  const { runLiveEpisodicMatch } = await import('../dist/engines/liveMatchEngine.js');

  const allResults = [];
  const TOTAL_MATCHES = 4;

  console.log(`\n======================================================`);
  console.log(`🚀 STARTING BATCH SIMULATION: ${TOTAL_MATCHES} MATCHES`);
  console.log(`Morocco (57-59) vs Mexico (50-52)`);
  console.log(`======================================================\n`);

  for (let i = 1; i <= TOTAL_MATCHES; i++) {
    console.log(`\n>>> [MATCH ${i}/${TOTAL_MATCHES}] Starting Simulation...`);
    const morocco = getFreshMorocco();
    const mexico = getFreshMexico();

    try {
      const result = await runLiveEpisodicMatch(client, channel, morocco, mexico, {
        tickDelayMs: 650,
        halfTimePauseMs: 1500,
        newsChannelId: NEWS_CHANNEL_ID
      });

      const summary = {
        matchNumber: i,
        scoreline: `Morocco ${result.homeScore} - ${result.awayScore} Mexico`,
        homeScore: result.homeScore,
        awayScore: result.awayScore,
        possession: `${result.homePossession}% vs ${result.awayPossession}%`,
        homePoss: result.homePossession,
        awayPoss: result.awayPossession,
        motm: `${result.motmPlayerName} (${result.motmRating})`,
        scorers: morocco.players.atk.goals > 0 || morocco.players.mid.goals > 0 || morocco.players.def.goals > 0 ||
                 mexico.players.atk.goals > 0 || mexico.players.mid.goals > 0 || mexico.players.def.goals > 0
      };

      allResults.push(summary);
      console.log(`✅ [MATCH ${i} FINISHED]: ${summary.scoreline} | Poss: ${summary.possession} | MOTM: ${summary.motm}`);
    } catch (err) {
      console.error(`❌ [MATCH ${i} ERROR]:`, err.message);
    }

    // Small breather between broadcasts
    await new Promise(r => setTimeout(r, 2000));
  }

  console.log(`\n======================================================`);
  console.log(`📊 FINAL BATCH RESULTS (4 MATCHES):`);
  console.log(JSON.stringify(allResults, null, 2));
  console.log(`======================================================\n`);

  client.destroy();
  process.exit(0);
});

client.login(token);
