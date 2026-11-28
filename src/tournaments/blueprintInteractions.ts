import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonInteraction,
  ButtonStyle,
  ModalSubmitInteraction,
} from 'discord.js';
import {
  clearBlueprintDraft,
  getBlueprintDraft,
  saveBlueprintToDb,
  setBlueprintDraft,
} from './blueprintStoreService.js';
import {
  compileTextToBlueprint,
  parseCompactDslToBlueprint,
} from './blueprintAiCompiler.js';
import { PairingMode } from './blueprintTypes.js';
import {
  buildAddGroupsModal,
  buildAddKnockoutModal,
  buildAiCompileModal,
  buildDraftActionRows,
  buildDraftBuilderEmbed,
} from './blueprintUiBuilder.js';
import { sendThinkingMessage, updateLoadingMessage } from '../utils/loadingHelper.js';

const PAIRING_ORDER: PairingMode[] = ['SEEDED', 'CROSS_GROUP', 'RANDOM_DRAW', 'MANUAL'];

function ensureOrCreateDraft(userId: string) {
  return (
    getBlueprintDraft(userId) ||
    setBlueprintDraft({
      userId,
      name: 'Custom Blueprint',
      stages: [],
    })
  );
}

export async function handleBlueprintButton(interaction: ButtonInteraction): Promise<void> {
  const userId = interaction.user.id;
  const id = interaction.customId;
  const existing = getBlueprintDraft(userId);

  if (id === 'bp_ai_open') {
    await interaction.showModal(buildAiCompileModal(existing?.name));
    return;
  }
  if (id === 'bp_add_groups') {
    const nextNum = (existing?.stages.length ?? 0) + 1;
    await interaction.showModal(buildAddGroupsModal(nextNum));
    return;
  }
  if (id === 'bp_add_ko') {
    const nextNum = (existing?.stages.length ?? 0) + 1;
    await interaction.showModal(buildAddKnockoutModal(nextNum));
    return;
  }

  await interaction.deferUpdate();

  if (id === 'bp_discard_draft') {
    clearBlueprintDraft(userId);
    await interaction.editReply({
      content: '🗑️ Blueprint draft discarded.',
      embeds: [],
      components: [],
    });
    return;
  }

  if (!existing) {
    await interaction.followUp({ content: '❌ Your blueprint draft expired. Run `-blueprint create` to start again.', ephemeral: true });
    return;
  }

  if (id === 'bp_pop_stage') {
    const next = setBlueprintDraft({
      ...existing,
      stages: existing.stages.slice(0, -1),
    });
    await interaction.editReply({
      embeds: [buildDraftBuilderEmbed(next)],
      components: buildDraftActionRows(next),
    });
    return;
  }

  if (id === 'bp_toggle_ko_pairing') {
    const koIndices = existing.stages
      .map((s, idx) => (s.kind === 'KNOCKOUT' ? idx : -1))
      .filter((idx) => idx >= 0);

    if (koIndices.length === 0) {
      await interaction.followUp({ content: 'ℹ️ Add at least one Knockout stage before toggling pairing mode.', ephemeral: true });
      return;
    }

    const updatedStages = [...existing.stages];
    const targetIdx = koIndices[koIndices.length - 1];
    const st = updatedStages[targetIdx];
    if (st.kind === 'KNOCKOUT') {
      const nextMode = PAIRING_ORDER[(PAIRING_ORDER.indexOf(st.pairingMode) + 1) % PAIRING_ORDER.length];
      updatedStages[targetIdx] = { ...st, pairingMode: nextMode };
    }
    const next = setBlueprintDraft({ ...existing, stages: updatedStages });
    await interaction.editReply({
      embeds: [buildDraftBuilderEmbed(next)],
      components: buildDraftActionRows(next),
    });
    return;
  }

  if (id === 'bp_save_draft') {
    if (existing.stages.length === 0) {
      await interaction.followUp({ content: '❌ Add at least 1 stage before saving.', ephemeral: true });
      return;
    }
    try {
      const saved = await saveBlueprintToDb({
        name: existing.name,
        description: existing.description,
        stages: existing.stages,
        createdById: userId,
      });

      clearBlueprintDraft(userId);
      await interaction.editReply({
        content: `💾 **Blueprint Saved Successfully!**\nName: **${saved.name}** (\`${saved.slug}\`)\n` +
          `You can now use it in tournaments with \`-tourney create <name> NATION ${saved.slug}\` or \`-tourney create <name> CLUB ${saved.slug}\`!`,
        embeds: [buildDraftBuilderEmbed(existing)],
        components: [],
      });
    } catch (err: any) {
      await interaction.followUp({ content: `❌ ${err?.message || 'Failed to save blueprint.'}`, ephemeral: true });
    }
  }
}

