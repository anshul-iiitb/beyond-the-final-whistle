import 'dotenv/config';
import { Client, GatewayIntentBits } from 'discord.js';
import fs from 'fs';
import path from 'path';

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildEmojisAndStickers]
});

client.on('ready', async () => {
  console.log('Emoji sync runner online as', client.user.tag);
  const guild = client.guilds.cache.get('1574068651915743272') || client.guilds.cache.first();
  if (!guild) {
    console.error('Guild not found');
    process.exit(1);
  }

  const emojisDir = path.resolve('assets/emojis');
  const files = fs.readdirSync(emojisDir).filter(f => f.endsWith('.png') && !f.startsWith('test_') && !f.startsWith('openai_'));

  console.log(`Syncing ${files.length} transparent emojis to guild: ${guild.name} (${guild.id})...`);

  for (const file of files) {
    const emojiName = path.basename(file, '.png');
    const filePath = path.join(emojisDir, file);

    const existing = guild.emojis.cache.find(e => e.name && e.name.toLowerCase() === emojiName.toLowerCase());
    if (existing) {
      console.log(`[DELETE] Replacing existing emoji ${emojiName} (${existing.id})...`);
      await existing.delete().catch(e => console.error(`Delete fail ${emojiName}:`, e.message));
    }

    try {
      const created = await guild.emojis.create({
        attachment: filePath,
        name: emojiName
      });
      console.log(`[CREATED] ${emojiName} -> ${created.toString()}`);
    } catch (err) {
      console.error(`[ERROR] Failed to create emoji ${emojiName}:`, err.message);
    }
  }

  console.log('All transparent emojis successfully synced to Discord!');
  process.exit(0);
});

client.login(process.env.DISCORD_TOKEN);
