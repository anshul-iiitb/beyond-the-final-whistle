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

// Hardcoded map of our official application emoji IDs (guaranteed instant resolution & priority)
export const APPLICATION_EMOJIS: Record<string, string> = {
  adidas: '<:adidas:1574132985844867293>',
  bully: '<:bully:1574132990869643434>',
  car: '<:car:1574132999027429419>',
  cocacola: '<:cocacola:1574133004379488478>',
  coin: '<:coin:1574133021601177641>',
  followers: '<:followers:1574133027313946634>',
  goldenboot: '<:goldenboot:1574133032506626258>',
  goldmedal: '<:goldmedal:1574133037665624138>',
  heineken: '<:heineken:1574133048713285643>',
  motm: '<:motm:1574133057051427007>',
  netflix: '<:netflix:1574133061950640271>',
  nike: '<:nike:1574133066950123603>',
  passa: '<:passa:1574133072150921327>',
  sd: '<:sd:1574133077008187564>',
  silvermedal: '<:silvermedal:1574133082485821690>',
  stamina: '<:stamina:1574133087745609899>',
  strika: '<:strika:1574133093193744474>',
  tp: '<:tp:1574133098361393293>',
  worldcup: '<:worldcup:1574136906508271828>',
  zzcross: '<:zzcross:1574133121228603562>',
  zztick: '<:zztick:1574133126702170255>',
  // Vehicle front & back application emojis
  hcfront: '<:hcfront:1574138692295987373>',
  hcback: '<:hcback:1574138697283141734>',
  tsfront: '<:tsfront:1574138702702186717>',
  tsback: '<:tsback:1574138708024754308>',
  p911front: '<:p911front:1574138713049403577>',
  p911back: '<:p911back:1574138717931708539>',
  ngtrfront: '<:ngtrfront:1574138723589955664>',
  ngtrback: '<:ngtrback:1574138728644087951>',
  ar8front: '<:ar8front:1574138734033633343>',
  ar8back: '<:ar8back:1574138739721240606>',
  lhfront: '<:lhfront:1574138744653611018>',
  lhback: '<:lhback:1574138749577728222>',
  rrgfront: '<:rrgfront:1574138754514296833>',
  rrgback: '<:rrgback:1574138759711035653>',
  ffront: '<:ffront:1574138764668706918>',
  fback: '<:fback:1574138769706328134>',
  bcfront: '<:bcfront:1574138775083155539>',
  bcback: '<:bcback:1574138781710295060>'
};

/**
 * Returns custom Discord emoji (<:name:id>) if available in application/guild cache,
 * otherwise returns a clean Unicode fallback emoji.
 */
export function getEmoji(scope: Guild | Client | null | undefined, name: string): string {
  const lower = name.toLowerCase();

  // 1. Primary: Official Application Emojis (The newly edited main emojis)
  if (APPLICATION_EMOJIS[lower]) {
    return APPLICATION_EMOJIS[lower];
  }

  // 2. Client Application Emojis Cache
  const client = scope && 'client' in scope ? (scope as Guild).client : (scope as Client);
  if (client?.application?.emojis?.cache) {
    const appCustom = client.application.emojis.cache.find(e => e.name?.toLowerCase() === lower);
    if (appCustom) return appCustom.toString();
  }

  // 3. Guild Emojis Cache
  const emojiCache = scope && 'emojis' in scope ? scope.emojis.cache : undefined;
  if (emojiCache) {
    const custom = emojiCache.find(e => e.name?.toLowerCase() === lower);
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
