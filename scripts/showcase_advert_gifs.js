import 'dotenv/config';
import { Client, GatewayIntentBits, EmbedBuilder, AttachmentBuilder } from 'discord.js';
import path from 'path';
import fs from 'fs';

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildEmojisAndStickers]
});

client.on('ready', async () => {
  console.log('Advert showcase online as', client.user.tag);
  const guild = client.guilds.cache.get('1574068651915743272');
  if (!guild) {
    console.error('Guild not found');
    process.exit(1);
  }

  const channel = guild.channels.cache.get('1574068652687499296') || guild.channels.cache.find(c => c.isTextBased());
  if (!channel) {
    console.error('Channel not found');
    process.exit(1);
  }

  const getE = (name) => {
    const e = guild.emojis.cache.find(x => x.name.toLowerCase() === name.toLowerCase());
    return e ? e.toString() : '⚽';
  };

  const coin = getE('coin');
  const stamina = getE('stamina');

  await channel.send({
    content: '## 🎬 Commercial Brand Endorsement GIFs Showcase\n' +
      'Here are the animated commercial GIFs playing inside the result boxes for all 4 sponsors:'
  });

  const adverts = [
    {
      key: 'heineken',
      name: 'Heineken',
      emoji: '🍺',
      coins: '+100k',
      delta: '-50k followers 👤',
      file: 'heineken.gif',
      desc: '📸 **Heineken Official UCL Commercial Signed!**\nCelebratory beer toast campaign aired during Champions League matchday.'
    },
    {
      key: 'adidas',
      name: 'Adidas',
      emoji: '👟',
      coins: '+200k',
      delta: '0 followers 👤',
      file: 'adidas.gif',
      desc: '📸 **Adidas Football Commercial Signed!**\nPromoting the latest flagship Predator boots with high-speed pitch skills.'
    },
    {
      key: 'cocacola',
      name: 'Coca-Cola',
      emoji: '🥤',
      coins: '+300k',
      delta: '-200k followers 👤',
      file: 'cocacola.gif',
      desc: '📸 **Coca-Cola World Cup Commercial Signed!**\nGlobal football fan celebration campaign.'
    },
    {
      key: 'netflix',
      name: 'Netflix',
      emoji: '🎬',
      coins: '+300k',
      delta: '+50k followers 👤',
      file: 'netflix.gif',
      desc: '📸 **Netflix Docuseries Deal Signed!**\nExclusive backstage access football documentary series.'
    }
  ];

  for (const ad of adverts) {
    const gifPath = path.resolve('assets/adverts', ad.file);
    if (!fs.existsSync(gifPath)) continue;

    const attachment = new AttachmentBuilder(gifPath, { name: ad.file });
    const embed = new EmbedBuilder()
      .setColor('#f59e0b')
      .setTitle(`Anshul 🇮🇳 signed endorsement with ${ad.emoji} ${ad.name}!`)
      .setDescription(
        `${ad.desc}\n\n` +
        `🪙 **Earnings:** \`${ad.coins}\` ${coin}\n` +
        `👥 **Follower Change:** \`${ad.delta}\` (Total: \`1,250k 👤\`)\n` +
        `⚡ **Stamina:** \`85/100\` ${stamina}\n\n` +
        `*(2-hour brand photoshoot cooldown active)*`
      )
      .setImage(`attachment://${ad.file}`)
      .setFooter({ text: 'Beyond The Final Whistle • Commercial Hub' });

    await channel.send({ embeds: [embed], files: [attachment] });
    await new Promise(r => setTimeout(r, 800));
  }

  console.log('All 4 advert GIFs successfully posted to Discord!');
  process.exit(0);
});

client.login(process.env.DISCORD_TOKEN);
