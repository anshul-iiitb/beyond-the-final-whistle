import { MessageReaction, User } from 'discord.js';
import { prisma } from '../database/prisma.js';
import { logger } from '../utils/logger.js';

export async function onMessageReactionAdd(reaction: MessageReaction, user: User) {
  if (user.bot) return;

  try {
    if (reaction.partial) {
      try {
        await reaction.fetch();
      } catch {
        return;
      }
    }

    const tweet = await prisma.playerTweet.findFirst({
      where: { discordMessageId: reaction.message.id },
      include: { author: true }
    });

    if (!tweet) return;

    const emojiName = reaction.emoji.name;
    if (emojiName === '👍') {
      // Like: +100k followers
      const updated = await prisma.player.update({
        where: { id: tweet.authorId },
        data: { followers: { increment: 100000n } }
      });

      await prisma.playerTweet.update({
        where: { id: tweet.id },
        data: { likes: { increment: 1 } }
      });

      const authorUser = await reaction.client.users.fetch(tweet.authorId).catch(() => null);
      if (authorUser && authorUser.id !== user.id) {
        await authorUser.send('Someone liked your post! You gained another 100k followers!').catch(() => {});
      }
    } else if (emojiName === '👎') {
      // Dislike: -50k followers
      const updated = await prisma.player.update({
        where: { id: tweet.authorId },
        data: {
          followers: {
            decrement: tweet.author.followers >= 50000n ? 50000n : tweet.author.followers
          }
        }
      });

      await prisma.playerTweet.update({
        where: { id: tweet.id },
        data: { dislikes: { increment: 1 } }
      });

      const authorUser = await reaction.client.users.fetch(tweet.authorId).catch(() => null);
      if (authorUser && authorUser.id !== user.id) {
        await authorUser.send('Someone disliked your post! You lost 50k followers!').catch(() => {});
      }
    }
  } catch (err) {
    logger.error({ err }, 'Error processing onMessageReactionAdd');
  }
}
