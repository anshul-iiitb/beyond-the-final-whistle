import { EmbedBuilder, AttachmentBuilder, Guild, Client } from 'discord.js';
import path from 'path';
import fs from 'fs';
import { prisma } from '../database/prisma.js';
import { SPONSORS } from '../config/constants.js';
import { formatK, getNationFlag } from '../utils/formatHelper.js';
import { getEmoji } from '../utils/emojiHelper.js';
import { withActionLock } from '../utils/mutexHelper.js';

const tweetVotersCache = new Map<string, Set<string>>();

export const TWEET_LIKE_REWARD = 100000n;
export const TWEET_DISLIKE_PENALTY = 50000n;
export const TWEET_REACTOR_COIN_REWARD = 5000n;

export interface SponsorExecutionResult {
  success: boolean;
  message: string;
  embed?: EmbedBuilder;
  files?: AttachmentBuilder[];
}

/**
 * Handles signing commercial brand endorsements at the Photoshooting Hall
 */
export async function executeSponsorAdvert(playerId: string, sponsorKey?: string, guild?: Guild | null): Promise<SponsorExecutionResult> {
  const coinEmoji = getEmoji(guild, 'coin');
  const staminaEmoji = getEmoji(guild, 'stamina');
  const fansEmoji = getEmoji(guild, 'followers');

  const player = await prisma.player.findUnique({
    where: { id: playerId },
    include: { nation: true }
  });
  if (!player) return { success: false, message: '❌ Player not found. Run `-profile` first.' };

  if (player.currentLocation !== 'ph') {
    return { success: false, message: '❌ You must be at the **📸 Photoshooting Hall** (`-travel ph`) to shoot adverts!' };
  }

  const now = new Date();
  if (player.lastAdvertAt) {
    const cooldownMs = 2 * 60 * 60 * 1000;
    const elapsed = now.getTime() - player.lastAdvertAt.getTime();
    if (elapsed < cooldownMs) {
      const remainingMinutes = Math.ceil((cooldownMs - elapsed) / (60 * 1000));
      return { success: false, message: `⏳ **Endorsement Cooldown:** You can only sign brand deals every 2 hours. Remaining: **${remainingMinutes} minutes**.` };
    }
  }

  if (!sponsorKey) {
    const lines = SPONSORS.map(s => {
      const eligible = player.followers >= s.minFollowers ? '✅' : '🔒';
      const followerText = s.followerDelta > 0n ? `+${formatK(s.followerDelta)}` : s.followerDelta < 0n ? `${formatK(s.followerDelta)}` : '0';
      return `${eligible} **${s.emoji} ${s.name}** (\`-advert ${s.key}\`)\n` +
        `• Min Followers: \`${formatK(s.minFollowers)} ${fansEmoji}\` | Stamina Cost: \`${s.staminaCost} ${staminaEmoji}\`\n` +
        `• Reward: \`+${formatK(s.rewardCoins)} ${coinEmoji}\` | Followers Change: \`${followerText} ${fansEmoji}\``;
    });

    const embed = new EmbedBuilder()
      .setColor('#f59e0b')
      .setTitle('📸 Commercial Brand Sponsorship Deals')
      .setDescription(
        `Choose a brand partner matching your follower status:\n\n${lines.join('\n\n')}\n\n` +
        `*Usage:* Click a button below or run \`-advert <brand>\` (e.g. \`-advert heineken\`, \`-advert adidas\`)`
      )
      .setFooter({ text: 'Beyond The Final Whistle • Commercial Photoshooting Hall' });

    return { success: true, message: '', embed };
  }

  const sponsor = SPONSORS.find(s => s.key === sponsorKey.toLowerCase() || s.name.toLowerCase() === sponsorKey.toLowerCase());
  if (!sponsor) {
    const list = SPONSORS.map(s => `\`${s.key}\``).join(', ');
    return { success: false, message: `❌ Unknown sponsor. Available: ${list}` };
  }

  if (sponsor.vipOnly && player.vipTier < 1) {
    return {
      success: false,
      message: `👑 **${sponsor.name}** (` + '300k Coins at 1M Fans' + `) is an exclusive **VIP** endorsement contract! Upgrade to VIP to unlock.`
    };
  }

  if (player.followers < sponsor.minFollowers) {
    return {
      success: false,
      message: `👥 Insufficient followers! **${sponsor.name}** requires **${formatK(sponsor.minFollowers)} followers** (You have: ${formatK(player.followers)}).`
    };
  }

  if (player.stamina < sponsor.staminaCost) {
    return {
      success: false,
      message: `⚡ Insufficient stamina (${player.stamina}/${sponsor.staminaCost} ${staminaEmoji} needed). Take a rest at the sauna or drink a sports drink!`
    };
  }

  return withActionLock(`${playerId}:advert`, async () => {
    const cooldownMs = 2 * 60 * 60 * 1000;
    const cutoff = new Date(now.getTime() - cooldownMs);
    const newFollowers = BigInt(Math.max(0, Number(player.followers + sponsor.followerDelta)));

    const updateRes = await prisma.player.updateMany({
      where: {
        id: playerId,
        currentLocation: 'ph',
        stamina: { gte: sponsor.staminaCost },
        followers: { gte: sponsor.minFollowers },
        OR: [
          { lastAdvertAt: null },
          { lastAdvertAt: { lte: cutoff } }
        ]
      },
      data: {
        coins: { increment: sponsor.rewardCoins },
        followers: newFollowers,
        stamina: { decrement: sponsor.staminaCost },
        lastAdvertAt: now
      }
    });

    if (updateRes.count === 0) {
      return { success: false, message: '⏳ Endorsement already processed or 2-hour cooldown active.' };
    }

    const updated = await prisma.player.findUnique({
      where: { id: playerId },
      include: { nation: true }
    });

    const flag = getNationFlag(updated?.nation || player.nation);
    const followerChangeStr = sponsor.followerDelta > 0n ? `+${formatK(sponsor.followerDelta)}` : sponsor.followerDelta < 0n ? `${formatK(sponsor.followerDelta)}` : '0';

    const embed = new EmbedBuilder()
      .setColor('#f59e0b')
      .setTitle(`${player.username} ${flag} signed endorsement with ${sponsor.emoji} ${sponsor.name}!`)
      .setDescription(
        `📸 **Commercial Photoshoot Complete!**\n\n` +
        `${coinEmoji} **Earnings:** \`+${formatK(sponsor.rewardCoins)} coins\`\n` +
        `${fansEmoji} **Follower Change:** \`${followerChangeStr} followers\` (Total: \`${formatK(updated?.followers ?? newFollowers)}\`)\n` +
        `${staminaEmoji} **Stamina:** \`${updated?.stamina ?? (player.stamina - sponsor.staminaCost)}/100\`\n\n` +
        `*(2-hour brand photoshoot cooldown active)*`
      )
      .setFooter({ text: 'Beyond The Final Whistle • Commercial Hub' });

    const files: AttachmentBuilder[] = [];
    const adGifPath = path.resolve(process.cwd(), `assets/adverts/${sponsor.key}.gif`);
    const bannerPath = path.resolve(process.cwd(), 'assets/photoshoot.png');

    if (fs.existsSync(adGifPath)) {
      files.push(new AttachmentBuilder(adGifPath, { name: `${sponsor.key}.gif` }));
      embed.setImage(`attachment://${sponsor.key}.gif`);
    } else if (fs.existsSync(bannerPath)) {
      files.push(new AttachmentBuilder(bannerPath, { name: 'photoshoot.png' }));
      embed.setImage('attachment://photoshoot.png');
    }

    return { success: true, message: '', embed, files };
  });
}

