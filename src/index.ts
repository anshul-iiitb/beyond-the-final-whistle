import 'dotenv/config';
import { BTFWClient } from './client/BTFWClient.js';
import { onMessageCreate } from './events/messageCreate.js';
import { onMessageReactionAdd } from './events/messageReactionAdd.js';
import { onInteractionCreate } from './events/interactionCreate.js';
import { syncMemberLocationVisibility } from './engines/campusEngine.js';
import { syncMemberGameRoles } from './utils/roleSyncHelper.js';
import { EmbedBuilder, TextChannel } from 'discord.js';
import { startKeepAliveServer, startKeepAliveWorker } from './services/keepAliveService.js';
import { startDailyLifecycleWorker } from './services/lifecycleService.js';
import { logger } from './utils/logger.js';

async function bootstrap() {
  logger.info('Initializing Beyond The Final Whistle (BTFW) Football RPG Engine...');

  const port = process.env.PORT || 3002;
  startKeepAliveServer(port);
  startKeepAliveWorker(port);

  const client = new BTFWClient();

  // Crash Prevention & Global Error Handling
  client.on('error', (err) => {
    logger.error({ err }, 'Discord client emitted error');
  });

  process.on('unhandledRejection', (reason) => {
    logger.error({ reason }, 'Unhandled Promise Rejection caught');
  });

  process.on('uncaughtException', (err) => {
    logger.error({ err }, 'Uncaught Exception caught');
  });

  client.on('ready', async () => {
    logger.info(`⚽ Beyond The Final Whistle is LIVE as ${client.user?.tag}! Ready for kickoff.`);
    // Fetch and warm up server emojis across all guilds
    for (const guild of client.guilds.cache.values()) {
      await guild.emojis.fetch().catch(() => {});
    }
    startDailyLifecycleWorker(client);
  });

  client.on('messageCreate', async (message) => {
    try {
      await onMessageCreate(message);
    } catch (err) {
      logger.error({ err }, 'Error in messageCreate event listener');
    }
  });

  client.on('messageReactionAdd', async (reaction, user) => {
    try {
      await onMessageReactionAdd(reaction as any, user as any);
    } catch (err) {
      logger.error({ err }, 'Error in messageReactionAdd event listener');
    }
  });

  client.on('interactionCreate', async (interaction) => {
    try {
      await onInteractionCreate(interaction);
    } catch (err) {
      logger.error({ err }, 'Error in interactionCreate event listener');
    }
  });

  client.on('guildMemberAdd', async (member) => {
    if (member.user.bot) return;
    try {
      await syncMemberGameRoles(member, { ovr: 50, matchesPlayed: 0, vipTier: 0 });
      await syncMemberLocationVisibility(member.guild, member.id, 'tc');

      const welcomeCh = member.guild.channels.cache.find(
        c => c.isTextBased() && c.name.toLowerCase().includes('welcome')
      ) as TextChannel | undefined;
      if (welcomeCh) {
        const welcomeEmbed = new EmbedBuilder()
          .setColor('#0ea5e9')
          .setTitle('⚽ Welcome to Beyond The Final Whistle!')
          .setThumbnail(member.user.displayAvatarURL())
          .setDescription(
            `Welcome to the pitch, <@${member.id}>!\n\n` +
            `• Start your career by running \`-profile\` in \`#bot-cmds\` or your unlocked **🏋️ Training Center**!\n` +
            `• Pick a National Team with \`-joinnation <country>\` (**+100k Coins & Followers**).\n` +
            `• Only your active **Campus Location** is visible — use \`-travel <alias>\` to move around!`
          )
          .setFooter({ text: 'Beyond The Final Whistle • Rookie Onboarding', iconURL: client.user?.displayAvatarURL() || undefined })
          .setTimestamp();
        await welcomeCh.send({ content: `Welcome <@${member.id}>!`, embeds: [welcomeEmbed] }).catch(() => {});
      }
    } catch (err) {
      logger.error({ err }, 'Error onboarding new guild member');
    }
  });

  await client.start();
}

bootstrap().catch((err) => {
  logger.fatal({ err }, 'Fatal error during Beyond The Final Whistle startup');
  process.exit(1);
});
