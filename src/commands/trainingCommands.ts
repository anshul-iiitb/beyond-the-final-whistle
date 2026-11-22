import { Message, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, AttachmentBuilder, User, Guild } from 'discord.js';
import path from 'path';
import fs from 'fs';
import { executeTraining, upgradeAttribute, convertPlaystyle, executeSaunaRecovery, TrainingResult } from '../engines/trainingEngine.js';
import { getNationFlag } from '../utils/formatHelper.js';
import { getEmoji } from '../utils/emojiHelper.js';

/**
 * Builds the exact training success embed matching WhatsApp Image 2026-11-22 at 8.47.46 PM.jpeg
 */
export function buildTrainingSuccessEmbed(result: TrainingResult, user: User, guild?: Guild | null) {
  const flag = getNationFlag(result.player?.nation);
  const staminaEmoji = getEmoji(guild, 'stamina');
  const tpEmoji = getEmoji(guild, 'tp');

  const embed = new EmbedBuilder()
    .setColor('#1e1f22')
    .setTitle(`${result.player?.username || user.username} ${flag} trained!`)
    .setDescription(
      `You gained ${result.tpGained} ${tpEmoji} Training points!\n\n` +
      `You can train again in ${result.cooldownMinutes} minutes.\n\n` +
      `**New Stats!**\n` +
      `Stamina : ${result.remainingStamina} ${staminaEmoji}\n` +
      `Training points : ${result.totalTp} ${tpEmoji}`
    )
    .setFooter({
      text: 'Note : If your stamina goes below 50 there is high chance that you may catch injury during match.'
    });

  const files: AttachmentBuilder[] = [];
  const trainingImgPath = path.resolve(process.cwd(), 'assets/training.png');
  if (fs.existsSync(trainingImgPath)) {
    files.push(new AttachmentBuilder(trainingImgPath, { name: 'training.png' }));
    embed.setImage('attachment://training.png');
  }

  return { embed, files };
}

/**
 * Builds the Choose Training Method embed matching WhatsApp Image 2026-11-22 at 8.47.45 PM.jpeg
 */
export function buildTrainingSelectionMenu(user: User, guild?: Guild | null) {
  const tpEmoji = getEmoji(guild, 'tp');
  const now = new Date();
  const dateStr = now.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  }) + ' ' + now.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });

  const embed = new EmbedBuilder()
    .setColor('#1e1f22')
    .setTitle('Choose Training Method!')
    .setThumbnail(user.displayAvatarURL())
    .setDescription(
      `Choose a training method from below to train!\n\n` +
      `• *Normal Training* - Gives 1 to 2 ${tpEmoji} every 30 minutes *(range scales depending upon your overall)*\n\n` +
      `• *VIP Training* - Gives 6 ${tpEmoji} every 6 hours\n\n` +
      `• *No Effort Training* - Gives 20 ${tpEmoji} every matchday *(if used no other training methods can be used in that matchday)*`
    )
    .setFooter({ text: dateStr });

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('train_normal')
      .setLabel('Normal Training')
      .setEmoji('⚽')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId('train_vip')
      .setLabel('VIP Training')
      .setEmoji('👑')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId('train_noeffort')
      .setLabel('No Effort Training')
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

  const result = await executeTraining(message.author.id, type);
  if (!result.success) {
    return await message.reply(result.error || result.message || '❌ Training failed.');
  }

  const output = buildTrainingSuccessEmbed(result, message.author, message.guild);
  await message.reply({ embeds: [output.embed], files: output.files });
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
