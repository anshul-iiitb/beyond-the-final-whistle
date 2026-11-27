import {
  Message,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  AttachmentBuilder,
  User,
  Guild
} from 'discord.js';
import path from 'path';
import fs from 'fs';
import {
  executeTraining,
  getAttributeLabOverview,
  AttributeLabItem,
  SP_TRAIN_STAMINA_COST,
  upgradeAttribute,
  convertPlaystyle,
  executeSaunaRecovery,
  TrainingResult
} from '../engines/trainingEngine.js';
import { PLAYSTYLES } from '../config/constants.js';
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
      `⚡ **VIP 20h Endurance Prep**\n` +
      `> Maximum-yield VIP session designed for busy or overnight schedules.\n` +
      `• **Yield:** \`+20 TP\` ${tpEmoji}\n` +
      `• **Cooldown:** \`20 hours\` • **Stamina Cost:** \`50\` ${staminaEmoji}\n\n` +
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
  } else if (modeArg === 'noeffort' || modeArg === 'lazy' || modeArg === '20h' || modeArg === '20hr') {
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

/**
 * Builds the Research Facility -sptrain menu showing exact dynamic TP + Stamina costs for all 15 attributes.
 */
export function buildSpTrainSelectionMenu(
  overview: { player: any; staminaCost: number; attributes: AttributeLabItem[] },
  user: User,
  guild?: Guild | null
) {
  const { player, staminaCost, attributes } = overview;
  const tpEmoji = getEmoji(guild, 'tp');
  const staminaEmoji = getEmoji(guild, 'stamina');
  const atFacility = player.currentLocation === 'rf';

  const groupDefs = [
    { name: 'Attacking', title: '🔴 Attacking Attributes' },
    { name: 'Technical', title: '🔵 Technical Attributes' },
    { name: 'Defending', title: '🟢 Defending Attributes' },
    { name: 'Physical & Mental', title: '🟡 Physical & Mental Attributes' }
  ];

  const categoryBlocks = groupDefs.map(g => {
    const lines = attributes
      .filter(a => a.category === g.name)
      .map(a => {
        if (a.isMaxed) {
          return `⭐ \`${a.key.toUpperCase()}\` **${a.name}** (\`${a.currentVal}\`) — **MAX 99**`;
        }
        const badge = a.canAfford ? '✅' : '🔒';
        return `${badge} \`${a.key.toUpperCase()}\` **${a.name}** \`${a.currentVal}\` ➔ **\`${a.tpCost} TP\`** + **\`${staminaCost}⚡\`**`;
      });
    return `### ${g.title}\n${lines.join('\n')}`;
  });

  const sections = [
    `**Cost Per +1 Rating:** \`${staminaCost}\` ${staminaEmoji} **Stamina** + **` +
    `3–15\`** ${tpEmoji} **TP** *(dynamic per attribute)*\n` +
    `**Your Reserves:** **\`${player.trainingPoints} TP\`** ${tpEmoji}   •   **\`${player.stamina}/100\`** ${staminaEmoji} Stamina\n` +
    `**Facility Check:** ${atFacility ? '✅ Inside Research Facility' : '⚠️ Travel to Research Facility first (`-travel rf`)'}`,
    ...categoryBlocks,
    `${UI.DIVIDER}\n` +
    subtext('💡 Pick an attribute from the menu below or run `-sptrain <attr>` (e.g. `-sptrain fin`).')
  ];

  const embed = new EmbedBuilder()
    .setColor(THEME_COLORS.CYAN)
    .setTitle('🔬 Research Facility — Biomechanics Enhancement Lab')
    .setThumbnail(user.displayAvatarURL())
    .setDescription(sections.join(UI.SPACER))
    .setFooter({ text: `Beyond The Final Whistle • Research Facility (${SP_TRAIN_STAMINA_COST} Stamina + TP)` })
    .setTimestamp();

  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId(`sptrain_select_${user.id}`)
    .setPlaceholder('Choose an attribute to upgrade (+1)...')
    .addOptions(
      attributes.map(a => ({
        label: `${a.key.toUpperCase()} — ${a.name} (${a.currentVal})`,
        description: a.isMaxed
          ? 'Maxed out at 99'
          : `Cost: ${a.tpCost} TP + ${staminaCost} Stamina ${a.canAfford ? '• Ready' : '• Need more TP/Stamina'}`,
        value: a.key,
        emoji: a.isMaxed ? '⭐' : a.canAfford ? '✅' : '🔒'
      }))
    );

  const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);
  return { embed, components: [row] };
}

export async function handleSpTrainCommand(message: Message, args: string[]) {
  const attrArg = args[0];
  if (!attrArg) {
    const thinkingMsg = await sendThinkingMessage(message, 'Inspecting Research Facility TP & stamina costs...');
    const overview = await getAttributeLabOverview(message.author.id);
    if (!overview) {
      return await updateLoadingMessage(thinkingMsg, {
        content: '❌ Player not found. Run `-profile` first to register.',
        embeds: [],
        components: []
      });
    }
    const menu = buildSpTrainSelectionMenu(overview, message.author, message.guild);
    return await updateLoadingMessage(thinkingMsg, { embeds: [menu.embed], components: menu.components });
  }

  const thinkingMsg = await sendThinkingMessage(message, `Developing attribute \`${attrArg.toUpperCase()}\`...`);
  const result = await upgradeAttribute(message.author.id, attrArg);
  await updateLoadingMessage(thinkingMsg, result.message);
}

export async function handleConvertCommand(message: Message, args: string[]) {
  const styleArg = args[0];
  if (!styleArg) {
    const styleLines = Object.values(PLAYSTYLES).map(s =>
      `${s.emoji} \`${s.code}\` **${s.name}** (${s.position}) — *Key:* ${s.keyStats.map(k => `\`${k.toUpperCase()}\``).join(', ')}`
    );
    const embed = new EmbedBuilder()
      .setColor(THEME_COLORS.CYAN)
      .setTitle('🎭 Research Facility — Playstyle Conversion Guide')
      .setDescription(
        [
          '**Cost:** `FREE` (0 TP • 0 Stamina)   •   **Cooldown:** `7 Days`   •   **Location:** `-travel rf`',
          `### 📋 Available Tactical Roles\n${styleLines.join('\n')}`,
          `${UI.DIVIDER}\n` +
          subtext('💡 Switch role at the Research Facility: `-convert <code_or_alias>` (e.g. `-convert pch` or `-convert plm`).')
        ].join(UI.SPACER)
      )
      .setFooter({ text: 'Beyond The Final Whistle • Research Facility' })
      .setTimestamp();
    return await message.reply({ embeds: [embed] });
  }

  const thinkingMsg = await sendThinkingMessage(message, `Converting tactical playstyle to \`${styleArg.toUpperCase()}\`...`);
  const result = await convertPlaystyle(message.author.id, styleArg);
  await updateLoadingMessage(thinkingMsg, result.message);
}

export async function handleRecoveryCommand(message: Message) {
  const result = await executeSaunaRecovery(message.author.id);
  await message.reply(result.message);
}
