import { Message, EmbedBuilder } from 'discord.js';
import { prisma } from '../database/prisma.js';
import { SPONSORS } from '../config/constants.js';

/**
 * Handles signing commercial brand endorsements at the Photoshooting Hall
 */
export async function executeSponsorAdvert(playerId: string, sponsorKey?: string): Promise<{ success: boolean; message: string; embed?: EmbedBuilder }> {
  const player = await prisma.player.findUnique({ where: { id: playerId } });
  if (!player) return { success: false, message: '❌ Player not found.' };

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
      const followerText = s.followerDelta > 0n ? `+${Number(s.followerDelta).toLocaleString()}` : s.followerDelta < 0n ? `${Number(s.followerDelta).toLocaleString()}` : '0';
      return `${eligible} **${s.emoji} ${s.name}** (\`-advert ${s.key}\`)\n` +
        `• Min Followers: \`${Number(s.minFollowers).toLocaleString()}\` | Stamina: \`${s.staminaCost}\`\n` +
        `• Reward: \`+${Number(s.rewardCoins).toLocaleString()} coins\` | Followers: \`${followerText}\``;
    });

    const embed = new EmbedBuilder()
      .setColor('#f59e0b')
      .setTitle('📸 Commercial Sponsorship Deals')
      .setDescription(
        `Choose a brand partner matching your follower status:\n\n${lines.join('\n\n')}\n\n` +
        `*Usage:* \`-advert <brand>\` (e.g. \`-advert heineken\`, \`-advert adidas\`)`
      )
      .setFooter({ text: 'Beyond The Final Whistle • Commercial Hub' });

    return { success: true, message: '', embed };
  }

  const sponsor = SPONSORS.find(s => s.key === sponsorKey.toLowerCase() || s.name.toLowerCase() === sponsorKey.toLowerCase());
  if (!sponsor) {
    const list = SPONSORS.map(s => `\`${s.key}\``).join(', ');
    return { success: false, message: `❌ Unknown sponsor. Available: ${list}` };
  }

  if (player.followers < sponsor.minFollowers) {
    return {
      success: false,
      message: `👥 Insufficient followers! **${sponsor.name}** requires **${Number(sponsor.minFollowers).toLocaleString()} followers** (You have: ${Number(player.followers).toLocaleString()}).`
    };
  }

  if (player.stamina < sponsor.staminaCost) {
    return {
      success: false,
      message: `⚡ Insufficient stamina (${player.stamina}/${sponsor.staminaCost} needed). Take a rest at the sauna or drink a sports drink!`
    };
  }

  const newFollowers = BigInt(Math.max(0, Number(player.followers + sponsor.followerDelta)));
  const updated = await prisma.player.update({
    where: { id: playerId },
    data: {
      coins: { increment: sponsor.rewardCoins },
      followers: newFollowers,
      stamina: { decrement: sponsor.staminaCost },
      lastAdvertAt: now
    }
  });

  return {
    success: true,
    message: `📸 **Commercial Shoot Complete with ${sponsor.emoji} ${sponsor.name}!**\n` +
      `🪙 **Earned:** \`+${Number(sponsor.rewardCoins).toLocaleString()} coins\`\n` +
      `👥 **Followers:** \`${Number(updated.followers).toLocaleString()}\`\n` +
      `⚡ **Stamina:** \`${updated.stamina}/100\`\n*(2-hour cooldown started)*`
  };
}

/**
 * Handles grassroots youth coaching at the Local Club
 */
