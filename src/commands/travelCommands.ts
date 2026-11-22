import { Message, EmbedBuilder } from 'discord.js';
import { CAMPUS_LOCATIONS, VEHICLE_CATALOG } from '../config/constants.js';
import { travelToLocation, getPlayerTravelCooldown } from '../engines/campusEngine.js';
import { buyVehicle } from '../engines/marketEngine.js';
import { formatK } from '../utils/formatHelper.js';

export async function handleLocationsCommand(message: Message) {
  const lines = Object.values(CAMPUS_LOCATIONS).map(loc => {
    return `### ${loc.emoji} ${loc.name} (\`-travel ${loc.alias}\`)\n` +
      `*${loc.description}*\n` +
      `**Activities:**\n${loc.activities.map(a => `• \`${a}\``).join('\n')}`;
  });

  const embed = new EmbedBuilder()
    .setColor('#38bdf8')
    .setTitle('🗺️ Beyond The Final Whistle: Football Campus Directory')
    .setDescription(
      `Welcome to the Football Campus! You can move between facilities using \`-travel <alias>\`.\n\n` +
      lines.join('\n\n')
    )
    .setFooter({ text: 'Base cooldown: 20m ⏱️ • Slashed down by vehicles in the showroom' })
    .setTimestamp();

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

  const lines = VEHICLE_CATALOG.map(v => {
    const priceDisplay = Number(v.cost) >= 1000000 ? `${(Number(v.cost) / 1000000).toFixed(Number(v.cost) % 1000000 === 0 ? 0 : 2)}M 🪙` : `${formatK(v.cost)} 🪙`;
    return `${v.emoji} **${v.name}** (\`-vehiclebuy ${v.key}\`)\n` +
      `• Cost: **${priceDisplay}** | Cooldown: **${v.cooldownMinutes} min ⏱️**`;
  });

  const embed = new EmbedBuilder()
    .setColor('#e11d48')
    .setTitle('🏎️ Vehicle Showroom — Automotive Dealership')
    .setDescription(
      `Your current ride: **${vehicleName}** (\`${cooldownMinutes}m cooldown\` ⏱️)\n\n` +
      `Purchasing a vehicle permanently lowers your campus travel cooldown across all locations:\n\n` +
      lines.join('\n\n') +
      `\n\n*Purchase with:* \`-vehiclebuy <alias>\` (e.g. \`-vehiclebuy supra\`, \`-vehiclebuy 911\`)`
    )
    .setFooter({ text: 'Vehicles cannot be resold • Fastest ride automatically applies' })
    .setTimestamp();

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
