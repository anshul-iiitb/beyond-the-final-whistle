import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} from 'discord.js';
import { formatBlueprintStagesLines } from './blueprintTypes.js';
import { BlueprintDraftState } from './blueprintStoreService.js';

export function buildDraftBuilderEmbed(draft: BlueprintDraftState): EmbedBuilder {
  const stageLines = draft.stages.length > 0
    ? formatBlueprintStagesLines(draft.stages).join('\n\n')
    : [
        '*No stages added yet.*',
        '',
        '**🛠️ How to build your tournament blueprint:**',
        '• Click **➕ Add Groups Stage** to define leagues/group rounds (e.g. `A, B` or routing rules).',
        '• Click **🏆 Add Knockout Stage** to define playoff brackets, qualifiers, or finals.',
        '• Click **🤖 AI / Text Import** to compile from natural language or compact DSL.',
        '• When finished, click **💾 Save Blueprint** to store in database for any tournament!',
      ].join('\n');

  return new EmbedBuilder()
    .setTitle(`🛠️ Tournament Blueprint Builder: ${draft.name}`)
    .setColor(draft.stages.length > 0 ? '#a855f7' : '#f59e0b')
    .setDescription(
      (draft.description ? `*${draft.description}*\n\n` : '') +
      stageLines
    )
    .setFooter({ text: `Stages: ${draft.stages.length}/8 • Draft active for 1 hour until saved` });
}

export function buildDraftActionRows(draft?: BlueprintDraftState): ActionRowBuilder<ButtonBuilder>[] {
  const hasStages = (draft?.stages.length ?? 0) > 0;
  const hasKoStage = Boolean(draft?.stages.some((s) => s.kind === 'KNOCKOUT'));

  const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('bp_ai_open')
      .setLabel('AI / Text Import')
      .setEmoji('🤖')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId('bp_add_groups')
      .setLabel('Add Groups Stage')
      .setEmoji('➕')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('bp_add_ko')
      .setLabel('Add Knockout Stage')
      .setEmoji('🏆')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('bp_pop_stage')
      .setLabel('Undo Stage')
      .setEmoji('↩️')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(!hasStages),
    new ButtonBuilder()
      .setCustomId('bp_toggle_ko_pairing')
      .setLabel('Cycle KO Pairing')
      .setEmoji('🎲')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(!hasKoStage)
  );

  const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('bp_save_draft')
      .setLabel('Save Blueprint')
      .setEmoji('💾')
      .setStyle(ButtonStyle.Success)
      .setDisabled(!hasStages),
    new ButtonBuilder()
      .setCustomId('bp_discard_draft')
      .setLabel('Discard')
      .setEmoji('🗑️')
      .setStyle(ButtonStyle.Danger)
  );

  return [row1, row2];
}

export function buildAiCompileModal(defaultName?: string): ModalBuilder {
  const modal = new ModalBuilder()
    .setCustomId('bp_modal_ai_compile')
    .setTitle('🤖 AI Tournament Blueprint Compiler');

  const nameInput = new TextInputBuilder()
    .setCustomId('bp_name')
    .setLabel('Blueprint Name (optional)')
    .setStyle(TextInputStyle.Short)
    .setRequired(false)
    .setMaxLength(80)
    .setPlaceholder('e.g. Meridian Challengers Cup');
  if (defaultName) nameInput.setValue(defaultName.slice(0, 80));

  const promptInput = new TextInputBuilder()
    .setCustomId('bp_prompt')
    .setLabel('Describe Format or Paste Compact DSL')
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(true)
    .setMaxLength(2000)
    .setPlaceholder('Example: 2 groups of 8 -> Top 3 each go to Winners Group, 4th-5th to Second Chance -> Semi-Finals -> Grand Final');

  modal.addComponents(
    new ActionRowBuilder<TextInputBuilder>().addComponents(nameInput),
    new ActionRowBuilder<TextInputBuilder>().addComponents(promptInput)
  );
  return modal;
}

