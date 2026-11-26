import { Message, EmbedBuilder, AttachmentBuilder } from 'discord.js';
import path from 'path';
import fs from 'fs';
import { CAMPUS_LOCATIONS, VEHICLE_CATALOG } from '../config/constants.js';
import { travelToLocation, getPlayerTravelCooldown } from '../engines/campusEngine.js';
import { buyVehicle } from '../engines/marketEngine.js';
import { formatK } from '../utils/formatHelper.js';
import { getEmoji } from '../utils/emojiHelper.js';
import { THEME_COLORS, UI, subtext } from '../utils/themeHelper.js';

export async function handleLocationsCommand(message: Message) {
  const lines = Object.values(CAMPUS_LOCATIONS).map(loc => {
    return `${loc.emoji} **${loc.name.toUpperCase()}** \`[-travel ${loc.alias}]\`\n` +
      `> *${loc.description}*\n` +
      `• **Activities:** ${loc.activities.join(' • ')}`;
  });

  const embed = new EmbedBuilder()
    .setColor(THEME_COLORS.PRIMARY)
    .setTitle('🏟️ Football Campus Directory & Spatial Facilities')
    .setDescription(
      `Fast-travel between campus facilities to train, recover, trade, and sign sponsor contracts.\n\n` +
      lines.join('\n\n') +
      `\n\n${UI.DIVIDER}\n` +
      subtext('💡 Travel syntax: `-travel <alias>` (e.g. `-travel tc` for Training Center). Cooldown reduced by vehicles.')
    )
    .setFooter({ text: 'Beyond The Final Whistle • Football Campus' })
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
  const coinEmoji = getEmoji(message.guild, 'coin');

  const lines = VEHICLE_CATALOG.map(v => {
    const millions = Number(v.cost) / 1000000;
    const priceDisplay = Number(v.cost) >= 1000000
      ? `${millions % 1 === 0 ? millions : parseFloat(millions.toFixed(2))}M`
      : `${formatK(v.cost)}`;

    const frontEmoji = getEmoji(message.guild, `${v.key}front`);
    const backEmoji = getEmoji(message.guild, `${v.key}back`);
    const hasSplitEmoji = frontEmoji.includes('<:') && backEmoji.includes('<:');
    const displayEmoji = hasSplitEmoji ? `${frontEmoji}${backEmoji}` : v.emoji;

    return `${displayEmoji} **${v.name.toUpperCase()}** \`[ alias: ${v.key} ]\`\n` +
      `• **Campus Cooldown:** \`${v.cooldownMinutes} min\` ⏱️   •   **Price:** \`${priceDisplay}\` ${coinEmoji}`;
  });

  const fleetPath = path.resolve(process.cwd(), 'assets/branding/showroom_fleet.png');
  const files: AttachmentBuilder[] = [];

  const embed = new EmbedBuilder()
    .setColor(THEME_COLORS.SCARLET)
    .setTitle('🏎️ Luxury Dealership — Exotic Supercars & Hypercars')
    .setDescription(
      `🚗 **Current Ride:** \`${vehicleName}\` • **Campus Cooldown:** \`${cooldownMinutes}m\`\n` +
      `Acquire vehicles to slash travel cooldowns between campus facilities down to 1 minute!\n\n` +
      lines.join('\n\n') +
      `\n\n${UI.DIVIDER}\n` +
      subtext('💡 To purchase a ride: `-vehiclebuy <alias>` (e.g. `-vehiclebuy toyota` or `-vehiclebuy bugatti`).')
    )
    .setFooter({ text: `Current Ride: ${vehicleName} (${cooldownMinutes}m cooldown) • Beyond The Final Whistle` })
    .setTimestamp();

  if (fs.existsSync(fleetPath)) {
    files.push(new AttachmentBuilder(fleetPath, { name: 'showroom_fleet.png' }));
    embed.setImage('attachment://showroom_fleet.png');
  }

  await message.reply({ embeds: [embed], files });
}

export async function handleVehicleBuyCommand(message: Message, args: string[]) {
  const alias = args[0]?.toLowerCase();
  if (!alias) {
    return await message.reply('❌ Usage: `-vehiclebuy <alias>`. Check available models with `-showroom`!');
  }

  const result = await buyVehicle(message.author.id, alias);
  await message.reply(result.message);
}
