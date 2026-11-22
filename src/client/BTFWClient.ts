import { Client, GatewayIntentBits, Partials } from 'discord.js';
import { logger } from '../utils/logger.js';

export class BTFWClient extends Client {
  constructor() {
    super({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMessageReactions
      ],
      partials: [
        Partials.Message,
        Partials.Channel,
        Partials.Reaction,
        Partials.User
      ]
    });
  }

  public async start(): Promise<void> {
    const token = process.env.DISCORD_TOKEN || process.env.BTFW_DISCORD_TOKEN;
    if (!token || token.trim() === '') {
      logger.warn('BTFW_DISCORD_TOKEN / DISCORD_TOKEN not provided in .env. Bot client standby mode.');
      return;
    }

    try {
      await this.login(token.trim());
      logger.info(`⚽ Logged into Discord as ${this.user?.tag}`);
    } catch (err) {
      logger.error({ err }, 'Failed to login to Discord');
      throw err;
    }
  }
}
