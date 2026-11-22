import { Message, EmbedBuilder, AttachmentBuilder, Guild } from 'discord.js';
import path from 'path';
import fs from 'fs';
import { buyMarketItem, claimIntelScouting } from '../engines/marketEngine.js';
import { getEmoji } from '../utils/emojiHelper.js';

export function buildGlobalMarketEmbed(guild?: Guild | null) {
  const coin = getEmoji(guild, 'coin');
  const stamina = getEmoji(guild, 'stamina');
  const sd = getEmoji(guild, 'sd');
  const strika = getEmoji(guild, 'strika');
  const passa = getEmoji(guild, 'passa');
  const bully = getEmoji(guild, 'bully');

  const embed = new EmbedBuilder()
    .setColor('#2b2d31')
    .setTitle('Global Market!')
    .setDescription(
      '```\nUse -buy <alias> to buy an item\n```\n' +
      '⚠️⚠️ Boots effects won\'t appear if you already have +10 boost in that position.\n\n' +
      `${sd} **Sports Drink**\n` +
      `• Alias : sd\n` +
      `• Item info : Recovers 50 stamina ${stamina} (Upto 100)\n` +
      `• Price : 100k ${coin}\n\n` +
      `${strika} **Strika Boots**\n` +
      `• Alias : strika\n` +
      `• Item info : Gives an additional +10 attack boost for one match. (Note : This boots effects will worn off after user plays one match as attacker.)\n` +
      `• Price : 500k ${coin}\n\n` +
      `${passa} **Passa Boots**\n` +
      `• Alias : passa\n` +
      `• Item info : Gives an additional +10 midfield boost for one match. (Note : This boots effects will worn off after user plays one match as midfielder.)\n` +
      `• Price : 500k ${coin}\n\n` +
      `${bully} **Bully Boots**\n` +
      `• Alias : bully\n` +
      `• Item info : Gives an additional +10 defence boost for one match. (Note : This boots effects will worn off after user plays one match as defender.)\n` +
      `• Price : 500k ${coin}`
    );

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
