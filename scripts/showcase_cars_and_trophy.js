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
    { key: 'honda', name: 'Honda Civic', cost: '1M', cooldown: 14, emoji: '<:hcfront:1574145982218637443><:hcback:1574145991353966643>' },
    { key: 'toyota', name: 'Toyota Supra', cost: '3M', cooldown: 10, emoji: '<:tsfront:1574146000724033697><:tsback:1574146010345775265>' },
    { key: 'porsche', name: 'Porsche 911', cost: '5.35M', cooldown: 7, emoji: '<:p911front:1574146019740885033><:p911back:1574146028884463857>' },
    { key: 'nissan', name: 'Nissan GTR', cost: '6.75M', cooldown: 4, emoji: '<:ngtrfront:1574146038296617141><:ngtrback:1574146047499047014>' },
    { key: 'audi', name: 'Audi R8', cost: '6.75M', cooldown: 4, emoji: '<:ar8front:1574146057233760256><:ar8back:1574146066180345996>' },
    { key: 'lamborghini', name: 'Lamborghini Huracan', cost: '8.4M', cooldown: 3, emoji: '<:lhfront:1574146075101499583><:lhback:1574146085767876669>' },
    { key: 'rollsroyce', name: 'Rolls Royce Ghost', cost: '10.25M', cooldown: 2, emoji: '<:rrgfront:1574146094797955122><:rrgback:1574146104113496237>' },
    { key: 'ferrari', name: 'Ferrari La Ferrari', cost: '17.7M', cooldown: 1, emoji: '<:ffront:1574146113232179303><:fback:1574146122472095798>' },
    { key: 'bugatti', name: 'Bugatti Chiron', cost: '20.5M', cooldown: 1, emoji: '<:bcfront:1574146131578060930><:bcback:1574146142613012530>' }
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