/**
 * Handles grassroots youth coaching at the Local Club
 */
export async function executeCoaching(playerId: string): Promise<{ success: boolean; message: string }> {
  return withActionLock(`${playerId}:coaching`, async () => {
    const player = await prisma.player.findUnique({ where: { id: playerId } });
    if (!player) return { success: false, message: '❌ Player not found.' };

    if (player.currentLocation !== 'ch') {
      return { success: false, message: '❌ You must be at the **🏡 Player Clubhouse** (`-travel ch`) to coach youth!' };
    }

    const now = new Date();
    const cooldownMs = 2 * 60 * 60 * 1000;
    const cutoff = new Date(now.getTime() - cooldownMs);

    if (player.lastCoachedAt) {
      const elapsed = now.getTime() - player.lastCoachedAt.getTime();
      if (elapsed < cooldownMs) {
        const remainingMinutes = Math.ceil((cooldownMs - elapsed) / (60 * 1000));
        return { success: false, message: `⏳ **Coaching Cooldown:** The kids are on lunch break! Available again in **${remainingMinutes} minutes**.` };
      }
    }

    if (player.stamina < 10) {
      return { success: false, message: `⚡ Coaching requires **10 Stamina** (You have ${player.stamina}/100). Rest at sauna or drink a sports drink.` };
    }

    const rewardCoins = 50000n;
    const updateRes = await prisma.player.updateMany({
      where: {
        id: playerId,
        currentLocation: 'ch',
        stamina: { gte: 10 },
        OR: [
          { lastCoachedAt: null },
          { lastCoachedAt: { lte: cutoff } }
        ]
      },
      data: {
        coins: { increment: rewardCoins },
        stamina: { decrement: 10 },
        lastCoachedAt: now
      }
    });

    if (updateRes.count === 0) {
      return { success: false, message: '⏳ Coaching session already recorded or 2-hour cooldown active.' };
    }

    const updated = await prisma.player.findUnique({ where: { id: playerId } });

    return {
      success: true,
      message:
        `⚽ **Grassroots Academy Coaching Session Complete!**\n\n` +
        `🪙 Earned: **+${formatK(rewardCoins)} coins**\n` +
        `⚡ Stamina: \`${updated?.stamina ?? (player.stamina - 10)}/100 ⚡\`\n` +
        `*(2-hour coaching cooldown active)*`
    };
  });
}

