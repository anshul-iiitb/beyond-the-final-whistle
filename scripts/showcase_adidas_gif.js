import 'dotenv/config';
import { Client, GatewayIntentBits, EmbedBuilder, AttachmentBuilder } from 'discord.js';
import path from 'path';

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

client.on('ready', async () => {
  console.log('Online as', client.user.tag);
  const guild = client.guilds.cache.get('1574068651915743272');
  const channel = guild.channels.cache.get('1574068652687499296');

  const adGifPath = path.resolve(process.cwd(), 'assets/adverts/adidas.gif');
  const attachment = new AttachmentBuilder(adGifPath, { name: 'adidas.gif' });

  const embed = new EmbedBuilder()
    .setColor('#f59e0b')
    .setTitle('👟 Adidas Brand Sponsorship Shoot Complete!')
    .setDescription(
      `📸 **Commercial Advert Live!**\n\n` +
      `🪙 **Reward:** \`+200k coins\`\n` +
      `⚡ **Stamina Cost:** \`-10 ⚡\`\n` +
      `👥 **Followers:** \`1,000,000 👤 Required\`\n\n` +
      `*(Updated with user-provided Adidas animation GIF)*`
    )
    .setImage('attachment://adidas.gif')
    .setFooter({ text: 'Beyond The Final Whistle • Commercial Hub' });

  await channel.send({ embeds: [embed], files: [attachment] });
  console.log('Sent updated Adidas advert GIF showcase to #general!');
  process.exit(0);
});

client.login(process.env.DISCORD_TOKEN);
