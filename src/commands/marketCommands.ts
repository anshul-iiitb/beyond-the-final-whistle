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
    .setTitle('🛍️ Global Market — Gear, Vehicle Showroom & Avatar Boutique')
    .setDescription(
      [
        'Your all-in-one commercial hub! Buy matchday gear, shop 16 exotic vehicles, and unlock collector banners.',
        `### 🥤 Matchday Gear & Stamina\n` +
        `${sd} **SPORTS DRINK** \`[ alias: sd ]\` — \`+50\` ${stamina} Stamina • **\`100k\`** ${coin}\n` +
        `${strika} **STRIKA BOOTS** \`[ alias: strika ]\` — \`+10 ATK\` next match • **\`500k\`** ${coin}\n` +
        `${passa} **PASSA BOOTS** \`[ alias: passa ]\` — \`+10 MID\` next match • **\`500k\`** ${coin}\n` +
        `${bully} **BULLY BOOTS** \`[ alias: bully ]\` — \`+10 DEF\` next match • **\`500k\`** ${coin}`,
        `### 🏎️ Dealership & Cosmetics (Located Inside Global Market)\n` +
        `• **16-Car Dealership:** Inspect with \`-showroom\` • Purchase with \`-vehiclebuy <alias>\`\n` +
        `• **Avatar & Banner Boutique:** Browse collector editions with \`-avatar\` • Buy with \`-avatarbuy <alias>\``,
        `${UI.DIVIDER}\n` +
        subtext('💡 Quick Buy: Run `-buy <alias>` for gear, `-vehiclebuy <alias>` for cars, or `-avatar` for cosmetics.')
      ].join(UI.SPACER)
    )
    .setFooter({
      text: 'Beyond The Final Whistle • Global Market',
      iconURL: guild?.client?.user?.displayAvatarURL?.() || undefined
    })
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
