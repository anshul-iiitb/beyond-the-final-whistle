import { Message, EmbedBuilder, AttachmentBuilder } from 'discord.js';
import fs from 'fs';
import path from 'path';
import { prisma } from '../database/prisma.js';
import { PLAYSTYLES } from '../config/constants.js';
import { syncMemberLocationVisibility } from '../engines/campusEngine.js';
import { THEME_COLORS, UI, subtext } from '../utils/themeHelper.js';

const LIST_KEYWORDS = new Set(['list', 'lisy', 'ls', 'all', 'dir', 'directory', 'help', 'roles', 'styles']);

export function buildPlaystyleDirectoryEmbed(player?: any): EmbedBuilder {
  const uniqueStyles = Array.from(new Map(Object.values(PLAYSTYLES).map(s => [s.code, s])).values());
  const attLines = uniqueStyles.filter(s => s.position === 'ATT').map(s => `• \`${s.code}\` ${s.emoji} **${s.name}** — *Key:* ${s.keyStats.map(k => `\`${k.toUpperCase()}\``).join(', ')}`);
  const midLines = uniqueStyles.filter(s => s.position === 'MID').map(s => `• \`${s.code}\` ${s.emoji} **${s.name}** — *Key:* ${s.keyStats.map(k => `\`${k.toUpperCase()}\``).join(', ')}`);
  const defLines = uniqueStyles.filter(s => s.position === 'DEF').map(s => `• \`${s.code}\` ${s.emoji} **${s.name}** — *Key:* ${s.keyStats.map(k => `\`${k.toUpperCase()}\``).join(', ')}`);

  const hasPlaystyle = player?.playstyle && player.playstyle !== 'NONE';
  const currentStyle = hasPlaystyle ? (PLAYSTYLES[player.playstyle] || PLAYSTYLES.PCH) : null;

  const headerDesc = hasPlaystyle
    ? `⭐ **Your Current Role:** ${currentStyle?.emoji} **${currentStyle?.name} (${currentStyle?.code}) • ${currentStyle?.position}**\n` +
      `*To switch roles later, visit Research Lab (\`-travel rf\` ➔ \`-convert <style>\`) or run \`-playstyle reset\`.*\n`
    : `Welcome to **Beyond The Final Whistle**! You currently have **no role** and **no campus location**.\n` +
      `Selecting your starting playstyle assigns your tactical role, sets your position (\`ATT\`, \`MID\`, or \`DEF\`), and places you inside the **🏋️ Training Center (\`tc\`)**!\n`;

  const footerAction = hasPlaystyle
    ? `💡 To re-choose your role for the 18-playstyle update, run \`-playstyle reset\` then \`-playstyle <choice>\`.`
    : `👉 **Select Your Role:** \`-playstyle <choice>\`\n` +
      `*Examples:* \`-playstyle pch\`, \`-playstyle b2b\`, \`-playstyle nnd\`, \`-playstyle f9\`, \`-playstyle plm\``;

  return new EmbedBuilder()
    .setColor(THEME_COLORS.GOLD)
    .setTitle('🎭 Tactical Playstyle Directory (18 Archetypes)')
    .setDescription(
      [
        headerDesc,
        `### ⚡ Strikers & Attackers (ATT)\n${attLines.join('\n')}\n`,
        `### 🎯 Midfielders (MID)\n${midLines.join('\n')}\n`,
        `### 🛡️ Centre Backs & Defenders (DEF)\n${defLines.join('\n')}\n`,
        `${UI.DIVIDER}\n` + footerAction
      ].join(UI.SPACER)
    )
    .setFooter({ text: 'Beyond The Final Whistle • Tactical Archetypes & Key Stats' })
    .setTimestamp();
}

