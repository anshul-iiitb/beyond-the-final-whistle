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

  console.log(`🏟️ Starting live episodic match simulation in #${channel.name}...`);

  const { runLiveEpisodicMatch } = await import('../dist/engines/liveMatchEngine.js');

  const team1 = {
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
    possession: 57,
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

  const team2 = {
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
    possession: 47,
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

  try {
    const result = await runLiveEpisodicMatch(client, channel, team1, team2, {
      tickDelayMs: 3000,
      halfTimePauseMs: 6000,
      newsChannelId: NEWS_CHANNEL_ID
    });

    console.log(`\n🎉 MATCH BROADCAST COMPLETED!`);
    console.log(`Final Result: ${team1.name} ${result.homeScore} - ${result.awayScore} ${team2.name}`);
    console.log(`Possession: ${result.homePossession}% vs ${result.awayPossession}%`);
    console.log(`MOTM: ${result.motmPlayerName} (${result.motmRating})`);
  } catch (err) {
    console.error('❌ Match execution failed:', err);
  } finally {
    setTimeout(() => process.exit(0), 1000);
  }
});

client.login(token);
