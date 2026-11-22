import { Message, EmbedBuilder } from 'discord.js';
import { executeSponsorAdvert, executeCoaching, executeMeetGreet } from '../engines/socialEngine.js';
import { prisma } from '../database/prisma.js';

export async function handleAdvertCommand(message: Message, args: string[]) {
  const sponsorKey = args[0];
  const result = await executeSponsorAdvert(message.author.id, sponsorKey);
  if (result.embed) {
    await message.reply({ embeds: [result.embed] });
  } else {
    await message.reply(result.message);
  }
}

export async function handleCoachingCommand(message: Message) {
  const result = await executeCoaching(message.author.id);
  await message.reply(result.message);
}

export async function handleMeetGreetCommand(message: Message) {
  const result = await executeMeetGreet(message.author.id);
  await message.reply(result.message);
}

export async function handleChirpCommand(message: Message, args: string[]) {
  const tweetText = args.join(' ').trim();
  if (!tweetText) {
    return await message.reply('❌ Please write what you want to tweet! Example: `-chirp Matchday ready! Let\'s secure the 3 points! ⚽🔥`');
  }

  const player = await prisma.player.findUnique({ where: { id: message.author.id } });
  if (!player) {
    return await message.reply('❌ Register with `-profile` before tweeting.');
  }

  const embed = new EmbedBuilder()
    .setColor('#1d9bf0')
    .setAuthor({ name: `${player.username} (@${player.username})`, iconURL: message.author.displayAvatarURL() })
    .setDescription(`${tweetText}\n\n━━━━━━━━━━━━━━━━━━━━\n👍 *React to Like (+100k followers)* | 👎 *React to Dislike (-50k followers)*`)
    .setFooter({ text: 'WITS TwitFeed • Fan Engagement Network' })
    .setTimestamp();

  const sentMessage = await (message.channel as any).send({ embeds: [embed] });
  await sentMessage.react('👍').catch(() => {});
  await sentMessage.react('👎').catch(() => {});

  await prisma.playerTweet.create({
    data: {
      discordMessageId: sentMessage.id,
      authorId: message.author.id,
      content: tweetText
    }
  });

  if (message.deletable) {
    await message.delete().catch(() => {});
  }
}