export async function handleBlueprintModalSubmit(interaction: ModalSubmitInteraction): Promise<void> {
  const userId = interaction.user.id;
  const id = interaction.customId;

  if (id === 'bp_modal_ai_compile') {
    await sendThinkingMessage(interaction, 'Compiling tournament blueprint with AI & DSL parser...');
    const existing = getBlueprintDraft(userId);
    const nameInput = interaction.fields.getTextInputValue('bp_name').trim();
    const promptInput = interaction.fields.getTextInputValue('bp_prompt').trim();
    const preferredName = nameInput || existing?.name || 'AI Custom Blueprint';

    try {
      const { blueprint: compiled, compiler } = await compileTextToBlueprint(promptInput, preferredName);
      const draft = setBlueprintDraft({
        userId,
        name: compiled.name,
        description: compiled.description,
        stages: compiled.stages,
      });
      await updateLoadingMessage(interaction, {
        content: `✨ **Compiled Blueprint Preview** *(via ${compiler})* — review stages below, customize or click **Save Blueprint**!`,
        embeds: [buildDraftBuilderEmbed(draft)],
        components: buildDraftActionRows(draft),
      });
    } catch (err: any) {
      await updateLoadingMessage(interaction, `❌ ${err?.message || 'Could not compile tournament description.'}`);
    }
    return;
  }

  await sendThinkingMessage(interaction, 'Updating blueprint stage...', true);
  const draft = ensureOrCreateDraft(userId);

  if (id === 'bp_modal_add_groups') {
    const stName = interaction.fields.getTextInputValue('bp_grp_name').trim();
    const specRaw = interaction.fields.getTextInputValue('bp_grp_spec').trim();
    const legs = interaction.fields.getTextInputValue('bp_grp_legs').trim() === '2' ? 2 : 1;
    const resetVal = interaction.fields.getTextInputValue('bp_grp_reset').trim().toLowerCase();
    const resetStr = resetVal === 'yes' || resetVal === 'true' || resetVal === '1' ? 'true' : 'false';
    const normalizedSpec = specRaw.includes('=') ? specRaw.replace(/\r?\n+/g, ' ; ') : specRaw;

    const dsl = `GROUPS "${stName.replace(/"/g, "'")}" | ${normalizedSpec} | legs:${legs} | reset:${resetStr}`;
    const parsed = parseCompactDslToBlueprint(dsl, draft.name);
    if (!parsed || parsed.stages.length === 0) {
      await updateLoadingMessage(interaction, '❌ Invalid groups spec. Use `A, B` or routing rules like `WINNERS=A:1-3+B:1-3; SECOND=A:4-5+B:4-5`.');
      return;
    }
    const next = setBlueprintDraft({ ...draft, stages: [...draft.stages, parsed.stages[0]] });
    if (interaction.message && interaction.message.editable) {
      await interaction.message.edit({ embeds: [buildDraftBuilderEmbed(next)], components: buildDraftActionRows(next) }).catch(() => null);
    }
    await updateLoadingMessage(interaction, { content: `✅ Added **${parsed.stages[0].name}** (${next.stages.length} stage(s) total).` });
    return;
  }

  if (id === 'bp_modal_add_ko') {
    const stName = interaction.fields.getTextInputValue('bp_ko_name').trim();
    const tag = interaction.fields.getTextInputValue('bp_ko_tag').trim().toUpperCase();
    const mode = interaction.fields.getTextInputValue('bp_ko_mode').trim().toUpperCase();
    const specRaw = interaction.fields.getTextInputValue('bp_ko_spec').trim();
    const legs = interaction.fields.getTextInputValue('bp_ko_legs').trim() === '2' ? 2 : 1;
    const pairSpec = /\bvs\b/i.test(specRaw) ? specRaw : specRaw.replace(/,\s*(?![^()]*\))/g, ' ');

    const dsl = `KO "${stName.replace(/"/g, "'")}" | ${tag} | ${mode} | ${pairSpec}`;
    const parsed = parseCompactDslToBlueprint(dsl, draft.name);
    if (!parsed || parsed.stages.length === 0) {
      await updateLoadingMessage(interaction, '❌ Invalid knockout spec. Use `A:1 vs B:2` or qualifiers like `PREV_WIN:ALL`.');
      return;
    }
    const stage = parsed.stages[0];
    if (stage.kind === 'KNOCKOUT') stage.legs = legs;

    const next = setBlueprintDraft({ ...draft, stages: [...draft.stages, stage] });
    if (interaction.message && interaction.message.editable) {
      await interaction.message.edit({ embeds: [buildDraftBuilderEmbed(next)], components: buildDraftActionRows(next) }).catch(() => null);
    }
    await updateLoadingMessage(interaction, { content: `✅ Added **${stage.name}** (${next.stages.length} stage(s) total).` });
  }
}