/**
 * Handles fan autograph and meet & greet session at the Local Club
 */
export async function executeMeetGreet(playerId: string): Promise<{ success: boolean; message: string }> {
  return withActionLock(`${playerId}:meetgreet`, async () => {
    const player = await prisma.player.findUnique({ where: { id: playerId } });
    if (!player) return { success: false, message: '❌ Player not found.' };

    if (player.currentLocation !== 'ch') {
      return { success: false, message: '❌ You must be at the **🏡 Player Clubhouse** (`-travel ch`) to meet your fans!' };
    }

    const now = new Date();
    const cooldownMs = 2 * 60 * 60 * 1000;
    const cutoff = new Date(now.getTime() - cooldownMs);

    if (player.lastMeetGreetAt) {
      const elapsed = now.getTime() - player.lastMeetGreetAt.getTime();
      if (elapsed < cooldownMs) {
        const remainingMinutes = Math.ceil((cooldownMs - elapsed) / (60 * 1000));
        return { success: false, message: `⏳ **Fan Queue Cooldown:** Security is clearing the line! Next meet & greet in **${remainingMinutes} minutes**.` };
      }
    }

    if (player.stamina < 10) {
      return { success: false, message: `⚡ Signing autographs requires **10 Stamina** (You have ${player.stamina}/100). Rest at sauna or drink a sports drink.` };
    }

    const rewardFollowers = 50000n;
    const updateRes = await prisma.player.updateMany({
      where: {
        id: playerId,
        currentLocation: 'ch',
        stamina: { gte: 10 },
        OR: [
          { lastMeetGreetAt: null },
          { lastMeetGreetAt: { lte: cutoff } }
        ]
      },
      data: {
        followers: { increment: rewardFollowers },
        stamina: { decrement: 10 },
        lastMeetGreetAt: now
      }
    });

    if (updateRes.count === 0) {
      return { success: false, message: '⏳ Meet & greet already recorded or 2-hour cooldown active.' };
    }

    const updated = await prisma.player.findUnique({ where: { id: playerId } });

    return {
      success: true,
      message:
        `✍️ **Club Autograph & Fan Meet-and-Greet Complete!**\n\n` +
        `👥 Gained: **+${formatK(rewardFollowers)} followers** (Total: \`${formatK(updated?.followers ?? (player.followers + rewardFollowers))} 👤\`)\n` +
        `⚡ Stamina: \`${updated?.stamina ?? (player.stamina - 10)}/100 ⚡\`\n` +
        `*(2-hour meet & greet cooldown active)*`
    };
  });
}

