import { Message, EmbedBuilder } from 'discord.js';
import { prisma } from '../database/prisma.js';
import { THEME_COLORS, UI, makeProgressBar, subtext } from '../utils/themeHelper.js';
import { resolveTargetUser } from '../utils/userResolver.js';
import { calculateDerivedRatings } from '../engines/matchSimulationEngine.js';
import { syncMemberGameRoles } from '../utils/roleSyncHelper.js';
import { getEmoji } from '../utils/emojiHelper.js';

export async function handleReferralCommand(message: Message, args: string[]) {
  const caller = await prisma.player.findUnique({
    where: { id: message.author.id }
  });

  if (!caller) {
    return await message.reply('❌ You have not registered yet. Use `-profile` to start your career!');
  }

  const currentTp = caller.trainingPoints || 0;
  const lifetimeTp = caller.lifetimeTpEarned || 0;
  const effectiveTp = Math.max(currentTp, lifetimeTp);
  const tpProgress = Math.min(effectiveTp, 50);

  // If no args provided, display personal referral status & guide
  if (args.length === 0) {
    const tpEmoji = getEmoji(message.guild, 'tp');
    const hasReached50 = effectiveTp >= 50;
    const progressBar = makeProgressBar(tpProgress, 50, 10);

    const statusLine = caller.referredById
      ? `✅ **Claimed:** Credited <@${caller.referredById}>`
      : hasReached50
        ? `🟢 **Ready to Claim:** You have 50+ TP! Run \`-referral @inviter\``
        : `⏳ **In Progress:** Earn **${50 - tpProgress} more TP** to unlock referral redemption`;

    const embed = new EmbedBuilder()
      .setColor(THEME_COLORS.GOLD)
      .setTitle('🤝 BTFW RECRUITMENT & REFERRAL SYSTEM')
      .setDescription(
        [
          `> *Invite friends to Beyond The Final Whistle! When your recruit trains hard and reaches **50 TP**, they can credit you for **7 Days of VIP Access**!*\n`,
          `### 👤 Your Referral Telemetry`,
          `• **50 TP Milestone Progress:** **${effectiveTp}/50 TP** ${tpEmoji}`,
          `[${progressBar}] ${Math.round((tpProgress / 50) * 100)}%`,
          `• **Your Referral Redemption:** ${statusLine}`,
          `• **Recruits Verified:** **${caller.referralCount || 0} players** (${(caller.referralCount || 0) * 7} days VIP earned 👑)\n`,
          `${UI.DIVIDER}\n`,
          `### 📖 How It Works`,
          `1️⃣ Invite a friend to the Discord server.`,
          `2️⃣ Your friend starts their career (\`-playstyle\`, \`-joinnation\`) and trains at the Training Center (\`-train\`).`,
          `3️⃣ Once your friend accumulates **50 TP**, they run:`,
          `\`-referral @yourname\``,
          `4️⃣ You instantly receive **+7 Days of VIP Access** (stacks with current VIP duration) with full commands & auction privileges!\n`,
          `${UI.DIVIDER}\n`,
          subtext('💡 Referral VIP passes grant complete access to VIP training, sauna stamina recharges, exhibition matches, 300k sponsorships, and auction house features.')
        ].join('\n')
      )
      .setFooter({ text: 'Beyond The Final Whistle • Player Referral Programme' })
      .setTimestamp();

    return await message.reply({ embeds: [embed] });
  }

  // Parse target user (supports mention, ID, or username)
  let targetUser: any = message.mentions.users.first();
  if (!targetUser && args[0]) {
    const resolved = await resolveTargetUser(message, args[0]);
    if (resolved) {
      targetUser = resolved.user || { id: resolved.id, username: resolved.username };
    }
  }

  if (!targetUser) {
    return await message.reply('❌ Please specify the player who invited you (e.g. `-referral ronaldo` or `-referral @inviter`).');
  }

  if (targetUser.id === message.author.id) {
    return await message.reply('❌ You cannot refer yourself!');
  }

  if (targetUser.bot) {
    return await message.reply('❌ Bots cannot be credited as your inviter!');
  }

  if (caller.referredById) {
    return await message.reply(
      `❌ **Referral Already Redeemed:** You have already credited <@${caller.referredById}> as your recruiter! Each player can only claim a referral once.`
    );
  }

  if (effectiveTp < 50) {
    const tpEmoji = getEmoji(message.guild, 'tp');
    return await message.reply(
      `❌ **50 TP Required:** You need to earn at least **50 Training Points (TP)** before you can reward your recruiter! (Your Progress: **${effectiveTp}/50 TP** ${tpEmoji}).\n*Run \`-train\` at the Training Center (\`-travel tc\`) to grind more TP!*`
    );
  }

  const targetPlayer = await prisma.player.findUnique({
    where: { id: targetUser.id }
  });

  if (!targetPlayer) {
    return await message.reply(
      `❌ **${targetUser.username}** has not registered their player profile yet. Tell them to run \`-profile\` first!`
    );
  }

  // Calculate new VIP expiry: stacks if already active
  const now = Date.now();
  const currentExpiry = targetPlayer.vipExpiresAt ? targetPlayer.vipExpiresAt.getTime() : now;
  const baseTime = currentExpiry > now ? currentExpiry : now;
  const newExpiry = new Date(baseTime + 7 * 24 * 60 * 60 * 1000);
  const unixExpiry = Math.floor(newExpiry.getTime() / 1000);

  // Preserve full VIP privileges if they already held standard/admin VIP
  const isAlreadyFullVip = Boolean(targetPlayer.vipTier >= 1 && !targetPlayer.referralVipOnly);

  // Apply atomic transaction
  await prisma.$transaction([
    prisma.player.update({
      where: { id: message.author.id },
      data: {
        referredById: targetUser.id,
        referredAt: new Date()
      }
    }),
    prisma.player.update({
      where: { id: targetUser.id },
      data: {
        vipTier: 1,
        vipExpiresAt: newExpiry,
        referralVipOnly: !isAlreadyFullVip,
        referralCount: { increment: 1 }
      }
    })
  ]);

  // Sync Discord server VIP channel permissions & roles if present
  if (message.guild) {
    const vipChannel = message.guild.channels.cache.find(c => c.name.toLowerCase().includes('vip-lounge'));
    if (vipChannel && 'permissionOverwrites' in vipChannel) {
      await vipChannel.permissionOverwrites.create(targetUser.id, {
        ViewChannel: true,
        SendMessages: true,
        ReadMessageHistory: true
      }).catch(() => {});
    }

    const targetMember = await message.guild.members.fetch(targetUser.id).catch(() => null);
    if (targetMember) {
      const updatedTarget = await prisma.player.findUnique({ where: { id: targetUser.id } });
      if (updatedTarget) {
        const d = calculateDerivedRatings(updatedTarget);
        await syncMemberGameRoles(targetMember, {
          ovr: Math.round((d.atk + d.mid + d.def) / 3),
          matchesPlayed: updatedTarget.matchesPlayed || 0,
          vipTier: 1
        });
      }
    }
  }

  const embed = new EmbedBuilder()
    .setColor(THEME_COLORS.GOLD)
    .setTitle('👑 7 DAYS VIP GRANTED — RECRUITMENT VERIFIED!')
    .setDescription(
      [
        `🎉 **Congratulations!** **${message.author.username}** has reached **50 TP** and officially credited **${targetUser.username}** as their recruiter!\n`,
        `👤 **Recruiter:** <@${targetUser.id}>`,
        `⭐ **Reward:** **+7 Days of VIP Access** (Active until: <t:${unixExpiry}:D>, <t:${unixExpiry}:R>)\n`,
        `${UI.DIVIDER}\n`,
        `### 🏆 VIP Privileges Activated:`,
        `• 🏋️ **VIP 6h (+6 TP) & 20h (+20 TP) Training Regimens**`,
        `• 🧖 **Cryo Sauna Full Stamina Recharge (100/100)**`,
        `• 🤝 **VIP Friendly Matches** (Zero stat loss + MOTM boost)`,
        `• 💰 **VIP 300,000 Coin Commercial Sponsorship** (\`-advert\`)`,
        `• 🏛️ **Private VIP Council Lounge Access** (\`#vip-lounge\`)`,
        `• 🏷️ **VIP Auction Privileges** & Exclusive command access\n`,
        `${UI.DIVIDER}\n`,
        subtext('💡 Referral VIP passes grant complete commands & auction access (free boutique cosmetics reserved for full VIP passes).')
      ].join('\n')
    )
    .setFooter({ text: 'Beyond The Final Whistle • Player Referral Programme' })
    .setTimestamp();

  await message.reply({ embeds: [embed] });
}
