const { Client, GatewayIntentBits } = require('discord.js');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
dotenv.config();

const token = process.env.LEAGUE_MASTER_TOKEN || process.env.DISCORD_TOKEN;
const GUILD_ID = '1574068651915743272';

const EMOJIS_TO_REPLACE = [
  'stamina',
  'sd',
  'strika',
  'passa',
  'bully',
  'coin',
  'tp',
  'followers',
  'car',
  'goldenboot',
  'goldmedal',
  'silvermedal',
  'motm',
  'adidas',
  'cocacola',
  'netflix',
  'nike',
  'zztick',
  'zzcross'
];

const sleep = (ms) => new Promise(res => setTimeout(res, ms));

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildExpressions,
  ]
});

client.once('clientReady', async () => {
  console.log(`🤖 Logged in as ${client.user.tag}`);
  const guild = client.guilds.cache.get(GUILD_ID);
  if (!guild) {
    console.error('❌ Guild not found!');
    process.exit(1);
  }

  console.log(`🏰 Target Server: "${guild.name}" (${guild.id})`);
  let existingEmojis = await guild.emojis.fetch();
  console.log(`Current total emojis in guild: ${existingEmojis.size}`);

  const assetsDir = path.resolve(__dirname, '../assets/emojis');
  const results = {};

  for (const name of EMOJIS_TO_REPLACE) {
    const filePath = path.join(assetsDir, `${name}.png`);
    if (!fs.existsSync(filePath)) {
      console.warn(`⚠️ Asset file missing: ${filePath}`);
      continue;
    }

    const oldEmoji = existingEmojis.find(e => e.name?.toLowerCase() === name.toLowerCase());
    if (oldEmoji) {
      try {
        console.log(`🗑️ Deleting old :${name}: (${oldEmoji.id})...`);
        await oldEmoji.delete(`Upgrading to new high-definition transparent ${name} asset`);
        await sleep(700);
      } catch (err) {
        console.error(`❌ Failed to delete old :${name}:`, err.message);
      }
    }

    try {
      console.log(`✨ Creating new :${name}: from ${name}.png...`);
      const newEmoji = await guild.emojis.create({
        attachment: filePath,
        name: name,
        reason: `Clean high-res transparent ${name} emoji`
      });
      console.log(`  + Created :${name}: -> <:${name}:${newEmoji.id}>`);
      results[name] = `<:${name}:${newEmoji.id}>`;
      await sleep(800);
    } catch (err) {
      console.error(`❌ Failed to create :${name}:`, err.message);
    }
  }

  console.log('\n--- ALL UPDATED EMOJIS ---');
  const allCurrent = await guild.emojis.fetch();
  const allMap = {};
  allCurrent.forEach(e => {
    allMap[e.name] = `<:${e.name}:${e.id}>`;
    console.log(`  ${e.name}: '<:${e.name}:${e.id}>',`);
  });

  fs.writeFileSync(path.resolve(__dirname, 'latest_guild_emojis.json'), JSON.stringify(allMap, null, 2));
  console.log('✅ Saved updated emojis to latest_guild_emojis.json');

  process.exit(0);
});

client.login(token);
