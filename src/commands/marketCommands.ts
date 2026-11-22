import { Message } from 'discord.js';
import { buyMarketItem, claimIntelScouting } from '../engines/marketEngine.js';

export async function handleBuyCommand(message: Message, args: string[]) {
  const itemAlias = args[0];
  if (!itemAlias) {
    return await message.reply(
      '🛍️ **Global Market Catalog:**\n' +
      '• `-buy sd` — **Sports Drink** (+50 Stamina, 100k 🪙)\n' +
      '• `-buy strika` — **Strika Boots** (+10 ATK next match, 500k 🪙)\n' +
      '• `-buy passa` — **Passa Boots** (+10 MID next match, 500k 🪙)\n' +
      '• `-buy bully` — **Bully Boots** (+10 DEF next match, 500k 🪙)\n\n' +
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
