import { Message, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, AttachmentBuilder, User, Guild } from 'discord.js';
import path from 'path';
import fs from 'fs';
import { executeTraining, upgradeAttribute, convertPlaystyle, executeSaunaRecovery, TrainingResult } from '../engines/trainingEngine.js';
import { getNationFlag } from '../utils/formatHelper.js';
import { getEmoji } from '../utils/emojiHelper.js';
import { THEME_COLORS, UI, makeProgressBar, subtext } from '../utils/themeHelper.js';
import { sendThinkingMessage, updateLoadingMessage } from '../utils/loadingHelper.js';

/**
 * Builds the themed training success embed
 */
export function buildTrainingSuccessEmbed(result: TrainingResult, user: User, guild?: Guild | null) {
  const flag = getNationFlag(result.player?.nation);
  const staminaEmoji = getEmoji(guild, 'stamina');
  const tpEmoji = getEmoji(guild, 'tp');
  const remainingStam = result.remainingStamina ?? 0;
  const staminaBar = makeProgressBar(remainingStam, 100, 10);

  const embed = new EmbedBuilder()
    .setColor(THEME_COLORS.CYAN)
    .setTitle(`⚡ ${result.player?.username || user.username} ${flag} Session Completed!`)
    .setDescription(
      `### 🎯 DRILL BIOMETRIC SUMMARY\n` +
      `• **Training Points Earned:** \`+${result.tpGained ?? 0} TP\` ${tpEmoji}\n` +
      `• **Total TP Reserve:** \`${result.totalTp ?? 0} TP\` ${tpEmoji}\n` +
      `• **Session Cooldown:** Ready in \`${result.cooldownMinutes ?? 30} minutes\` ⏱️\n\n` +
      `### ⚡ CURRENT STAMINA\n` +
      `${staminaEmoji} \`${remainingStam}/100\`\n` +
      `${staminaBar} **${remainingStam}%**\n\n` +
      `${UI.DIVIDER}\n` +
      subtext('⚠️ Injury Risk: If stamina drops below 50, matchday injury chances rise significantly. Restore at the Sauna: `-recovery`.')
    )
    .setFooter({ text: 'Beyond The Final Whistle • Training Ground' })
    .setTimestamp();

  const files: AttachmentBuilder[] = [];
  const trainingImgPath = path.resolve(process.cwd(), 'assets/training.png');
  if (fs.existsSync(trainingImgPath)) {
    files.push(new AttachmentBuilder(trainingImgPath, { name: 'training.png' }));
    embed.setImage('attachment://training.png');
  }

  return { embed, files };
}

/**
 * Builds the themed Choose Training Method interactive menu
 */
export function buildTrainingSelectionMenu(user: User, guild?: Guild | null) {
  const tpEmoji = getEmoji(guild, 'tp');
  const staminaEmoji = getEmoji(guild, 'stamina');

  const embed = new EmbedBuilder()
    .setColor(THEME_COLORS.CYAN)
    .setTitle('🏋️ Training Ground — Select Session Regimen')
    .setThumbnail(user.displayAvatarURL())
    .setDescription(
      `Select an on-pitch training regimen below to accumulate Training Points (${tpEmoji}) and enhance your biomechanical attributes:\n\n` +
      `⚽ **Standard Pitch Drills**\n` +
      `> Tactical ball drills focusing on positional fundamentals.\n` +
      `• **Yield:** \`+1 to +2 TP\` ${tpEmoji} (Scales with player overall)\n` +
      `• **Cooldown:** \`30 minutes\` • **Stamina Cost:** \`5\` ${staminaEmoji}\n\n` +
      `👑 **VIP Elite Performance**\n` +
      `> High-intensity bespoke biometric training for VIP footballers.\n` +
      `• **Yield:** \`+6 TP\` ${tpEmoji}\n` +
      `• **Cooldown:** \`6 hours\` • **Stamina Cost:** \`5\` ${staminaEmoji}\n\n` +
      `⚡ **No Effort Intensive Prep**\n` +
      `> Instant matchday intensive tactical prep.\n` +
      `• **Yield:** \`+20 TP\` ${tpEmoji}\n` +
      `• **Cooldown:** \`1 per matchday\` • **Stamina Cost:** \`50\` ${staminaEmoji}\n\n` +
      `${UI.DIVIDER}\n` +
      subtext('💡 Click a button below to begin your training session.')
    )
    .setFooter({ text: 'Beyond The Final Whistle • Training Ground' })
    .setTimestamp();

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('train_normal')
      .setLabel('Normal Training')
      .setEmoji('⚽')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId('train_vip')
      .setLabel('VIP Training (+6 TP)')
      .setEmoji('👑')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId('train_noeffort')
      .setLabel('No Effort (+20 TP)')
      .setEmoji('👑')
      .setStyle(ButtonStyle.Danger)
  );

  return { embed, components: [row] };
}

export async function handleTrainCommand(message: Message, args: string[]) {
  const modeArg = args[0]?.toLowerCase();

  // If no argument, open interactive selection menu
  if (!modeArg) {
    const menu = buildTrainingSelectionMenu(message.author, message.guild);
    return await message.reply({ embeds: [menu.embed], components: menu.components });
  }

  let type: 'normal' | 'vip' | 'noeffort' = 'normal';
  if (modeArg === 'vip') {
    type = 'vip';
  } else if (modeArg === 'noeffort' || modeArg === 'lazy') {
    type = 'noeffort';
  }

  const thinkingMsg = await sendThinkingMessage(message, 'Recording pitch training session...');

  const result = await executeTraining(message.author.id, type);
  if (!result.success) {
    return await updateLoadingMessage(thinkingMsg, result.error || result.message || '❌ Training failed.');
  }

  const output = buildTrainingSuccessEmbed(result, message.author, message.guild);
  await updateLoadingMessage(thinkingMsg, { embeds: [output.embed], files: output.files });
}

export async function handleSpTrainCommand(message: Message, args: string[]) {
  const attrArg = args[0];
  if (!attrArg) {
    return await message.reply(
      '❌ Please specify an attribute to develop. Example: `-sptrain fin` or `-upgrade pac`\n' +
      '**Attributes:** `fin`, `pow`, `hea`, `pas`, `vis`, `cro`, `dri`, `tck`, `int`, `mrk`, `pac`, `phy`, `cmp`, `agi`, `wrk`'
    );
  }

  const result = await upgradeAttribute(message.author.id, attrArg);
  await message.reply(result.message);
}

export async function handleConvertCommand(message: Message, args: string[]) {
  const styleArg = args[0];
  if (!styleArg) {
    return await message.reply(
      '❌ Please specify a playstyle. Example: `-convert pch`\n' +
      '**Playstyles:** `PCH` (Poacher), `SPD` (Speedster), `TGT` (Target Man), `PLM` (Playmaker), `B2B` (Box-to-Box), `ANC` (Anchor), `STP` (Stopper), `SWP` (Sweeper), `BPD` (Ball-Playing Defender)'
    );
  }

  const result = await convertPlaystyle(message.author.id, styleArg);
  await message.reply(result.message);
}

export async function handleRecoveryCommand(message: Message) {
  const result = await executeSaunaRecovery(message.author.id);
  await message.reply(result.message);
}
