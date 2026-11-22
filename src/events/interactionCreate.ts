import { Interaction, ButtonInteraction, TextChannel } from 'discord.js';
import { executeTraining } from '../engines/trainingEngine.js';
import { buildTrainingSuccessEmbed } from '../commands/trainingCommands.js';
import { executeSponsorAdvert } from '../engines/socialEngine.js';
import { prisma } from '../database/prisma.js';
import { buildProfileEmbed, buildProfileTabsRow } from '../commands/playerCommands.js';
import { formatK, getNationFlag } from '../utils/formatHelper.js';
import { logger } from '../utils/logger.js';

// Cache for tracking which users voted on which tweets to prevent double-voting
const tweetVotersCache = new Map<string, Set<string>>();

export async function onInteractionCreate(interaction: Interaction) {
  if (!interaction.isButton()) return;

  try {
    const customId = interaction.customId;

    // 1. Training Drills: train_normal, train_vip, train_noeffort
    if (customId.startsWith('train_')) {
      const type = customId.replace('train_', '') as 'normal' | 'vip' | 'noeffort';
      const result = await executeTraining(interaction.user.id, type);

      if (!result.success) {
        return await interaction.reply({
          content: result.error || result.message || '❌ Training failed.',
          ephemeral: true
        });
      }

      const output = buildTrainingSuccessEmbed(result, interaction.user);
      return await interaction.reply({ embeds: [output.embed], files: output.files });
    }

    // 2. Tweet Engagements: tweet_like_<id>, tweet_dislike_<id>
    if (customId.startsWith('tweet_like_') || customId.startsWith('tweet_dislike_')) {
      const isLike = customId.startsWith('tweet_like_');
      const tweetId = isLike ? customId.replace('tweet_like_', '') : customId.replace('tweet_dislike_', '');

      const tweet = await prisma.playerTweet.findUnique({
        where: { id: tweetId },
        include: { author: { include: { nation: true } } }
      });

      if (!tweet) {
        return await interaction.reply({ content: '❌ Tweet not found.', ephemeral: true });
      }

      if (tweet.authorId === interaction.user.id) {
        return await interaction.reply({ content: '❌ You cannot vote on your own tweet!', ephemeral: true });
      }

      let voters = tweetVotersCache.get(tweet.id);
      if (!voters) {
        voters = new Set<string>();
        tweetVotersCache.set(tweet.id, voters);
      }

      if (voters.has(interaction.user.id)) {
        return await interaction.reply({ content: '❌ You have already voted on this tweet!', ephemeral: true });
      }

      voters.add(interaction.user.id);

      const followerDelta = isLike ? 100000n : -50000n;
      const updatedAuthor = await prisma.player.update({
        where: { id: tweet.authorId },
        data: {
          followers: {
            increment: followerDelta
          }
        },
        include: { nation: true }
      });

      const updatedTweet = await prisma.playerTweet.update({
        where: { id: tweet.id },
        data: {
          likes: isLike ? { increment: 1 } : undefined,
          dislikes: !isLike ? { increment: 1 } : undefined
        }
      });

      // Send DMs matching WITS: bot-dm-texts.txt
      try {
        if (isLike) {
          await interaction.user.send('You have successfully liked the tweet!').catch(() => {});
          const authorUser = await interaction.client.users.fetch(tweet.authorId).catch(() => null);
          if (authorUser) {
            await authorUser.send('Someone liked your post! You gained another 100k followers!').catch(() => {});
          }
        } else {
          await interaction.user.send('You have successfully disliked the tweet!').catch(() => {});
          const authorUser = await interaction.client.users.fetch(tweet.authorId).catch(() => null);
          if (authorUser) {
            await authorUser.send('Someone disliked your post! You lost 50k followers!').catch(() => {});
          }
        }
      } catch {}

      // Update the embed on the tweet message
      const flag = getNationFlag(updatedAuthor.nation);
      const newFollowersStr = formatK(updatedAuthor.followers);

      const existingEmbed = interaction.message.embeds[0];
      if (existingEmbed) {
        const newEmbed = existingEmbed.toJSON();
        newEmbed.title = `${updatedAuthor.username} ${flag} Tweeted!`;
        newEmbed.fields = [
          { name: `Followers 👤 : ${newFollowersStr}`, value: `${updatedTweet.likes} 👍  ${updatedTweet.dislikes} 👎`, inline: false }
        ];

        await interaction.message.edit({ embeds: [newEmbed] }).catch(() => {});
      }

      return await interaction.reply({
        content: isLike ? 'You have successfully liked the tweet!' : 'You have successfully disliked the tweet!',
        ephemeral: true
      });
    }

    // 3. Profile Tabs: profile_main_<userId>, profile_stats_<userId>, profile_attr_<userId>
    if (customId.startsWith('profile_')) {
      const parts = customId.split('_'); // ['profile', 'main' | 'stats' | 'attr', userId]
      const tab = parts[1] as 'main' | 'stats' | 'attr';
      const targetUserId = parts[2];

      const player = await prisma.player.findUnique({
        where: { id: targetUserId },
        include: { vehicles: true, nation: true, club: true, inventory: true }
      });

      if (!player) {
        return await interaction.reply({ content: '❌ Profile not found.', ephemeral: true });
      }

      const targetUser = await interaction.client.users.fetch(targetUserId).catch(() => interaction.user);
      const embed = buildProfileEmbed(player, targetUser, tab);
      const row = buildProfileTabsRow(targetUserId, tab);

      return await interaction.update({ embeds: [embed], components: [row] });
    }

    // 4. Commercial Sponsor Endorsements: sponsor_heineken, sponsor_adidas, etc.
    if (customId.startsWith('sponsor_')) {
      const sponsorKey = customId.replace('sponsor_', '');
      const result = await executeSponsorAdvert(interaction.user.id, sponsorKey);

      if (!result.success) {
        return await interaction.reply({ content: result.message, ephemeral: true });
      }

      if (result.embed) {
        return await interaction.reply({ embeds: [result.embed], files: result.files || [] });
      }

      return await interaction.reply({ content: result.message });
    }
  } catch (error) {
    logger.error({ error }, 'Error in onInteractionCreate button handler');
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({ content: '❌ An error occurred processing this action.', ephemeral: true }).catch(() => {});
    }
  }
}