/**
 * Handles peer coin transfer (-give @user <amount>)
 */
export async function giveMoney(senderId: string, recipientId: string, amount: bigint): Promise<{ success: boolean; message: string }> {
  if (amount <= 0n) {
    return { success: false, message: '❌ Transfer amount must be greater than zero.' };
  }

  if (senderId === recipientId) {
    return { success: false, message: '❌ You cannot transfer funds to yourself!' };
  }

  const sender = await prisma.player.findUnique({ where: { id: senderId } });
  if (!sender) return { success: false, message: '❌ Sender profile not found.' };

  if (sender.coins < amount) {
    return { success: false, message: `🪙 Insufficient coins! You have \`${formatK(sender.coins)} coins\`, but tried to transfer \`${formatK(amount)} coins\`.` };
  }

  const recipient = await prisma.player.findUnique({ where: { id: recipientId } });
  if (!recipient) return { success: false, message: '❌ Recipient has not registered on BTFW yet.' };

  await prisma.$transaction([
    prisma.player.update({
      where: { id: senderId },
      data: { coins: { decrement: amount } }
    }),
    prisma.player.update({
      where: { id: recipientId },
      data: { coins: { increment: amount } }
    })
  ]);

  return {
    success: true,
    message: `💸 **Direct Transfer Successful!**\nSent **${formatK(amount)} 🪙** to <@${recipientId}>.`
  };
}

export interface TweetVoteResult {
  success: boolean;
  error?: string;
  authorUsername?: string;
  authorFlag?: string;
  newFollowers?: bigint;
  likes?: number;
  dislikes?: number;
  reactorCoinsAwarded?: bigint;
}

/**
 * Formats the updated TwitFeed embed JSON after a like/dislike vote.
 */
export function buildUpdatedTweetEmbed(existingEmbed: { toJSON(): any }, voteResult: TweetVoteResult) {
  const newEmbed = existingEmbed.toJSON();
  const newFollowersStr = formatK(voteResult.newFollowers ?? 0n);
  newEmbed.title = `${voteResult.authorUsername} ${voteResult.authorFlag} Tweeted!`;
  newEmbed.fields = [
    { name: `Followers 👤 : ${newFollowersStr}`, value: `${voteResult.likes} 👍  ${voteResult.dislikes} 👎`, inline: false }
  ];
  return newEmbed;
}

/**
 * Shared TwitFeed vote processor for both interactive buttons and emoji reactions.
 * Author receives +100k followers on 👍 or -50k on 👎; registered voters earn +5k coins per post.
 */
