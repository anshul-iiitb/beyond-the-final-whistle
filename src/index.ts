import 'dotenv/config';
import { BTFWClient } from './client/BTFWClient.js';
import { onMessageCreate } from './events/messageCreate.js';
import { onMessageReactionAdd } from './events/messageReactionAdd.js';
import { onInteractionCreate } from './events/interactionCreate.js';
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

  await client.start();
}

bootstrap().catch((err) => {
  logger.fatal({ err }, 'Fatal error during Beyond The Final Whistle startup');
  process.exit(1);
});
