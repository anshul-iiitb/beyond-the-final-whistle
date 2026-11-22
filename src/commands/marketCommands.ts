import { Message } from 'discord.js';
import { buyMarketItem, claimIntelScouting } from '../engines/marketEngine.js';
import { getEmoji } from '../utils/emojiHelper.js';

export async function handleBuyCommand(message: Message, args: string[]) {
  const itemAlias = args[0];
  const coin = getEmoji(message.guild, 'coin');
  const sd = getEmoji(message.guild, 'sd');
  const strika = getEmoji(message.guild, 'strika');
  const passa = getEmoji(message.guild, 'passa');
  const bully = getEmoji(message.guild, 'bully');

  if (!itemAlias) {
    return await message.reply(
      '🛍️ **Global Market Catalog:**\n\n' +
      `• \`-buy sd\` — **${sd} Sports Drink** (+50 Stamina) | **100k ${coin}**\n` +
      `• \`-buy strika\` — **${strika} Strika Boots** (+10 Attack for next match) | **500k ${coin}**\n` +
      `• \`-buy passa\` — **${passa} Passa Boots** (+10 Midfield for next match) | **500k ${coin}**\n` +
      `• \`-buy bully\` — **${bully} Bully Boots** (+10 Defence for next match) | **500k ${coin}**\n\n` +
      '*Note: You must be at the Global Market (`-travel gm`) to purchase.*'
    );
  }

  const result = await buyMarketItem(message.author.id, itemAlias);
  await message.reply(result.message);
}

export async function handleIntelCommand(message: Message) {
  const result = await claimIntelScouting(message.author.id);
  await message.reply(result.message);
}
