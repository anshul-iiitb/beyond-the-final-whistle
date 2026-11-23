const { Client, GatewayIntentBits, ChannelType } = require('discord.js');
const dotenv = require('dotenv');
dotenv.config();
const token = process.env.LEAGUE_MASTER_TOKEN || process.env.DISCORD_TOKEN;
const GUILD_ID = '1574068651915743272';

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once('clientReady', async () => {
  const guild = client.guilds.cache.get(GUILD_ID);
  if (!guild) process.exit(1);

  const voiceCategory = guild.channels.cache.find(c => c.type === ChannelType.GuildCategory && c.name.includes('Voice Lounge'));
  if (!voiceCategory) {
    console.error('Voice category not found');
    process.exit(1);
  }

  const voiceChannels = [
    '🔊 Lobby',
    '🎮 Gaming Lounge',
    '🏟️ Match Watch Party',
    '🎙️ Press Conference VC'
  ];

  for (const name of voiceChannels) {
    const existing = guild.channels.cache.find(c => c.parentId === voiceCategory.id && c.name === name);
    if (!existing) {
      await guild.channels.create({
        name,
        type: ChannelType.GuildVoice,
        parent: voiceCategory.id,
        reason: 'WITS Voice Lounge Setup'
      });
      console.log(`+ Created Voice Channel: "${name}"`);
    } else {
      console.log(`= Voice Channel exists: "${name}"`);
    }
  }

  console.log('✅ Voice Lounge complete.');
  process.exit(0);
});

client.login(token);
