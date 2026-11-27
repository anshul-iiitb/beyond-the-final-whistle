import { MessageReaction, User } from 'discord.js';
import { applyTweetVote, buildUpdatedTweetEmbed } from '../engines/socialEngine.js';
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

    const emojiName = reaction.emoji.name;
    if (emojiName !== '👍' && emojiName !== '👎') return;

    const voteResult = await applyTweetVote(
      { discordMessageId: reaction.message.id },
      user.id,
      emojiName === '👍',
      reaction.client
    );

    if (voteResult.success && reaction.message.embeds[0]) {
      const updatedEmbed = buildUpdatedTweetEmbed(reaction.message.embeds[0], voteResult);
      await reaction.message.edit({ embeds: [updatedEmbed] }).catch(() => {});
    }
  } catch (err) {
    logger.error({ err }, 'Error processing onMessageReactionAdd');
  }
}