export function buildAddGroupsModal(stageNum: number): ModalBuilder {
  const modal = new ModalBuilder()
    .setCustomId('bp_modal_add_groups')
    .setTitle(`➕ Add Groups Stage (Stage ${stageNum})`);

  const nameInput = new TextInputBuilder()
    .setCustomId('bp_grp_name')
    .setLabel('Stage Name')
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMaxLength(80)
    .setValue(stageNum === 1 ? 'Stage 1: Group Stage' : `Stage ${stageNum}: Second Round`);

  const specInput = new TextInputBuilder()
    .setCustomId('bp_grp_spec')
    .setLabel(stageNum === 1 ? 'Group Names (e.g. A, B or A)' : 'Group Routes (e.g. WINNERS=A:1-3+B:1-3)')
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(true)
    .setMaxLength(1000)
    .setPlaceholder(
      stageNum === 1
        ? 'A, B'
        : 'WINNERS=A:1-3+B:1-3\nSECOND=A:4-5+B:4-5+BEST(A:6,B:6)'
    );

  const legsInput = new TextInputBuilder()
    .setCustomId('bp_grp_legs')
    .setLabel('Legs per match (1 or 2)')
    .setStyle(TextInputStyle.Short)
    .setRequired(false)
    .setMaxLength(2)
    .setValue('1');

  const resetInput = new TextInputBuilder()
    .setCustomId('bp_grp_reset')
    .setLabel('Reset standings before stage? (yes/no)')
    .setStyle(TextInputStyle.Short)
    .setRequired(false)
    .setMaxLength(5)
    .setValue(stageNum === 1 ? 'no' : 'yes');

  modal.addComponents(
    new ActionRowBuilder<TextInputBuilder>().addComponents(nameInput),
    new ActionRowBuilder<TextInputBuilder>().addComponents(specInput),
    new ActionRowBuilder<TextInputBuilder>().addComponents(legsInput),
    new ActionRowBuilder<TextInputBuilder>().addComponents(resetInput)
  );
  return modal;
}

export function buildAddKnockoutModal(stageNum: number): ModalBuilder {
  const modal = new ModalBuilder()
    .setCustomId('bp_modal_add_ko')
    .setTitle(`🏆 Add Knockout Stage (Stage ${stageNum})`);

  const nameInput = new TextInputBuilder()
    .setCustomId('bp_ko_name')
    .setLabel('Stage Name')
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMaxLength(80)
    .setValue(`Stage ${stageNum}: Semi-Finals`);

  const tagInput = new TextInputBuilder()
    .setCustomId('bp_ko_tag')
    .setLabel('Round Tag (PLAY_IN/QUARTER_FINAL/SEMI_FINAL/FINAL)')
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMaxLength(20)
    .setValue('SEMI_FINAL');

  const modeInput = new TextInputBuilder()
    .setCustomId('bp_ko_mode')
    .setLabel('Pairing (SEEDED/CROSS_GROUP/RANDOM_DRAW/MANUAL)')
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMaxLength(20)
    .setValue('SEEDED');

  const specInput = new TextInputBuilder()
    .setCustomId('bp_ko_spec')
    .setLabel('Matchups or Qualifiers')
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(true)
    .setMaxLength(800)
    .setPlaceholder('A:1 vs B:2, B:1 vs A:2   OR   PREV_WIN:ALL');

  const legsInput = new TextInputBuilder()
    .setCustomId('bp_ko_legs')
    .setLabel('Legs (1 or 2)')
    .setStyle(TextInputStyle.Short)
    .setRequired(false)
    .setMaxLength(2)
    .setValue('1');

  modal.addComponents(
    new ActionRowBuilder<TextInputBuilder>().addComponents(nameInput),
    new ActionRowBuilder<TextInputBuilder>().addComponents(tagInput),
    new ActionRowBuilder<TextInputBuilder>().addComponents(modeInput),
    new ActionRowBuilder<TextInputBuilder>().addComponents(specInput),
    new ActionRowBuilder<TextInputBuilder>().addComponents(legsInput)
  );
  return modal;
}
