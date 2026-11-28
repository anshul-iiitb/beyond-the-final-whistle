import { Message, EmbedBuilder } from 'discord.js';
import { prisma } from '../database/prisma.js';
import { compileTextToBlueprint } from '../tournaments/blueprintAiCompiler.js';
import {
  BlueprintDefinitionSchema,
  BlueprintStage,
  formatBlueprintStagesLines,
  slugifyBlueprintName,
} from '../tournaments/blueprintTypes.js';
import { sendThinkingMessage, updateLoadingMessage } from '../utils/loadingHelper.js';
import { logger } from '../utils/logger.js';

export async function handleBlueprintCommand(message: Message, args: string[]) {
  const sub = args[0]?.toLowerCase();

  if (!sub || sub === 'help') {
    const helpEmbed = new EmbedBuilder()
      .setColor('#a855f7')
      .setTitle('🧩 Tournament Blueprint Engine')
      .setDescription(
        `Create custom multi-stage tournament formats dynamically using OpenRouter AI or compact DSL syntax!\n\n` +
        `**Commands:**\n` +
        `• \`-blueprint create <slug> <description/rules>\` — Compile tournament rules with AI\n` +
        `• \`-blueprint view <slug>\` — Preview stages, groups & routing rules\n` +
        `• \`-blueprint list\` — Browse saved tournament blueprints\n` +
        `• \`-blueprint delete <slug>\` — Delete a custom blueprint\n\n` +
        `**Examples:**\n` +
        `\`-blueprint create champions-cup 2 Groups of 4 teams -> Top 2 from each group advance to Semi-Finals -> Grand Final\`\n` +
        `\`-blueprint create world-cup 4 Groups (A,B,C,D) -> Top 2 each to Quarter-Finals -> Semi-Finals -> Final\``
      )
      .setFooter({ text: 'Beyond The Final Whistle • Blueprint Compiler' });
    await message.reply({ embeds: [helpEmbed] });
    return;
  }

  // LIST BLUEPRINTS
  if (sub === 'list' || sub === 'ls') {
    const bps = await prisma.tournamentBlueprint.findMany({
      orderBy: { createdAt: 'desc' },
      take: 25,
    });

    if (bps.length === 0) {
      await message.reply('ℹ️ No tournament blueprints found. Create your first blueprint with `-blueprint create <slug> <rules>`.');
      return;
    }

    const embed = new EmbedBuilder()
      .setColor('#a855f7')
      .setTitle('🧩 Tournament Blueprints Library')
      .setDescription(
        bps
          .map((b, i) => {
            const stages = typeof b.stagesJson === 'string' ? JSON.parse(b.stagesJson) : b.stagesJson;
            const stageCount = Array.isArray(stages) ? stages.length : 0;
            return `**${i + 1}. \`${b.slug}\`** — **${b.name}** (${stageCount} Stages)\n${b.description ? `*${b.description}*` : '*No description*'}`;
          })
          .join('\n\n')
      )
      .setFooter({ text: `Total Blueprints: ${bps.length} • Use -blueprint view <slug>` });

    await message.reply({ embeds: [embed] });
    return;
  }

  // VIEW BLUEPRINT
  if (sub === 'view' || sub === 'show' || sub === 'info') {
    const slug = args[1]?.toLowerCase();
    if (!slug) {
      await message.reply('⚠️ Please specify a blueprint slug. Usage: `-blueprint view <slug>`.');
      return;
    }

    const bp = await prisma.tournamentBlueprint.findUnique({ where: { slug } });
    if (!bp) {
      await message.reply(`❌ Blueprint \`${slug}\` not found. Check \`-blueprint list\`.`);
      return;
    }

    const stagesRaw = typeof bp.stagesJson === 'string' ? JSON.parse(bp.stagesJson) : bp.stagesJson;
    const stages: BlueprintStage[] = BlueprintDefinitionSchema.shape.stages.parse(stagesRaw);
    const stageLines = formatBlueprintStagesLines(stages);

    const embed = new EmbedBuilder()
      .setColor('#a855f7')
      .setTitle(`🧩 Blueprint: ${bp.name}`)
      .setDescription(
        (bp.description ? `*${bp.description}*\n\n` : '') +
        `**Slug:** \`${bp.slug}\`\n` +
        `**Stages (${stages.length}):**\n` +
        stageLines.map((l) => `• ${l}`).join('\n\n') +
        `\n\n*Apply this blueprint to any tournament with \`-tourney blueprint <name> ${bp.slug}\`.*`
      )
      .setFooter({ text: `Beyond The Final Whistle • Created ${new Date(bp.createdAt).toLocaleDateString()}` });

    await message.reply({ embeds: [embed] });
    return;
  }

  // DELETE BLUEPRINT
  if (sub === 'delete' || sub === 'del' || sub === 'remove') {
    const slug = args[1]?.toLowerCase();
    if (!slug) {
      await message.reply('⚠️ Please specify a blueprint slug. Usage: `-blueprint delete <slug>`.');
      return;
    }

    const existing = await prisma.tournamentBlueprint.findUnique({ where: { slug } });
    if (!existing) {
      await message.reply(`❌ Blueprint \`${slug}\` does not exist.`);
      return;
    }

    await prisma.tournamentBlueprint.delete({ where: { slug } });
    await message.reply(`✅ Deleted tournament blueprint \`${slug}\`.`);
    return;
  }

  // CREATE BLUEPRINT (AI COMPILER + DSL FALLBACK)
  if (sub === 'create' || sub === 'create_ai' || sub === 'ai' || sub === 'new') {
    const slug = slugifyBlueprintName(args[1] || '');
    const rules = args.slice(2).join(' ').trim();

    if (!slug || !rules) {
      await message.reply(
        '⚠️ Missing arguments! Usage: `-blueprint create <slug> <description or tournament rules>`\n' +
        'Example: `-blueprint create champions-cup 2 Groups of 4 -> Top 2 advance to Semi-Finals -> Grand Final`'
      );
      return;
    }

    const thinking = await sendThinkingMessage(
      message,
      `Compiling tournament blueprint "${slug}" with OpenRouter AI...`
    );

    try {
      const { blueprint, compiler } = await compileTextToBlueprint(rules, slug);

      const saved = await prisma.tournamentBlueprint.upsert({
        where: { slug: blueprint.name ? slugifyBlueprintName(blueprint.name) : slug },
        update: {
          name: blueprint.name,
          description: blueprint.description || rules,
          stagesJson: JSON.stringify(blueprint.stages),
        },
        create: {
          slug: blueprint.name ? slugifyBlueprintName(blueprint.name) : slug,
          name: blueprint.name,
          description: blueprint.description || rules,
          stagesJson: JSON.stringify(blueprint.stages),
          createdById: message.author.id,
        },
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
        .setFooter({ text: 'Beyond The Final Whistle • AI Blueprint Engine' })
        .setTimestamp();

      await updateLoadingMessage(thinking, { embeds: [successEmbed] });
    } catch (err: any) {
      logger.error({ err: err.message }, 'Blueprint AI compiler error');
      const errorEmbed = new EmbedBuilder()
        .setColor('#ef4444')
        .setTitle('❌ Blueprint Compilation Failed')
        .setDescription(`**Error:** ${err.message}\n\n*Tip: Try being more specific with group letters, qualifiers, and knockout rounds.*`);
      await updateLoadingMessage(thinking, { embeds: [errorEmbed] });
    }
    return;
  }

  await message.reply('⚠️ Unknown blueprint command. Run `-blueprint help` for syntax.');
}
