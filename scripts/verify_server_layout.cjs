const { Client, GatewayIntentBits } = require('discord.js');
const dotenv = require('dotenv');
dotenv.config();
const token = process.env.LEAGUE_MASTER_TOKEN || process.env.DISCORD_TOKEN;
const GUILD_ID = '1574068651915743272';

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once('clientReady', async () => {
  const guild = client.guilds.cache.get(GUILD_ID);
  const channels = await guild.channels.fetch();
  const roles = await guild.roles.fetch();

  console.log(`\n================ GUILD: ${guild.name} (${guild.id}) ================`);
  console.log(`Roles count: ${roles.size}`);
  console.log(`Channels count: ${channels.size}`);

  const categories = Array.from(channels.values())
    .filter(c => c && c.type === 4)
    .sort((a, b) => a.rawPosition - b.rawPosition);

  for (const cat of categories) {
    console.log(`\n📁 [Category: ${cat.name}] (pos: ${cat.rawPosition})`);
    const children = Array.from(channels.values())
      .filter(c => c && c.parentId === cat.id)
      .sort((a, b) => a.rawPosition - b.rawPosition);
    for (const ch of children) {
      console.log(`   # ${ch.name} (type: ${ch.type})`);
    }
  }

  const uncategorized = Array.from(channels.values()).filter(c => c && !c.parentId && c.type !== 4);
  if (uncategorized.length > 0) {
    console.log(`\n📁 [Uncategorized]`);
    for (const ch of uncategorized) {
      console.log(`   # ${ch.name}`);
    }
  }

  process.exit(0);
});

client.login(token);
