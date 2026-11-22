import { Message, EmbedBuilder } from 'discord.js';
import { CAMPUS_LOCATIONS, VEHICLE_CATALOG } from '../config/constants.js';
import { travelToLocation, getPlayerTravelCooldown } from '../engines/campusEngine.js';
import { buyVehicle } from '../engines/marketEngine.js';
import { formatK } from '../utils/formatHelper.js';
import { getEmoji } from '../utils/emojiHelper.js';

export async function handleLocationsCommand(message: Message) {
  const lines = Object.values(CAMPUS_LOCATIONS).map(loc => {
    return `${loc.emoji} **${loc.name}**\n` +
      `• Alias : \`-travel ${loc.alias}\`\n` +
      `• Description : *${loc.description}*\n` +
      `• Activities : ${loc.activities.join(' • ')}`;
  });

  const embed = new EmbedBuilder()
    .setColor('#2b2d31')
    .setTitle('Campus Directory!')
    .setDescription(
      '```\nUse -travel <alias> to travel to a facility\n```\n' +
      lines.join('\n\n')
    )
    .setFooter({ text: 'Beyond The Final Whistle • Football Campus' });

  await message.reply({ embeds: [embed] });
}

export async function handleTravelCommand(message: Message, args: string[]) {
  const targetAlias = args[0]?.toLowerCase();
  if (!targetAlias) {
    const valid = Object.keys(CAMPUS_LOCATIONS).map(k => `\`${k}\` (${CAMPUS_LOCATIONS[k].name})`).join(', ');
    return await message.reply(`❌ Please specify a destination. Example: \`-travel tc\` (Training Center).\n**Destinations:** ${valid}`);
  }

  if (!message.guild || !message.member) {
    return await message.reply('❌ Travel can only be executed inside a Discord server channel.');
  }

  const result = await travelToLocation(message.member, message.guild, targetAlias);
  if (result.embed) {
    await message.reply({ embeds: [result.embed] });
  } else {
    await message.reply(result.message);
  }
}

export async function handleShowroomCommand(message: Message) {
  const { cooldownMinutes, vehicleName } = await getPlayerTravelCooldown(message.author.id);
  const carEmoji = getEmoji(message.guild, 'car');
  const coinEmoji = getEmoji(message.guild, 'coin');

  const lines = VEHICLE_CATALOG.map(v => {
    const priceDisplay = Number(v.cost) >= 1000000 ? `${(Number(v.cost) / 1000000).toFixed(Number(v.cost) % 1000000 === 0 ? 0 : 2)}M ${coinEmoji}` : `${formatK(v.cost)} ${coinEmoji}`;
    return `${carEmoji} **${v.name}**\n` +
      `• Alias : ${v.key}\n` +
      `• Price : ${priceDisplay}\n` +
      `• Travel Cooldown : ${v.cooldownMinutes} min ⏱️`;
  });

  const embed = new EmbedBuilder()
    .setColor('#2b2d31')
    .setTitle('Vehicle Showroom!')
    .setDescription(
      '```\nUse -vehiclebuy <alias> to purchase a vehicle\n```\n' +
      `Current Ride : **${vehicleName}** (${cooldownMinutes}m cooldown ⏱️)\n\n` +
      lines.join('\n\n')
    )
    .setFooter({ text: 'Beyond The Final Whistle • Exotic Dealership' });

  await message.reply({ embeds: [embed] });
}

export async function handleVehicleBuyCommand(message: Message, args: string[]) {
  const alias = args[0]?.toLowerCase();
  if (!alias) {
    return await message.reply('❌ Usage: `-vehiclebuy <alias>`. Check available models with `-showroom`!');
  }

  const result = await buyVehicle(message.author.id, alias);
  await message.reply(result.message);
}
