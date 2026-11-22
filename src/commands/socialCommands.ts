import { Message, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, AttachmentBuilder, TextChannel, Guild } from 'discord.js';
import path from 'path';
import fs from 'fs';
import { executeSponsorAdvert, executeCoaching, executeMeetGreet } from '../engines/socialEngine.js';
import { prisma } from '../database/prisma.js';
import { formatK, getNationFlag } from '../utils/formatHelper.js';
import { SPONSORS } from '../config/constants.js';
import { getEmoji } from '../utils/emojiHelper.js';

export function buildAdvertSelectionMenu(followers: bigint, guild?: Guild | null) {
  const coin = getEmoji(guild, 'coin');
  const stamina = getEmoji(guild, 'stamina');
  const tick = getEmoji(guild, 'zztick');
  const lines = SPONSORS.map(s => {
    const eligible = followers >= s.minFollowers ? tick : '🔒';
    const followerText = s.followerDelta > 0n ? `+${formatK(s.followerDelta)}` : s.followerDelta < 0n ? `${formatK(s.followerDelta)}` : '0';
    return `${eligible} **${s.emoji} ${s.name}** (\`-advert ${s.key}\`)\n` +
      `• Min Followers: \`${formatK(s.minFollowers)} 👤\` | Stamina Cost: \`${s.staminaCost}\` ${stamina}\n` +
      `• Reward: \`+${formatK(s.rewardCoins)}\` ${coin} | Followers: \`${followerText} 👤\``;
  });

  const embed = new EmbedBuilder()
    .setColor('#f59e0b')
    .setTitle('📸 Commercial Brand Sponsorship Deals')
    .setDescription(
      `Choose a brand partner matching your follower status:\n\n${lines.join('\n\n')}\n\n` +
      `*Click a button below or run \`-advert <brand>\`*`
    )
    .setFooter({ text: 'Beyond The Final Whistle • Commercial Hub' });

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId('sponsor_heineken').setLabel('Heineken (100k 👤)').setEmoji('🍺').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('sponsor_adidas').setLabel('Adidas (1M 👤)').setEmoji('👟').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('sponsor_cocacola').setLabel('Coca-Cola (5M 👤)').setEmoji('🥤').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId('sponsor_netflix').setLabel('Netflix (6M 👤)').setEmoji('🎬').setStyle(ButtonStyle.Success)
  );

  return { embed, components: [row] };
}

export async function handleAdvertCommand(message: Message, args: string[]) {
  const sponsorKey = args[0];

  if (!sponsorKey) {
    const player = await prisma.player.findUnique({ where: { id: message.author.id } });
    const followers = player ? player.followers : 0n;
    const menu = buildAdvertSelectionMenu(followers, message.guild);
    return await message.reply({ embeds: [menu.embed], components: menu.components });
  }

  const result = await executeSponsorAdvert(message.author.id, sponsorKey);
  if (result.embed) {
    await message.reply({ embeds: [result.embed], files: result.files || [] });
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

/**
 * Handles -tweet <message> and -chirp <message>
 * Matches WITS: Screenshot 2026-11-21 155242.png and 155353.png
 */
export async function handleChirpCommand(message: Message, args: string[]) {
  const tweetText = args.join(' ').trim();
  if (!tweetText) {
    return await message.reply('❌ Please write what you want to tweet! Example: `-tweet nothing to do i m fixing some bugs in my own bot`');
  }

  const player = await prisma.player.findUnique({
    where: { id: message.author.id },
    include: { nation: true }
  });

  if (!player) {
    return await message.reply('❌ Register with `-profile` before tweeting.');
  }

  // 1. Reply to the author: "Successfully Sent Tweet!"
  await message.reply('Successfully Sent Tweet!');

  // 2. Find target twitter channel
  const guild = message.guild;
  let targetChannel: TextChannel = message.channel as TextChannel;
  if (guild) {
    const twitterChan = guild.channels.cache.find(
      c => c.isTextBased() && (c.name.toLowerCase().includes('twitter') || c.name.toLowerCase().includes('twitt'))
    ) as TextChannel | undefined;
    if (twitterChan) {
      targetChannel = twitterChan;
    }
  }

  const flag = getNationFlag(player.nation);
  const formattedFollowers = formatK(player.followers);

  // 3. Build authentic WITS Tweet embed
  const embed = new EmbedBuilder()
    .setColor('#1d9bf0')
    .setTitle(`${player.username} ${flag} Tweeted!`)
    .setDescription(`His/Her Tweet :\n"${tweetText}"`)
    .addFields(
      { name: `Followers 👤 : ${formattedFollowers}`, value: '0 🗨️  0 🔁', inline: false }
    )
    .setFooter({ text: 'WITS TwitFeed • Fan Engagement Network' });

  const files: AttachmentBuilder[] = [];
  const twitterImgPath = path.resolve(process.cwd(), 'assets/twitter.png');
  if (fs.existsSync(twitterImgPath)) {
    files.push(new AttachmentBuilder(twitterImgPath, { name: 'twitter.png' }));
    embed.setThumbnail('attachment://twitter.png');
  }

  // Temporary create DB record to obtain tweet ID for button callbacks
  const tweetRecord = await prisma.playerTweet.create({
    data: {
      authorId: message.author.id,
      content: tweetText
    }
  });

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`tweet_like_${tweetRecord.id}`)
      .setEmoji('👍')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`tweet_dislike_${tweetRecord.id}`)
      .setEmoji('👎')
      .setStyle(ButtonStyle.Danger)
  );

  const sentMessage = await targetChannel.send({
    embeds: [embed],
    components: [row],
    files
  });

  await prisma.playerTweet.update({
    where: { id: tweetRecord.id },
    data: { discordMessageId: sentMessage.id }
  });
}
