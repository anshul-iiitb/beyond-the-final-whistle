import 'dotenv/config';
import { Client, GatewayIntentBits, EmbedBuilder } from 'discord.js';

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildEmojisAndStickers]
});

client.on('ready', async () => {
  console.log('Online as', client.user.tag);
  const guild = client.guilds.cache.get('1574068651915743272');
  const channel = guild.channels.cache.get('1574068652687499296');

  const coinEmoji = '<:coin:1574133021601177641>';
  const worldcupEmoji = '<:worldcup:1574136906508271828>';

  // 1. Showcase new Trophy
  const trophyEmbed = new EmbedBuilder()
    .setColor('#f1c40f')
    .setTitle('🏆 New FIFA World Cup Trophy Emoji Updated!')
    .setDescription(
      `### Authentic World Cup Cutout Active\n\n` +
      `**Display:** ${worldcupEmoji} **FIFA World Cup Trophy**\n` +
      `**Application Emoji:** \`<:worldcup:1574136906508271828>\`\n` +
      `Replaced the old trophy with the crisp 128x128 transparent cutout.`
    );

  await channel.send({ embeds: [trophyEmbed] });

  // 2. Showcase Vehicle Showroom
  const cars = [
    { key: 'basic', name: 'Basic Car', cost: '700k', cooldown: 16, emoji: '🚗' },
    { key: 'honda', name: 'Honda Civic', cost: '1M', cooldown: 14, emoji: '<:hcfront:1574138692295987373><:hcback:1574138697283141734>' },
    { key: 'toyota', name: 'Toyota Supra', cost: '3M', cooldown: 10, emoji: '<:tsfront:1574138702702186717><:tsback:1574138708024754308>' },
    { key: 'porsche', name: 'Porsche 911', cost: '5.35M', cooldown: 7, emoji: '<:p911front:1574138713049403577><:p911back:1574138717931708539>' },
    { key: 'nissan', name: 'Nissan GTR', cost: '6.75M', cooldown: 4, emoji: '<:ngtrfront:1574138723589955664><:ngtrback:1574138728644087951>' },
    { key: 'audi', name: 'Audi R8', cost: '6.75M', cooldown: 4, emoji: '<:ar8front:1574138734033633343><:ar8back:1574138739721240606>' },
    { key: 'lamborghini', name: 'Lamborghini Huracan', cost: '8.4M', cooldown: 3, emoji: '<:lhfront:1574138744653611018><:lhback:1574138749577728222>' },
    { key: 'rollsroyce', name: 'Rolls Royce Ghost', cost: '10.25M', cooldown: 2, emoji: '<:rrgfront:1574138754514296833><:rrgback:1574138759711035653>' },
    { key: 'ferrari', name: 'Ferrari La Ferrari', cost: '17.7M', cooldown: 1, emoji: '<:ffront:1574138764668706918><:fback:1574138769706328134>' },
    { key: 'bugatti', name: 'Bugatti Chiron', cost: '20.5M', cooldown: 1, emoji: '<:bcfront:1574138775083155539><:bcback:1574138781710295060>' }
  ];

  const lines = cars.map(v => {
    return `${v.emoji} **${v.name}**\n` +
      `• Alias : ${v.key}\n` +
      `• Item info : Decreases travelling cooldown to ${v.cooldown} minutes.\n` +
      `• Price : ${v.cost} ${coinEmoji}`;
  });

  const showroomEmbed = new EmbedBuilder()
    .setColor('#2b2d31')
    .setTitle('Vehicle Showroom!')
    .setDescription(
      '```\nUse -vehiclebuy <alias> to buy a vehicle\n```\n' +
      lines.join('\n\n')
    )
    .setFooter({ text: 'Current Ride: Public Transit / Walking (20m cooldown) • Beyond The Final Whistle' });

  await channel.send({ embeds: [showroomEmbed] });
  console.log('Sent trophy and vehicle showroom showcase messages to #general!');
  process.exit(0);
});

client.login(process.env.DISCORD_TOKEN);
