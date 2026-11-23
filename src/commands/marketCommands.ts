import { Message, EmbedBuilder, AttachmentBuilder, Guild } from 'discord.js';
import path from 'path';
import fs from 'fs';
import { buyMarketItem, claimIntelScouting } from '../engines/marketEngine.js';
import { getEmoji } from '../utils/emojiHelper.js';
import { THEME_COLORS, UI, subtext } from '../utils/themeHelper.js';

export function buildGlobalMarketEmbed(guild?: Guild | null) {
  const coin = getEmoji(guild, 'coin');
  const stamina = getEmoji(guild, 'stamina');
  const sd = getEmoji(guild, 'sd');
  const strika = getEmoji(guild, 'strika');
  const passa = getEmoji(guild, 'passa');
  const bully = getEmoji(guild, 'bully');

  const embed = new EmbedBuilder()
    .setColor(THEME_COLORS.EMERALD)
    .setTitle('🛍️ Global Marketplace — Matchday Gear & Stamina')
    .setDescription(
      `Equip matchday performance cleats and sports drinks to maximize match ratings!\n\n` +
      `${sd} **SPORTS DRINK** \`[ alias: sd ]\`\n` +
      `> *Instant bio-electrolyte hydration restoring player stamina.*\n` +
      `• **Restores:** \`+50\` ${stamina} Stamina (up to 100 max)\n` +
      `• **Price:** \`100k\` ${coin}\n\n` +
      `${strika} **STRIKA BOOTS** \`[ alias: strika ]\`\n` +
      `> *Precision carbon-plate cleats giving lethal attacking instinct.*\n` +
      `• **Match Boost:** \`+10 Attack\` (Applied next match as Attacker)\n` +
      `• **Price:** \`500k\` ${coin}\n\n` +
      `${passa} **PASSA BOOTS** \`[ alias: passa ]\`\n` +
      `> *High-friction textured boots engineered for pinpoint ball distribution.*\n` +
      `• **Match Boost:** \`+10 Midfield\` (Applied next match as Midfielder)\n` +
      `• **Price:** \`500k\` ${coin}\n\n` +
      `${bully} **BULLY BOOTS** \`[ alias: bully ]\`\n` +
      `> *Reinforced composite studs for dominating physical challenges & tackles.*\n` +
      `• **Match Boost:** \`+10 Defence\` (Applied next match as Defender)\n` +
      `• **Price:** \`500k\` ${coin}\n\n` +
      `${UI.DIVIDER}\n` +
      subtext('💡 Quick Buy: Run `-buy <alias>` (e.g. `-buy sd` or `-buy strika`). Boots reset after matchday.')
    )
    .setFooter({ text: 'Beyond The Final Whistle • Global Market' })
    .setTimestamp();

  const cartPath = path.resolve('assets/cart.png');
  const files: AttachmentBuilder[] = [];
  if (fs.existsSync(cartPath)) {
    files.push(new AttachmentBuilder(cartPath, { name: 'cart.png' }));
    embed.setThumbnail('attachment://cart.png');
  }

  return { embed, files };
}

export async function handleBuyCommand(message: Message, args: string[]) {
  const itemAlias = args[0];

  if (!itemAlias) {
    const market = buildGlobalMarketEmbed(message.guild);
    return await message.reply({ embeds: [market.embed], files: market.files });
  }

  const result = await buyMarketItem(message.author.id, itemAlias);
  await message.reply(result.message);
}

export async function handleIntelCommand(message: Message) {
  const result = await claimIntelScouting(message.author.id);
  await message.reply(result.message);
}
