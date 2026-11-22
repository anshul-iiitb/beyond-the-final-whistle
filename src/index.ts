import dotenv from 'dotenv';
dotenv.config();

import { BTFWClient } from './client/BTFWClient.js';
import { onMessageCreate } from './events/messageCreate.js';
import { onMessageReactionAdd } from './events/messageReactionAdd.js';
import { startKeepAliveServer, startKeepAliveWorker } from './services/keepAliveService.js';
import { startDailyLifecycleWorker } from './services/lifecycleService.js';
import { logger } from './utils/logger.js';

async function bootstrap() {
  logger.info('Initializing Beyond The Final Whistle (BTFW) Football RPG Engine...');

  const port = process.env.PORT || 3002;
  startKeepAliveServer(port);
  startKeepAliveWorker(port);

  const client = new BTFWClient();

  client.on('ready', () => {
    logger.info(`⚽ Beyond The Final Whistle is LIVE as ${client.user?.tag}! Ready for kickoff.`);
    startDailyLifecycleWorker(client);
  });

  client.on('messageCreate', async (message) => {
    await onMessageCreate(message);
  });

  client.on('messageReactionAdd', async (reaction, user) => {
    await onMessageReactionAdd(reaction as any, user as any);
  });

  await client.start();
}

bootstrap().catch((err) => {
  logger.fatal({ err }, 'Fatal error during Beyond The Final Whistle startup');
  process.exit(1);
});
