import 'dotenv/config';
import { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, AttachmentBuilder } from 'discord.js';
import path from 'path';
import fs from 'fs';

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildEmojisAndStickers]
});

client.on('ready', async () => {
  console.log('Showcase runner online as', client.user.tag);
  const guild = client.guilds.cache.get('1574068651915743272');
  if (!guild) {
    console.error('Guild not found');
    process.exit(1);
  }

  const channel = guild.channels.cache.get('1574068652687499296') || guild.channels.cache.find(c => c.isTextBased());
  if (!channel) {
    console.error('Text channel not found');
    process.exit(1);
  }

  console.log('Posting showcase to channel:', channel.name);

  const getE = (name) => {
    const e = guild.emojis.cache.find(x => x.name.toLowerCase() === name.toLowerCase());
    return e ? e.toString() : '⚽';
  };

  const coin = getE('coin');
  const stamina = getE('stamina');
  const tp = getE('tp');
  const worldcup = getE('worldcup');
  const strika = getE('strika');
  const passa = getE('passa');
  const bully = getE('bully');
  const sd = getE('sd');
  const motm = getE('motm');
  const goldenboot = getE('goldenboot');
  const goldmedal = getE('goldmedal');
  const tick = getE('zztick');

  // Header Announcement
  await channel.send({
    content: '## 🌟 Beyond The Final Whistle (BTFW) — Live Command & Emoji Showcase\n' +
      'Here is the complete demonstration of every core command and its authentic visual embed, powered by the newly generated high-definition FIFA football emojis!'
  });

  // 1. Profile Command Result
  const profileEmbed = new EmbedBuilder()
    .setColor('#2b2d31')
    .setTitle('⚽ Anshul 🇮🇳 Career Profile ⭐ [VIP]')
    .setDescription(
      '*Rookie footballer aiming for the World Cup with Beyond The Final Whistle.*\n\n' +
      '📍 **Location:** 🏋️ **Training Center**\n' +
      `${stamina} **Stamina:** \`85/100\` | ${tp} **Training Points:** \`14 TP\`\n` +
      `${coin} **Net Worth:** \`750k\` | 👥 **Followers:** \`1,250k 👤\`\n` +
      `👟 Boots: \`STRIKA\` ${strika} | 🛰️ Intel: \`+4 PAC\``
    )
    .addFields(
      {
        name: '📊 Overall Ratings',
        value: '🅰️ **ATK:** `82` | 🏃 **MID:** `76` | 🛡️ **DEF:** `64`',
        inline: false
      },
      {
        name: '🎭 Playstyle: ⚡ Speedster (ATT)',
        value: '*Explosive counter-attack runner who incinerates high backlines with blistering pace.*\n**Key Stats:** `PAC`, `DRI`, `POW`',
        inline: false
      },
      {
        name: '🛡️ Teams & Nation',
        value: '• National Team: **India** 🇮🇳\n• Club: **Royal Bengal FC**',
        inline: true
      },
      {
        name: '📈 Recent Form (Last 5)',
        value: '`7.8  •  8.2  •  7.5  •  8.6  •  8.0`',
        inline: true
      },
      {
        name: '🎁 Collectables & Garage',
        value: `${worldcup} World Cup Trophy • ${goldenboot} Golden Boot • ${goldmedal} Asian Cup Gold • 🏎️ Toyota Supra`,
        inline: false
      }
    )
    .setThumbnail(client.user.displayAvatarURL())
    .setFooter({ text: 'WITS • Career Player Profile • Tab 1/3' });

  const profileRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('profile_main_demo').setLabel('Main Profile').setEmoji('👤').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('profile_stats_demo').setLabel('Detailed Stats').setEmoji('📊').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('profile_attr_demo').setLabel('Attributes').setEmoji('🎯').setStyle(ButtonStyle.Secondary)
  );

  await channel.send({ content: '### 1️⃣ `-profile` Command Result:', embeds: [profileEmbed], components: [profileRow] });

  // 2. Training Menu & Drill Results
  const trainMenuEmbed = new EmbedBuilder()
    .setColor('#1e1f22')
    .setTitle('Choose Training Method!')
    .setThumbnail(client.user.displayAvatarURL())
    .setDescription(
      'Choose a training method from below to train!\n\n' +
      `• *Normal Training* - Gives 1 to 2 ${tp} every 30 minutes *(scales depending on OVR)*\n\n` +
      `• *VIP Training* - Gives 6 ${tp} every 6 hours\n\n` +
      `• *No Effort Training* - Gives 20 ${tp} every matchday *(blocks other methods until next match)*`
    )
    .setFooter({ text: 'November 22, 2026' });

  const trainMenuRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('train_normal').setLabel('Normal Training').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('train_vip').setLabel('VIP Training').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('train_noeffort').setLabel('No Effort Training').setStyle(ButtonStyle.Danger)
  );

  const trainingImgPath = path.resolve('assets/training.png');
  const trainFiles = fs.existsSync(trainingImgPath) ? [new AttachmentBuilder(trainingImgPath, { name: 'training.png' })] : [];

  const trainSuccessEmbed = new EmbedBuilder()
    .setColor('#1e1f22')
    .setTitle('Anshul 🇮🇳 trained!')
    .setDescription(
      `You gained 2 ${tp} Training points!\n\n` +
      'You can train again in 30 minutes.\n\n' +
      '**New Stats!**\n' +
      `Stamina : 75 ${stamina}\n` +
      `Training points : 16 ${tp}`
    )
    .setImage('attachment://training.png')
    .setFooter({ text: 'Note : If your stamina goes below 50 there is high chance that you may catch injury during match.' });

  await channel.send({ content: '### 2️⃣ `-train` Command Result (Menu + Drill Execution):', embeds: [trainMenuEmbed], components: [trainMenuRow] });
  await channel.send({ embeds: [trainSuccessEmbed], files: trainFiles });

  // 3. Twitter / Twitfeed Command Result
  const twitterImgPath = path.resolve('assets/twitter.png');
  const twitterFiles = fs.existsSync(twitterImgPath) ? [new AttachmentBuilder(twitterImgPath, { name: 'twitter.png' })] : [];

  const tweetEmbed = new EmbedBuilder()
    .setColor('#1d9bf0')
    .setTitle('Anshul 🇮🇳 Tweeted!')
    .setDescription('Back in training at the pitch! Working hard on finishing drills with the team today. ⚽🔥')
    .addFields({
      name: 'Followers 👤 : 1250k',
      value: `14 👍   1 👎`,
      inline: false
    })
    .setThumbnail('attachment://twitter.png')
    .setFooter({ text: 'Twitfeed • Official Player Network' });

  const tweetRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('demo_like').setEmoji('👍').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('demo_dislike').setEmoji('👎').setStyle(ButtonStyle.Secondary)
  );

  await channel.send({ content: '### 3️⃣ `-tweet` Command Result:', embeds: [tweetEmbed], components: [tweetRow], files: twitterFiles });

  // 4. Global Market Catalog Command Result
  const marketEmbed = new EmbedBuilder()
    .setColor('#10b981')
    .setTitle('🛍️ Global Market Catalog & Equipment')
    .setDescription(
      `Welcome to the Global Market! Purchase boots, potions, and gear with your match earnings:\n\n` +
      `• \`-buy sd\` — **${sd} Sports Drink** (+50 Stamina) | **100k ${coin}**\n` +
      `• \`-buy strika\` — **${strika} Strika Boots** (+10 Attack for next match) | **500k ${coin}**\n` +
      `• \`-buy passa\` — **${passa} Passa Boots** (+10 Midfield for next match) | **500k ${coin}**\n` +
      `• \`-buy bully\` — **${bully} Bully Boots** (+10 Defence for next match) | **500k ${coin}**\n\n` +
      `*Travel here using \`-travel gm\` to purchase equipment.*`
    )
    .setFooter({ text: 'Beyond The Final Whistle • Global Market' });

  await channel.send({ content: '### 4️⃣ `-buy` / Global Market Catalog Result:', embeds: [marketEmbed] });

  // 5. Commercial Sponsorships Command Result
  const photoImgPath = path.resolve('assets/photoshoot.png');
  const photoFiles = fs.existsSync(photoImgPath) ? [new AttachmentBuilder(photoImgPath, { name: 'photoshoot.png' })] : [];

  const advertEmbed = new EmbedBuilder()
    .setColor('#f59e0b')
    .setTitle('📸 Commercial Brand Sponsorship Deals')
    .setDescription(
      `Choose a brand partner matching your follower status:\n\n` +
      `${tick} **🍺 Heineken** (\`-advert heineken\`)\n• Min Followers: \`100k 👤\` | Stamina Cost: \`5\` ${stamina}\n• Reward: \`+100k\` ${coin} | Followers: \`-50k 👤\`\n\n` +
      `${tick} **👟 Adidas** (\`-advert adidas\`)\n• Min Followers: \`1,000k 👤\` | Stamina Cost: \`10\` ${stamina}\n• Reward: \`+200k\` ${coin} | Followers: \`0 👤\`\n\n` +
      `🔒 **🥤 Coca-Cola** (\`-advert cocacola\`)\n• Min Followers: \`5,000k 👤\` | Stamina Cost: \`10\` ${stamina}\n• Reward: \`+300k\` ${coin} | Followers: \`-200k 👤\`\n\n` +
      `🔒 **🎬 Netflix** (\`-advert netflix\`)\n• Min Followers: \`6,000k 👤\` | Stamina Cost: \`30\` ${stamina}\n• Reward: \`+300k\` ${coin} | Followers: \`+50k 👤\`\n\n` +
      `*Click a button below to sign an endorsement contract:*`
    )
    .setImage('attachment://photoshoot.png')
    .setFooter({ text: 'Beyond The Final Whistle • Commercial Hub' });

  const advertRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('sponsor_heineken').setLabel('Heineken (100k 👤)').setEmoji('🍺').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('sponsor_adidas').setLabel('Adidas (1M 👤)').setEmoji('👟').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('sponsor_cocacola').setLabel('Coca-Cola (5M 👤)').setEmoji('🥤').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId('sponsor_netflix').setLabel('Netflix (6M 👤)').setEmoji('🎬').setStyle(ButtonStyle.Success)
  );

  await channel.send({ content: '### 5️⃣ `-advert` Sponsorship Endorsements Result:', embeds: [advertEmbed], components: [advertRow], files: photoFiles });

  // 6. Match Telemetry & Newspaper Command Result
  const matchImgPath = path.resolve('assets/match_news.png');
  const matchFiles = fs.existsSync(matchImgPath) ? [new AttachmentBuilder(matchImgPath, { name: 'match_news.png' })] : [];

  const matchEmbed = new EmbedBuilder()
    .setColor('#e11d48')
    .setTitle('📰 MATCHDAY SPECIAL: India 3 - 1 England')
    .setDescription(
      '**A stunning masterclass on the pitch!**\n\n' +
      `⚽ **Goals:** Anshul 24\', 68\', Chhetri 81\' | Kane 52\'\n` +
      `👑 **Man of the Match (${motm}):** **Anshul** (Rating: \`9.4\`)\n\n` +
      '**Match Statistics:**\n' +
      '• Possession: **54% - 46%**\n' +
      '• Shots (On Target): **14 (8) - 9 (4)**\n' +
      '• Tackles Won: **18 - 12**\n' +
      '• Key Passes: **11 - 6**'
    )
    .setImage('attachment://match_news.png')
    .setFooter({ text: 'Beyond The Final Whistle • World Cup Group Stage' });

  await channel.send({ content: '### 6️⃣ `-match` Live Telemetry & Newspaper Result:', embeds: [matchEmbed], files: matchFiles });

  // 7. Leaderboards Command Result
  const lbEmbed = new EmbedBuilder()
    .setColor('#eab308')
    .setTitle(`🏆 World Career Leaderboards`)
    .setDescription(
      `**${coin} Net Worth & Wealth Top 5:**\n` +
      `1. **Anshul** 🇮🇳 — **750k** ${coin}\n` +
      `2. **Kolzairr** 🇵🇹 — **500k** ${coin}\n` +
      `3. **Krazymatrix** 🇵🇹 — **350k** ${coin}\n` +
      `4. **Goku69** 🤍 — **300k** ${coin}\n` +
      `5. **Ikuexe** 🇫🇷 — **200k** ${coin}\n\n` +
      `**⚽ Top Goalscorers:**\n` +
      `1. **Anshul** 🇮🇳 — **18 goals** ⚽ (${goldenboot})\n` +
      `2. **Archer** 🇳🇴 — **14 goals** ⚽\n` +
      `3. **Jayan** 🇧🇷 — **11 goals** ⚽`
    )
    .setFooter({ text: 'Beyond The Final Whistle • Global Rankings' });

  await channel.send({ content: '### 7️⃣ `-lb` Leaderboards Result:', embeds: [lbEmbed] });

  console.log('All command results successfully posted to Discord!');
  process.exit(0);
});

client.login(process.env.DISCORD_TOKEN);
