import { Guild, Client } from 'discord.js';
import path from 'path';
import fs from 'fs';
import { logger } from './logger.js';

export const EMOJI_FALLBACKS: Record<string, string> = {
  stamina: '⚡',
  coin: '🪙',
  tp: '🤹‍♂️',
  worldcup: '🏆',
  strika: '⚡',
  passa: '👟',
  bully: '🛡️',
  zztick: '✅',
  zzcross: '❌',
  motm: '👑',
  star: '⭐',
  fire: '🔥',
  car: '🏎️',
  drink: '🧪'
};

/**
 * Returns custom Discord emoji (<:name:id>) if available in the guild/bot cache,
 * otherwise returns a clean Unicode fallback emoji.
 */
export function getEmoji(scope: Guild | Client | null | undefined, name: string): string {
  if (!scope) return EMOJI_FALLBACKS[name] || '⚽';

  const emojiCache = 'emojis' in scope ? scope.emojis.cache : undefined;
  if (emojiCache) {
    const custom = emojiCache.find(e => e.name?.toLowerCase() === name.toLowerCase());
    if (custom) return custom.toString();
  }

  return EMOJI_FALLBACKS[name] || '⚽';
}

/**
 * Uploads all custom PNG emoji assets from assets/emojis/ directly into the server.
 */
export async function installCustomServerEmojis(guild: Guild): Promise<{ created: string[]; existing: string[]; failed: string[] }> {
  const created: string[] = [];
  const existing: string[] = [];
  const failed: string[] = [];

  const emojisDir = path.resolve(process.cwd(), 'assets/emojis');
  if (!fs.existsSync(emojisDir)) {
    return { created, existing, failed: ['Emoji directory not found'] };
  }

  const files = fs.readdirSync(emojisDir).filter(f => f.endsWith('.png'));

  for (const file of files) {
    const emojiName = path.basename(file, '.png');
    const existingEmoji = guild.emojis.cache.find(e => e.name?.toLowerCase() === emojiName.toLowerCase());

    if (existingEmoji) {
      existing.push(existingEmoji.toString());
      continue;
    }

    try {
      const filePath = path.join(emojisDir, file);
      const newEmoji = await guild.emojis.create({
        attachment: filePath,
        name: emojiName
      });
      created.push(newEmoji.toString());
      logger.info({ emojiName, id: newEmoji.id }, 'Created custom server emoji');
    } catch (err: any) {
      logger.error({ err, emojiName }, 'Failed to upload custom server emoji');
      failed.push(emojiName);
    }
  }

  return { created, existing, failed };
}
