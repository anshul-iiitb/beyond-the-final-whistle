import { Message, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, AttachmentBuilder, TextChannel, Guild } from 'discord.js';
import path from 'path';
import fs from 'fs';
import { executeSponsorAdvert, executeCoaching, executeMeetGreet } from '../engines/socialEngine.js';
import { prisma } from '../database/prisma.js';
import { formatK, getNationFlag } from '../utils/formatHelper.js';
import { SPONSORS } from '../config/constants.js';
import { getEmoji } from '../utils/emojiHelper.js';
import { THEME_COLORS, UI, subtext } from '../utils/themeHelper.js';

export function buildAdvertSelectionMenu(followers: bigint, isVip = false, guild?: Guild | null) {
  const coin = getEmoji(guild, 'coin');
  const stamina = getEmoji(guild, 'stamina');
  const tick = getEmoji(guild, 'zztick');
  const followersEmoji = getEmoji(guild, 'followers');

  const heinekenEmoji = getEmoji(guild, 'heineken');
  const adidasEmoji = getEmoji(guild, 'adidas');
  const cocacolaEmoji = getEmoji(guild, 'cocacola');
  const netflixEmoji = getEmoji(guild, 'netflix');
  const nikeEmoji = getEmoji(guild, 'nike');

  const lines = SPONSORS.map(s => {
    const eligible = followers >= s.minFollowers && (!s.vipOnly || isVip) ? tick : '🔒';
    const followerText = s.followerDelta > 0n ? `+${formatK(s.followerDelta)}` : s.followerDelta < 0n ? `${formatK(s.followerDelta)}` : '0';
    const sponsorBadge = s.vipOnly ? '👑' : getEmoji(guild, s.key);
    const vipTag = s.vipOnly ? ' • 👑 VIP ONLY' : '';
    return `${eligible} ${sponsorBadge} **${s.name.toUpperCase()}** \`[ alias: ${s.key}${vipTag} ]\`\n` +
      `• **Min Fans:** \`${formatK(s.minFollowers)}\` ${followersEmoji}   •   **Stamina:** \`${s.staminaCost}\` ${stamina}\n` +
      `• **Payout:** \`+${formatK(s.rewardCoins)}\` ${coin}   •   **Fan Delta:** \`${followerText}\` ${followersEmoji}`;
  });

  const VIP_AD_GIF = 'https://images-ext-1.discordapp.net/external/WbUdmHYz0aJoSn0OIHn7HlCzc9I9OKdCUO1DZ1_9wn4/https/static.klipy.com/ii/2711dd8a75a85be822d136ec94899b3f/3b/5d/lgwAfIbEGD9B.mp4';

  const embed = new EmbedBuilder()
    .setColor(THEME_COLORS.PURPLE)
    .setTitle('📸 Commercial Brand Endorsements — Photoshoot Hall')
    .setDescription(
      [
        'Sign lucrative brand deals with global sponsors to earn massive coin payouts and build social reach!',
        ...lines,
        `${UI.DIVIDER}\n` +
        subtext('💡 Click a brand button below to sign an endorsement contract and produce campaign media.')
      ].join(UI.SPACER)
    )
    .setImage(VIP_AD_GIF)
    .setFooter({ text: 'Beyond The Final Whistle • Commercial Endorsement Hub' })
    .setTimestamp();

  const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId('sponsor_heineken').setLabel('Heineken (100k)').setEmoji(heinekenEmoji).setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('sponsor_adidas').setLabel('Adidas (1M)').setEmoji(adidasEmoji).setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('sponsor_cocacola').setLabel('Coca-Cola (5M)').setEmoji(cocacolaEmoji).setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId('sponsor_netflix').setLabel('Netflix (6M)').setEmoji(netflixEmoji).setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('sponsor_nike').setLabel('Nike (8M)').setEmoji(nikeEmoji).setStyle(ButtonStyle.Primary)
  );

  const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId('sponsor_vip').setLabel('VIP Signature (1M Fans -> 300k)').setEmoji('👑').setStyle(ButtonStyle.Success)
  );

  return { embed, components: [row1, row2] };
}

export async function handleAdvertCommand(message: Message, args: string[]) {
  const sponsorKey = args[0];

  if (!sponsorKey) {
    const player = await prisma.player.findUnique({ where: { id: message.author.id } });
    const followers = player ? player.followers : 0n;
    const isVip = (player?.vipTier ?? 0) >= 1;
    const menu = buildAdvertSelectionMenu(followers, isVip, message.guild);
    return await message.reply({ embeds: [menu.embed], components: menu.components });
  }

  const result = await executeSponsorAdvert(message.author.id, sponsorKey, message.guild);
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
 */
export async function handleChirpCommand(message: Message, args: string[]) {
  const tweetText = args.join(' ').trim();
  if (!tweetText) {
    return await message.reply('❌ Please write what you want to tweet! Example: `-tweet fixing some tactical drills before matchday`');
  }

  const player = await prisma.player.findUnique({
    where: { id: message.author.id },
    include: { nation: true }
  });

  if (!player) {
    return await message.reply('❌ Register with `-profile` before tweeting.');
  }

  const flag = getNationFlag(player.nation);
  const followersEmoji = getEmoji(message.guild, 'followers');

  const tweet = await prisma.playerTweet.create({
    data: {
      authorId: player.id,
      content: tweetText
    }
  });

  const embed = new EmbedBuilder()
    .setColor(THEME_COLORS.PRIMARY)
    .setAuthor({
      name: `${player.username} ${flag} (@${player.username.toLowerCase()})`,
      iconURL: message.author.displayAvatarURL()
    })
    .setDescription(
      `"${tweetText}"\n\n` +
      `${UI.SUB_DIVIDER}\n` +
      `👥 **Followers:** \`${formatK(player.followers)}\` ${followersEmoji} • 💬 **TwitFeed Post** *(+100k 👍 / -50k 👎 fans • Voters get +5k 🪙)*`
    )
    .addFields({
      name: `Followers 👤 : ${formatK(player.followers)}`,
      value: '0 👍  0 👎',
      inline: false
    })
    .setFooter({ text: 'Beyond The Final Whistle • Social Network' })
    .setTimestamp();

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`tweet_like_${tweet.id}`)
      .setLabel('Like (+100k)')
      .setEmoji('👍')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`tweet_dislike_${tweet.id}`)
      .setLabel('Dislike (-50k)')
      .setEmoji('👎')
      .setStyle(ButtonStyle.Danger)
  );

  const sentMsg = await message.reply({ embeds: [embed], components: [row] });
  await prisma.playerTweet.update({
    where: { id: tweet.id },
    data: { discordMessageId: sentMsg.id }
  }).catch(() => {});
}
