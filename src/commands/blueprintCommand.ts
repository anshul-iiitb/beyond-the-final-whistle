import { Message, EmbedBuilder, AttachmentBuilder } from 'discord.js';
import { compileTextToBlueprint } from '../tournaments/blueprintAiCompiler.js';
import {
  BlueprintDefinitionSchema,
  BlueprintStage,
  formatBlueprintStagesLines,
  slugifyBlueprintName,
} from '../tournaments/blueprintTypes.js';
import {
  buildBlueprintPreviewEmbed,
  deleteBlueprintBySlug,
  getBlueprintBySlugOrName,
  getBlueprintDraft,
  listAllBlueprints,
  saveBlueprintToDb,
  setBlueprintDraft,
} from '../tournaments/blueprintStoreService.js';
import {
  buildDraftActionRows,
  buildDraftBuilderEmbed,
} from '../tournaments/blueprintUiBuilder.js';
import { sendThinkingMessage, updateLoadingMessage } from '../utils/loadingHelper.js';
import { logger } from '../utils/logger.js';

export async function handleBlueprintCommand(message: Message, args: string[]) {
  const sub = args[0]?.toLowerCase();

  if (!sub || sub === 'help') {
    const helpEmbed = new EmbedBuilder()
      .setColor('#a855f7')
      .setTitle('🧩 Tournament Blueprint Engine')
      .setDescription(
        `Create custom multi-stage tournament formats dynamically using the interactive Stage Builder, OpenRouter AI, or compact DSL syntax!\n\n` +
        `**Commands:**\n` +
        `• \`-blueprint create [name]\` — Open interactive step-by-step Stage Builder UI\n` +
        `• \`-blueprint create <slug> <description>\` — Auto-compile tournament rules from text\n` +
        `• \`-blueprint view <slug>\` — Preview stages, groups & routing rules\n` +
        `• \`-blueprint list\` / \`-blueprint presets\` — Browse saved & built-in blueprints\n` +
        `• \`-blueprint delete <slug>\` — Delete a custom blueprint\n` +
        `• \`-blueprint export <slug>\` — Export blueprint definition as JSON\n` +
        `• \`-blueprint import <json>\` — Import blueprint definition from JSON\n\n` +
        `**Examples:**\n` +
        `\`-blueprint create "Super Cup"\` *(Opens UI builder with buttons & modals)*\n` +
        `\`-blueprint create round-robin All teams play each other in a round-robin league -> 2nd vs 3rd Qualifier -> 1st vs Qualifier Winner in Grand Final\`\n` +
        `\`-blueprint create champions-cup 2 Groups of 4 teams -> Top 2 advance to Semi-Finals -> Grand Final\``
      )
      .setFooter({ text: 'Beyond The Final Whistle • Tournament Blueprint Engine' });
    await message.reply({ embeds: [helpEmbed] });
    return;
  }

  // 1. INTERACTIVE BUILDER (when user types `-blueprint builder` or `-blueprint create` with <= 1 arg)
  if (sub === 'builder' || (sub === 'create' && args.length <= 2)) {
    const rawName = args.slice(1).join(' ').trim();
    const existing = getBlueprintDraft(message.author.id);
    const draft = rawName || !existing
      ? setBlueprintDraft({
          userId: message.author.id,
          name: rawName || existing?.name || 'Custom Tournament',
          description: existing?.description,
          stages: rawName && existing && rawName !== existing.name ? [] : existing?.stages || [],
        })
      : existing;

    await message.reply({
      content: `🛠️ **Tournament Blueprint Builder: ${draft.name}**\nUse the interactive buttons below to add group stages, knockout brackets, or import format text:`,
      embeds: [buildDraftBuilderEmbed(draft)],
      components: buildDraftActionRows(draft),
    });
    return;
  }

  // 2. CREATE BLUEPRINT (via AI compiler, heuristics, or compact DSL)
  if (sub === 'create' || sub === 'create_ai' || sub === 'ai' || sub === 'new') {
    const slug = slugifyBlueprintName(args[1] || '');
    const rules = args.slice(2).join(' ').trim();

    if (!slug || !rules) {
      await message.reply(
        '⚠️ Missing arguments! Usage:\n' +
        '• Interactive UI: `-blueprint create` (or `-blueprint create "My Cup"`)\n' +
        '• Direct text/AI: `-blueprint create <slug> <tournament format rules>`'
      );
      return;
    }

    const thinking = await sendThinkingMessage(
      message,
      `Compiling tournament blueprint "${slug}" with AI & rules engine...`
    );

    try {
      const { blueprint, compiler } = await compileTextToBlueprint(rules, slug);

      const saved = await saveBlueprintToDb({
        name: blueprint.name,
        description: blueprint.description || rules,
        stages: blueprint.stages,
        createdById: message.author.id,
      });

      const stageLines = formatBlueprintStagesLines(blueprint.stages);

      const successEmbed = new EmbedBuilder()
        .setColor('#22c55e')
        .setTitle(`✅ Blueprint Created: ${saved.name}`)
        .setDescription(
          (saved.description ? `*${saved.description}*\n\n` : '') +
          `**Slug:** \`${saved.slug}\` • **Compiler:** \`${compiler}\`\n\n` +
          `**Compiled Stages (${blueprint.stages.length}):**\n` +
          stageLines.map((l) => `• ${l}`).join('\n\n') +
          `\n\n**Next Steps:**\n` +
          `1. Create tournament: \`-tourney create "World Cup" NATION ${saved.slug}\`\n` +
          `2. Enroll nations: \`-tourney enroll "World Cup" all\`\n` +
          `3. Generate fixtures: \`-tourney schedule "World Cup"\``
        )
        .setFooter({ text: 'Beyond The Final Whistle • Blueprint Engine' })
        .setTimestamp();

      await updateLoadingMessage(thinking, { embeds: [successEmbed] });
    } catch (err: any) {
      logger.error({ err: err.message }, 'Blueprint compiler error');
      const errorEmbed = new EmbedBuilder()
        .setColor('#ef4444')
        .setTitle('❌ Blueprint Compilation Failed')
        .setDescription(`**Error:** ${err.message}\n\n*Tip: Try describing group stages, qualifiers, and knockout rounds, or use the interactive builder with \`-blueprint create\`.*`);
      await updateLoadingMessage(thinking, { embeds: [errorEmbed] });
    }
    return;
  }

  // 3. LIST BLUEPRINTS / PRESETS
  if (sub === 'list' || sub === 'ls' || sub === 'presets') {
    const { builtins, custom } = await listAllBlueprints();

    const builtinLines = builtins.map(
      (b) => `• **${b.name}** (\`${b.slug}\`)\n  ${b.description || `${b.stages.length} stage(s)`}`
    );
    const customLines = custom.length > 0
      ? custom.map((s) => `• **${s.name}** (\`${s.slug}\`)${s.description ? `\n  *${s.description}*` : ''}`)
      : ['*No custom server blueprints saved yet. Use `-blueprint create` to start!*'];

    const embed = new EmbedBuilder()
      .setColor('#a855f7')
      .setTitle('🧩 Tournament Blueprints & Presets')
      .addFields(
        { name: '🏛️ Built-In Presets', value: builtinLines.join('\n\n').slice(0, 1024), inline: false },
        { name: '💾 Saved Custom Blueprints', value: customLines.join('\n\n').slice(0, 1024), inline: false },
        {
          name: '⚡ Quick Usage',
          value:
            '• `-blueprint create` — Open interactive Stage Builder UI\n' +
            '• `-blueprint view <slug>` — Preview stage routing & pairings\n' +
            '• `-tourney create "My Cup" NATION <slug>` — Create tournament using blueprint',
          inline: false,
        }
      )
      .setFooter({ text: `Total: ${builtins.length + custom.length} formats available` });

    await message.reply({ embeds: [embed] });
    return;
  }

  // 4. VIEW BLUEPRINT
  if (sub === 'view' || sub === 'show' || sub === 'info') {
    const slug = args[1]?.toLowerCase();
    if (!slug) {
      await message.reply('⚠️ Please specify a blueprint slug. Usage: `-blueprint view <slug>`.');
      return;
    }

    const bp = await getBlueprintBySlugOrName(slug);
    if (!bp) {
      await message.reply(`❌ Blueprint \`${slug}\` not found. Check \`-blueprint list\`.`);
      return;
    }

    const tag = bp.isBuiltin ? `Built-In Preset • ${bp.slug}` : `Saved Blueprint • ${bp.slug}`;
    await message.reply({
      embeds: [buildBlueprintPreviewEmbed({ ...bp, description: bp.description || undefined }, tag)],
    });
    return;
  }

  // 5. DELETE BLUEPRINT
  if (sub === 'delete' || sub === 'del' || sub === 'remove') {
    const slug = args[1]?.toLowerCase();
    if (!slug) {
      await message.reply('⚠️ Please specify a blueprint slug. Usage: `-blueprint delete <slug>`.');
      return;
    }

    const deleted = await deleteBlueprintBySlug(slug);
    if (!deleted) {
      await message.reply(`❌ Custom blueprint \`${slug}\` not found (built-in presets cannot be deleted).`);
      return;
    }

    await message.reply(`🗑️ Successfully deleted custom blueprint \`${slug}\`.`);
    return;
  }

  // 6. EXPORT BLUEPRINT (as JSON)
  if (sub === 'export' || sub === 'json') {
    const slug = args[1]?.toLowerCase();
    if (!slug) {
      await message.reply('⚠️ Please specify a blueprint slug. Usage: `-blueprint export <slug>`.');
      return;
    }

    const bp = await getBlueprintBySlugOrName(slug);
    if (!bp) {
      await message.reply(`❌ Blueprint \`${slug}\` not found.`);
      return;
    }

    const json = JSON.stringify({ name: bp.name, description: bp.description, stages: bp.stages }, null, 2);
    if (json.length <= 1850) {
      await message.reply(`📤 **Exported Blueprint \`${bp.slug}\`:**\n\`\`\`json\n${json}\n\`\`\``);
    } else {
      const file = new AttachmentBuilder(Buffer.from(json, 'utf-8'), { name: `${bp.slug}.blueprint.json` });
      await message.reply({ content: `📤 **Exported Blueprint \`${bp.slug}\`:**`, files: [file] });
    }
    return;
  }

  // 7. IMPORT BLUEPRINT (from JSON)
  if (sub === 'import') {
    const rawJson = args.slice(1).join(' ').trim();
    if (!rawJson) {
      await message.reply('⚠️ Usage: `-blueprint import <json>`');
      return;
    }

    try {
      const cleaned = rawJson.replace(/^```(?:json)?\s*/i, '').replace(/```$/i, '').trim();
      const parsed = BlueprintDefinitionSchema.parse(JSON.parse(cleaned));
      const saved = await saveBlueprintToDb({
        name: parsed.name,
        description: parsed.description,
        stages: parsed.stages,
        createdById: message.author.id,
      });

      await message.reply({
        content: `📥 Imported & saved Blueprint **${saved.name}** (slug: \`${saved.slug}\`).`,
        embeds: [buildBlueprintPreviewEmbed({ name: saved.name, description: saved.description || undefined, stages: parsed.stages }, `Imported • ${saved.slug}`)],
      });
    } catch (err: any) {
      await message.reply(`❌ Failed to import blueprint JSON: ${err.message}`);
    }
    return;
  }

  await message.reply('⚠️ Unknown blueprint command. Run `-blueprint help` for syntax.');
}
