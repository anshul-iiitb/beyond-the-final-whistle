import 'dotenv/config';
import { Client, GatewayIntentBits } from 'discord.js';
import fs from 'fs';
import path from 'path';

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildEmojisAndStickers]
});

client.rest.on('rateLimited', info => {
  console.log(`[RATE LIMIT] route: ${info.route}, retryAfter: ${info.retryAfter}ms, global: ${info.global}`);
});

// The list of emojis that must be updated/created
const TARGETS = [
  'heineken',
  'motm',
  'passa',
  'sd',
  'silvermedal',
  'stamina',
  'strika',
  'worldcup'
];

client.on('ready', async () => {
  console.log('Targeted Emoji sync runner online as', client.user.tag);
  const guild = client.guilds.cache.get('1574068651915743272') || client.guilds.cache.first();
  if (!guild) {
    console.error('Guild not found');
    process.exit(1);
  }

  // Remove stale temporary emojis
  const stale = guild.emojis.cache.filter(e => e.name && (e.name === 'coin_solid' || e.name === 'stamina_solid'));
  for (const [id, e] of stale) {
    console.log(`[CLEANUP] Removing stale emoji: ${e.name} (${id})`);
    await e.delete().catch(() => {});
  }

  const emojisDir = path.resolve('assets/emojis');

  for (const name of TARGETS) {
    const filePath = path.join(emojisDir, `${name}.png`);
    if (!fs.existsSync(filePath)) {
      console.warn(`File not found for ${name}`);
      continue;
    }

    const existing = guild.emojis.cache.find(e => e.name && e.name.toLowerCase() === name.toLowerCase());
    if (existing) {
      console.log(`[REPLACING] Deleting old emoji ${name} (${existing.id})...`);
      await existing.delete().catch(err => console.error(`Delete failed: ${err.message}`));
      await new Promise(r => setTimeout(r, 1500));
    }

    try {
      console.log(`[UPLOADING] Creating new ${name} from edited assets...`);
      const created = await guild.emojis.create({
        attachment: filePath,
        name: name
      });
      console.log(`[SUCCESS] ${name} -> ${created.toString()}`);
    } catch (err) {
      console.error(`[ERROR] Failed to create ${name}: ${err.message}`);
    }

    await new Promise(r => setTimeout(r, 2000));
  }

  console.log('Targeted emoji sync completed!');
  process.exit(0);
});

client.login(process.env.DISCORD_TOKEN);
