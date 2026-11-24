const { Client, GatewayIntentBits } = require('discord.js');
const dotenv = require('dotenv');
dotenv.config();

const token = process.env.DISCORD_TOKEN;
const GUILD_ID = '1574068651915743272';
const CHANNEL_ID = '1574439115783409845'; // #๑•⚽│live-match
const NEWS_CHANNEL_ID = '1574439070992306236'; // #๑•📰│news

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
        fin: 88, pas: 74, tck: 52, dri: 84, int: 50, pac: 86, cmp: 86, vis: 76, phy: 78, wrk: 82,
        goals: 0, assists: 0, shots: 0, tackles: 0, interceptions: 0, passesCompleted: 24, dribblesWon: 0, fouls: 0, yellowCards: 0, redCards: 0, rating: 6.0
      },
      mid: {
        id: 'mor-2',
        name: 'Idkunknown',
        position: 'MID',
        playstyle: 'ANC',
        flag: '🇲🇦',
        fin: 68, pas: 84, tck: 88, dri: 76, int: 86, pac: 80, cmp: 84, vis: 82, phy: 85, wrk: 88,
        goals: 0, assists: 0, shots: 0, tackles: 0, interceptions: 0, passesCompleted: 35, dribblesWon: 0, fouls: 0, yellowCards: 0, redCards: 0, rating: 6.0
      },
      def: {
        id: 'mor-3',
        name: 'Mercking',
        position: 'DEF',
        playstyle: 'BPD',
        flag: '🇲🇦',
        fin: 60, pas: 86, tck: 85, dri: 72, int: 88, pac: 78, cmp: 86, vis: 85, phy: 84, wrk: 82,
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
      forceCounter: 'Off',
      pressingStyle: 'Low',
      tacklingStyle: 'Normal',
      markingStyle: 'Zonal',
      offsideTrap: 'Off'
    },
    color: [4, 120, 87], // Dark Forest Green #047857
    score: 0,
    possession: 43,
    players: {
      atk: {
        id: 'mex-1',
        name: 'Darkvoid',
        position: 'ATK',
        playstyle: 'ATT',
        flag: '🇲🇽',
        fin: 50, pas: 50, tck: 50, dri: 50, int: 50, pac: 50, cmp: 50, vis: 50, phy: 50, wrk: 50,
        goals: 0, assists: 0, shots: 0, tackles: 0, interceptions: 0, passesCompleted: 12, dribblesWon: 0, fouls: 0, yellowCards: 0, redCards: 0, rating: 6.0
      },
      mid: {
        id: 'mex-2',
        name: 'Shaquib',
        position: 'MID',
        playstyle: 'MID',
        flag: '🇲🇽',
        fin: 50, pas: 50, tck: 50, dri: 50, int: 50, pac: 50, cmp: 50, vis: 50, phy: 50, wrk: 50,
        goals: 0, assists: 0, shots: 0, tackles: 0, interceptions: 0, passesCompleted: 15, dribblesWon: 0, fouls: 0, yellowCards: 0, redCards: 0, rating: 6.0
      },
      def: {
        id: 'mex-3',
        name: 'Theexampleofmiracle',
        position: 'DEF',
        playstyle: 'DEF',
        flag: '🇲🇽',
        fin: 50, pas: 50, tck: 50, dri: 50, int: 50, pac: 50, cmp: 50, vis: 50, phy: 50, wrk: 50,
        goals: 0, assists: 0, shots: 0, tackles: 0, interceptions: 0, passesCompleted: 16, dribblesWon: 0, fouls: 0, yellowCards: 0, redCards: 0, rating: 6.0
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