export async function executeCoaching(playerId: string): Promise<{ success: boolean; message: string }> {
  const player = await prisma.player.findUnique({ where: { id: playerId } });
  if (!player) return { success: false, message: '❌ Player not found.' };

  if (player.currentLocation !== 'lc') {
    return { success: false, message: '❌ You must be at the **🏟️ Local Club** (`-travel lc`) to coach youth!' };
  }

  const now = new Date();
  if (player.lastCoachedAt) {
    const cooldownMs = 2 * 60 * 60 * 1000;
    const elapsed = now.getTime() - player.lastCoachedAt.getTime();
    if (elapsed < cooldownMs) {
      const remainingMinutes = Math.ceil((cooldownMs - elapsed) / (60 * 1000));
      return { success: false, message: `⏳ **Coaching Cooldown:** Please wait **${remainingMinutes} minutes** before holding another clinic.` };
    }
  }

  if (player.stamina < 10) {
    return { success: false, message: `⚡ Insufficient stamina (10 needed). You have ${player.stamina}/100.` };
  }

  const updated = await prisma.player.update({
    where: { id: playerId },
    data: {
      coins: { increment: 50000n },
      stamina: { decrement: 10 },
      lastCoachedAt: now
    }
  });

  return {
    success: true,
    message: `🏟️ **Youth Coaching Clinic Concluded!**\n` +
      `You mentored local academy prospects and earned **+50,000 coins**!\n` +
      `Balance: \`${Number(updated.coins).toLocaleString()} coins\` | Stamina: \`${updated.stamina}/100\``
  };
}

/**
 * Handles fan meet & greet at the Local Club
 */
export async function executeMeetGreet(playerId: string): Promise<{ success: boolean; message: string }> {
  const player = await prisma.player.findUnique({ where: { id: playerId } });
  if (!player) return { success: false, message: '❌ Player not found.' };

  if (player.currentLocation !== 'lc') {
    return { success: false, message: '❌ You must be at the **🏟️ Local Club** (`-travel lc`) for fan autograph sessions!' };
  }

  const now = new Date();
  if (player.lastMeetGreetAt) {
    const cooldownMs = 2 * 60 * 60 * 1000;
    const elapsed = now.getTime() - player.lastMeetGreetAt.getTime();
    if (elapsed < cooldownMs) {
      const remainingMinutes = Math.ceil((cooldownMs - elapsed) / (60 * 1000));
      return { success: false, message: `⏳ **Meet & Greet Cooldown:** Please wait **${remainingMinutes} minutes** before your next fan session.` };
    }
  }

  if (player.stamina < 10) {
    return { success: false, message: `⚡ Insufficient stamina (10 needed). You have ${player.stamina}/100.` };
  }

  const updated = await prisma.player.update({
    where: { id: playerId },
    data: {
      followers: { increment: 50000n },
      stamina: { decrement: 10 },
      lastMeetGreetAt: now
    }
  });

  return {
    success: true,
    message: `✍️ **Autograph & Selfie Session Completed!**\n` +
      `Gained **+50,000 enthusiastic followers**!\n` +
      `Total Followers: \`${Number(updated.followers).toLocaleString()}\` | Stamina: \`${updated.stamina}/100\``
  };
}

/**
 * Transfers coins between players
 */
export async function giveMoney(senderId: string, receiverId: string, amount: bigint): Promise<{ success: boolean; message: string }> {
  if (senderId === receiverId) {
    return { success: false, message: '❌ You cannot transfer funds to yourself.' };
  }

  if (amount <= 0n) {
    return { success: false, message: '❌ Amount must be greater than 0.' };
  }

  const sender = await prisma.player.findUnique({ where: { id: senderId } });
  if (!sender) return { success: false, message: '❌ You must have a registered player profile to send money.' };

  if (sender.coins < amount) {
    return { success: false, message: `🪙 Insufficient coins! You have **${Number(sender.coins).toLocaleString()} coins**.` };
  }

  const receiver = await prisma.player.findUnique({ where: { id: receiverId } });
  if (!receiver) {
    return { success: false, message: '❌ The receiving user has not registered on Beyond The Final Whistle yet.' };
  }

  await prisma.$transaction([
    prisma.player.update({
      where: { id: senderId },
      data: { coins: { decrement: amount } }
    }),
    prisma.player.update({
      where: { id: receiverId },
      data: { coins: { increment: amount } }
    })
  ]);

  return {
    success: true,
    message: `💸 **Wire Transfer Successful!**\n` +
      `Sent **${Number(amount).toLocaleString()} coins** to **${receiver.username}**!\n` +
      `Remaining Balance: \`${Number(sender.coins - amount).toLocaleString()} coins\``
  };
}