export async function handlePlaystyleCommand(message: Message, args: string[]) {
  let player = await prisma.player.findUnique({
    where: { id: message.author.id },
    include: { nation: true }
  });

  if (!player) {
    player = await prisma.player.create({
      data: {
        id: message.author.id,
        username: message.author.username,
        discriminator: message.author.discriminator !== '0' ? message.author.discriminator : null,
        avatar: message.author.displayAvatarURL(),
        currentLocation: 'none',
        playstyle: 'NONE',
        position: 'ATT'
      },
      include: { nation: true }
    });
  }

  const arg0Lower = args[0]?.toLowerCase();

  // Reset command support (-playstyle reset)
  if (arg0Lower === 'reset') {
    await prisma.player.update({
      where: { id: message.author.id },
      data: { playstyle: 'NONE', currentLocation: 'none' }
    });
    if (message.guild) {
      await syncMemberLocationVisibility(message.guild, message.author.id, 'none');
    }
    return await message.reply(
      `🔄 **Playstyle Reset Successful!**\n` +
      `Your tactical role and campus location have been reset.\n` +
      `👉 Choose your new archetype now: \`-playstyle <choice>\` (e.g. \`-playstyle b2b\`, \`-playstyle nnd\`, \`-playstyle f9\`).`
    );
  }

  // Display directory if no arguments or user explicitly requested list (-playstyle, -playstyle list, -playstyle lisy)
  if (!arg0Lower || LIST_KEYWORDS.has(arg0Lower)) {
    const embed = buildPlaystyleDirectoryEmbed(player);
    const files: AttachmentBuilder[] = [];
    const matrixImgPath = path.resolve(process.cwd(), 'assets/tactical_matrix.png');
    if (fs.existsSync(matrixImgPath)) {
      files.push(new AttachmentBuilder(matrixImgPath, { name: 'tactical_matrix.png' }));
      embed.setImage('attachment://tactical_matrix.png');
    }
    return await message.reply({ embeds: [embed], files });
  }

  // If player already has a playstyle and attempts to pick another without reset
  if (player.playstyle && player.playstyle !== 'NONE') {
    const currentStyle = PLAYSTYLES[player.playstyle] || PLAYSTYLES.PCH;
    return await message.reply(
      `ℹ️ You already have an active playstyle (**${currentStyle.emoji} ${currentStyle.name} • ${currentStyle.position}**).\n` +
      `To browse all roles, run \`-playstyle list\`.\n` +
      `To switch tactical roles, visit the Research Facility (\`-travel rf\` ➔ \`-convert <style>\`, 7-day cooldown) or run \`-playstyle reset\`.`
    );
  }

  // Validate choice
  const choiceRaw = args[0].toUpperCase();
  const targetStyle = PLAYSTYLES[choiceRaw];
  if (!targetStyle) {
    return await message.reply(
      `❌ Unknown playstyle code \`${args[0]}\`.\n` +
      `Run \`-playstyle list\` to browse all 18 available roles (e.g. \`pch\`, \`f9\`, \`tgt\`, \`spd\`, \`plm\`, \`b2b\`, \`reg\`, \`nnd\`, \`bpd\`, \`stp\`).`
    );
  }

  // Update player with chosen playstyle and land them at Training Center
  const updated = await prisma.player.update({
    where: { id: message.author.id },
    data: {
      playstyle: targetStyle.code,
      position: targetStyle.position,
      currentLocation: 'tc'
    }
  });

  // Sync Discord permissions so #training-center becomes visible
  if (message.guild) {
    await syncMemberLocationVisibility(message.guild, message.author.id, 'tc');
  }

  const nextStepMsg =
    `🎉 **Tactical Playstyle Confirmed: ${targetStyle.emoji} ${targetStyle.name} (${targetStyle.position})!**\n\n` +
    `📍 You have been issued your locker and arrived at the **🏋️ Training Center** (\`tc\`)!\n` +
    `⭐ Key Biometrics: **${targetStyle.keyStats.map(s => s.toUpperCase()).join(' · ')}** (Eligible for 15% TP training discount!)\n\n` +
    `${UI.DIVIDER}\n` +
    `👉 **FINAL ONBOARDING STEP (2/2): Sign For A National Team**\n` +
    `You must pledge allegiance to a National Team before using campus facilities!\n` +
    `Run **\`-joinnation <alias>\`** (e.g. \`-joinnation eng\`, \`-joinnation fra\`, \`-joinnation bra\`) to unlock full campus access and claim your **+100,000 coins** 🪙 and **+100,000 followers** 👤 sign-on bonus!`;

  await message.reply(nextStepMsg);
}
