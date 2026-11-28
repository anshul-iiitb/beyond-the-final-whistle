import { Message, EmbedBuilder } from 'discord.js';
import { prisma } from '../database/prisma.js';
import { getPlayerTravelCooldown } from '../engines/campusEngine.js';
import { THEME_COLORS, UI, subtext } from '../utils/themeHelper.js';

function formatRemaining(ms: number): string {
  if (ms <= 0) return '✅ **Ready**';
  const totalMinutes = Math.ceil(ms / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  return hours > 0 ? `⏳ \`${hours}h ${mins}m\`` : `⏳ \`${mins}m\``;
}

export async function handleCooldownCommand(message: Message) {
  const player = await prisma.player.findUnique({
    where: { id: message.author.id },
    include: { vehicles: true }
  });

  if (!player) {
    return await message.reply('❌ You have not registered yet. Use `-profile` to register.');
  }

  const now = Date.now();

  // 1. Travel Cooldown
  const travelRemaining = player.travelUntil ? player.travelUntil.getTime() - now : 0;
  const travelVehicle = await getPlayerTravelCooldown(player.id);

  // 2. Training Cooldowns
  const normalRemaining = player.lastTrainedAt ? 60 * 60 * 1000 - (now - player.lastTrainedAt.getTime()) : 0;
  const vipRemaining = player.lastVipTrainedAt ? 6 * 60 * 60 * 1000 - (now - player.lastVipTrainedAt.getTime()) : 0;
  const noEffortRemaining = player.lastNoEffortAt ? 20 * 60 * 60 * 1000 - (now - player.lastNoEffortAt.getTime()) : 0;

  // 3. Clubhouse Cooldowns
  const recoveryRemaining = player.lastRecoveryAt ? 12 * 60 * 60 * 1000 - (now - player.lastRecoveryAt.getTime()) : 0;
  const coachingRemaining = player.lastCoachedAt ? 2 * 60 * 60 * 1000 - (now - player.lastCoachedAt.getTime()) : 0;
  const meetGreetRemaining = player.lastMeetGreetAt ? 2 * 60 * 60 * 1000 - (now - player.lastMeetGreetAt.getTime()) : 0;

  // 4. Commercial & Intel
  const advertRemaining = player.lastAdvertAt ? 2 * 60 * 60 * 1000 - (now - player.lastAdvertAt.getTime()) : 0;
  const convertRemaining = player.lastConvertedAt ? 7 * 24 * 60 * 60 * 1000 - (now - player.lastConvertedAt.getTime()) : 0;

  // 5. Daily Streak Cooldown
  const dailyRemaining = player.lastDailyAt ? 24 * 60 * 60 * 1000 - (now - player.lastDailyAt.getTime()) : 0;

  const embed = new EmbedBuilder()
    .setColor(THEME_COLORS.PRIMARY)
    .setTitle(`⏱️ Personal Cooldowns Dashboard — ${player.username}`)
    .setDescription(
      [
        `Current Location: \`${player.currentLocation.toUpperCase()}\` • Vehicle: \`${travelVehicle.vehicleName}\``,
        `### 🚀 Travel & Mobility\n` +
        `• **Campus Travel:** ${formatRemaining(travelRemaining)} *(Speed: ${travelVehicle.cooldownMinutes}m transit)*`,
        `### 🏋️ Training Center\n` +
        `• **Pitch Drills (1h):** ${formatRemaining(normalRemaining)} *(+2-4 TP)*\n` +
        `• **VIP Masterclass (6h):** ${formatRemaining(vipRemaining)} *(+6 TP)*\n` +
        `• **VIP Endurance (20h):** ${formatRemaining(noEffortRemaining)} *(+20 TP)*`,
        `### 🏡 Player Clubhouse\n` +
        `• **Sauna Recovery (12h):** ${formatRemaining(recoveryRemaining)} *(+30/100 Stamina)*\n` +
        `• **Youth Coaching (2h):** ${formatRemaining(coachingRemaining)} *(+50k coins)*\n` +
        `• **Meet & Greet (2h):** ${formatRemaining(meetGreetRemaining)} *(+50k followers)*`,
        `### 📸 Commercial & Special\n` +
        `• **Brand Endorsements (2h):** ${formatRemaining(advertRemaining)}\n` +
        `• **Daily Check-in (24h):** ${formatRemaining(dailyRemaining)}\n` +
        `• **Playstyle Convert (7d):** ${formatRemaining(convertRemaining)}`,
        `${UI.DIVIDER}\n` +
        subtext('💡 Tip: Keep drinks (`-buy sd`) in your bag to restore stamina anywhere with `-use sd`!')
      ].join(UI.SPACER)
    )
    .setFooter({ text: 'Beyond The Final Whistle • Telemetry Bureau' })
    .setTimestamp();

  await message.reply({ embeds: [embed] });
}
