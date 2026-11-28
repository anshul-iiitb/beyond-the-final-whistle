import { Message, EmbedBuilder } from 'discord.js';
import { prisma } from '../database/prisma.js';
import { PLAYSTYLES } from '../config/constants.js';
import { syncMemberLocationVisibility } from '../engines/campusEngine.js';
import { THEME_COLORS, UI, subtext } from '../utils/themeHelper.js';

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

  // If player already has a playstyle
  if (player.playstyle && player.playstyle !== 'NONE') {
    const currentStyle = PLAYSTYLES[player.playstyle] || PLAYSTYLES.PCH;
    return await message.reply(
      `ℹ️ You already have an active playstyle (**${currentStyle.emoji} ${currentStyle.name} • ${currentStyle.position}**).\n` +
      `To switch tactical roles later, visit the Research Facility (\`-travel rf\` ➔ \`-convert <style>\`, 7-day cooldown).`
    );
  }

  const choiceRaw = args[0]?.toUpperCase();

  // If no argument, display the Onboarding Step 1/2 Directory
  if (!choiceRaw) {
    const uniqueStyles = Array.from(new Map(Object.values(PLAYSTYLES).map(s => [s.code, s])).values());
    const attLines = uniqueStyles.filter(s => s.position === 'ATT').map(s => `• \`${s.code}\` ${s.emoji} **${s.name}** — *Key:* ${s.keyStats.map(k => `\`${k.toUpperCase()}\``).join(', ')}`);
    const midLines = uniqueStyles.filter(s => s.position === 'MID').map(s => `• \`${s.code}\` ${s.emoji} **${s.name}** — *Key:* ${s.keyStats.map(k => `\`${k.toUpperCase()}\``).join(', ')}`);
    const defLines = uniqueStyles.filter(s => s.position === 'DEF').map(s => `• \`${s.code}\` ${s.emoji} **${s.name}** — *Key:* ${s.keyStats.map(k => `\`${k.toUpperCase()}\``).join(', ')}`);

    const embed = new EmbedBuilder()
      .setColor(THEME_COLORS.GOLD)
      .setTitle('🎭 ONBOARDING STEP 1/2: Choose Your Tactical Playstyle')
      .setDescription(
        [
          'Welcome to **Beyond The Final Whistle**! You currently have **no role** and **no campus location**.',
          'Selecting your starting playstyle assigns your tactical role, sets your position (`ATT`, `MID`, or `DEF`), and places you inside the **🏋️ Training Center (`tc`)**!\n',
          `### ⚡ Strikers & Attackers (ATT)\n${attLines.join('\n')}\n`,
          `### 🎯 Midfielders (MID)\n${midLines.join('\n')}\n`,
          `### 🛡️ Centre Backs & Defenders (DEF)\n${defLines.join('\n')}\n`,
          `${UI.DIVIDER}\n` +
          `👉 **Select Your Role:** \`-playstyle <choice>\`\n` +
          `*Examples:* \`-playstyle pch\`, \`-playstyle b2b\`, \`-playstyle nnd\`, \`-playstyle f9\``
        ].join(UI.SPACER)
      )
      .setFooter({ text: 'Beyond The Final Whistle • Rookie Induction' })
      .setTimestamp();

    return await message.reply({ embeds: [embed] });
  }

  // Validate choice
  const targetStyle = PLAYSTYLES[choiceRaw];
  if (!targetStyle) {
    return await message.reply(
      `❌ Unknown playstyle code \`${choiceRaw}\`.\n` +
      `Run \`-playstyle\` to browse the 18 available roles (e.g. \`pch\`, \`f9\`, \`tgt\`, \`spd\`, \`eng\`, \`b2b\`, \`reg\`, \`nnd\`, \`bpd\`, \`stp\`).`
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