export async function applyTweetVote(
  lookup: { id?: string; discordMessageId?: string },
  voterId: string,
  isLike: boolean,
  client: Client
): Promise<TweetVoteResult> {
  const tweet = lookup.id
    ? await prisma.playerTweet.findUnique({
        where: { id: lookup.id },
        include: { author: { include: { nation: true } } }
      })
    : await prisma.playerTweet.findFirst({
        where: { discordMessageId: lookup.discordMessageId },
        include: { author: { include: { nation: true } } }
      });

  if (!tweet) return { success: false, error: '❌ Tweet not found.' };
  if (tweet.authorId === voterId) return { success: false, error: '❌ You cannot vote on your own tweet!' };

  let voters = tweetVotersCache.get(tweet.id);
  if (!voters) {
    voters = new Set<string>();
    tweetVotersCache.set(tweet.id, voters);
  }
  if (voters.has(voterId)) return { success: false, error: '❌ You have already voted on this tweet!' };

  let txResult: {
    alreadyVoted?: boolean;
    updatedAuthor?: { username: string; followers: bigint; nation: any };
    updatedTweet?: { likes: number; dislikes: number };
    reactorCoinsAwarded: bigint;
  };

  try {
    txResult = await prisma.$transaction(async (tx) => {
      await tx.playerTweetVote.create({
        data: { tweetId: tweet.id, voterId, isLike }
      });

      const currentAuthor = await tx.player.findUnique({
        where: { id: tweet.authorId },
        select: { followers: true }
      });
      const currentFollowers = currentAuthor?.followers ?? tweet.author.followers;

      const nextFollowers = isLike
        ? currentFollowers + TWEET_LIKE_REWARD
        : currentFollowers >= TWEET_DISLIKE_PENALTY
          ? currentFollowers - TWEET_DISLIKE_PENALTY
          : 0n;

      const updatedAuthor = await tx.player.update({
        where: { id: tweet.authorId },
        data: { followers: nextFollowers },
        include: { nation: true }
      });

      const updatedTweet = await tx.playerTweet.update({
        where: { id: tweet.id },
        data: isLike ? { likes: { increment: 1 } } : { dislikes: { increment: 1 } }
      });

      // Reward any registered voter with +5k coins for engaging
      let reactorCoinsAwarded = 0n;
      const voterPlayer = await tx.player.findUnique({ where: { id: voterId }, select: { id: true } });
      if (voterPlayer) {
        await tx.player.update({
          where: { id: voterId },
          data: { coins: { increment: TWEET_REACTOR_COIN_REWARD } }
        });
        reactorCoinsAwarded = TWEET_REACTOR_COIN_REWARD;
      }

      return { updatedAuthor, updatedTweet, reactorCoinsAwarded };
    });
  } catch (err: any) {
    if (err?.code === 'P2002') {
      voters.add(voterId);
      return { success: false, error: '❌ You have already voted on this tweet!' };
    }
    throw err;
  }

  voters.add(voterId);
  const updatedAuthor = txResult.updatedAuthor!;
  const updatedTweet = txResult.updatedTweet!;

  try {
    const voterUser = await client.users.fetch(voterId).catch(() => null);
    if (voterUser) {
      const voterDm = txResult.reactorCoinsAwarded > 0n
        ? `You ${isLike ? 'liked' : 'disliked'} **${updatedAuthor.username}**'s tweet and earned **+${formatK(txResult.reactorCoinsAwarded)} coins**!`
        : `You have successfully ${isLike ? 'liked' : 'disliked'} the tweet! Register with \`-profile\` to earn **+5k coins** per reaction!`;
      await voterUser.send(voterDm).catch(() => {});
    }
    const authorUser = await client.users.fetch(tweet.authorId).catch(() => null);
    if (authorUser) {
      await authorUser.send(
        isLike
          ? 'Someone liked your post! You gained **+100k followers**!'
          : 'Someone disliked your post! You lost **50k followers**!'
      ).catch(() => {});
    }
  } catch {}

  return {
    success: true,
    authorUsername: updatedAuthor.username,
    authorFlag: getNationFlag(updatedAuthor.nation),
    newFollowers: updatedAuthor.followers,
    likes: updatedTweet.likes,
    dislikes: updatedTweet.dislikes,
    reactorCoinsAwarded: txResult.reactorCoinsAwarded
  };
}
