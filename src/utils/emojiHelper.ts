import { Guild, Client } from 'discord.js';
import path from 'path';
import fs from 'fs';
import { logger } from './logger.js';

export const EMOJI_FALLBACKS: Record<string, string> = {
  stamina: '⚡',
  coin: '🪙',
  tp: '🤹‍♂️',
  followers: '👤',
  worldcup: '🏆',
  strika: '⚡',
  passa: '👟',
  bully: '🛡️',
  zztick: '✅',
  zzcross: '❌',
  motm: '👑',
  goldenboot: '✨',
  goldmedal: '🥇',
  silvermedal: '🥈',
  heineken: '🍺',
  adidas: '👟',
  cocacola: '🥤',
  netflix: '🎬',
  nike: '✔️',
  star: '⭐',
  fire: '🔥',
  car: '🏎️',
  drink: '🧪',
  sd: '🧪'
};

// Official Server Emoji IDs (Guaranteed to work for all bots and all members natively)
export const APPLICATION_EMOJIS: Record<string, string> = {
  adidas: '<:adidas:1574453812675088515>',
  bully: '<:bully:1574453703514263713>',
  car: '<:car:1574453754835636245>',
  cocacola: '<:cocacola:1574453824171671633>',
  coin: '<:coin:1574453714289168387>',
  followers: '<:followers:1574453742588272772>',
  goldenboot: '<:goldenboot:1574453765698879639>',
  goldmedal: '<:goldmedal:1574453777497464913>',
  heineken: '<:heineken:1574441095511937045>',
  motm: '<:motm:1574453801287557251>',
  netflix: '<:netflix:1574453835148169269>',
  nike: '<:nike:1574453846812397578>',
  passa: '<:passa:1574453692646563950>',
  sd: '<:sd:1574453670198902784>',
  silvermedal: '<:silvermedal:1574453789157752907>',
  stamina: '<:stamina:1574453658106724382>',
  strika: '<:strika:1574453680709566594>',
  tp: '<:tp:1574453725643276379>',
  worldcup: '<:worldcup:1574454369338925219>',
  zzcross: '<:zzcross:1574453869277216892>',
  zztick: '<:zztick:1574453858095206480>',
  // Supercar Front & Back Emojis (Native Server Emojis)
  hcfront: '<:hcfront:1574441090503938158>',
  hcback: '<:hcback:1574441085294616640>',
  tsfront: '<:tsfront:1574441146850082917>',
  tsback: '<:tsback:1574441142022570014>',
  p911front: '<:p911front:1574441127464014015>',
  p911back: '<:p911back:1574441122716065923>',
  ngtrfront: '<:ngtrfront:1574441117662052483>',
  ngtrback: '<:ngtrback:1574441112632958999>',
  ar8front: '<:ar8front:1574441060116074632>',
  ar8back: '<:ar8back:1574441055099813898>',
  lhfront: '<:lhfront:1574441105301315615>',
  lhback: '<:lhback:1574441100280602727>',
  rrgfront: '<:rrgfront:1574441137098195125>',
  rrgback: '<:rrgback:1574441132413292725>',
  ffront: '<:ffront:1574441080403787816>',
  fback: '<:fback:1574441075366564000>',
  bcfront: '<:bcfront:1574441070484394104>',
  bcback: '<:bcback:1574441065535246396>'
};

/**
 * Returns custom Discord emoji (<:name:id>) if available in application/guild cache,
 * otherwise returns a clean Unicode fallback emoji.
 */
export function getEmoji(scope: Guild | Client | null | undefined, name: string): string {
  const lower = name.toLowerCase();

  // 1. Primary: Guild Emojis Cache (Server emojis work for ALL bots and members without Nitro)
  const emojiCache = scope && 'emojis' in scope ? (scope as Guild).emojis.cache : undefined;
  if (emojiCache) {
    const custom = emojiCache.find(e => e.name?.toLowerCase() === lower);
    if (custom) return custom.toString();
  }

  // 2. Secondary: Official Application Emojis
  if (APPLICATION_EMOJIS[lower]) {
    return APPLICATION_EMOJIS[lower];
  }

  // 2. Client Application Emojis Cache
  const client = scope && 'client' in scope ? (scope as Guild).client : (scope as Client);
  if (client?.application?.emojis?.cache) {
    const appCustom = client.application.emojis.cache.find(e => e.name?.toLowerCase() === lower);
    if (appCustom) return appCustom.toString();
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
