import { AttachmentBuilder, EmbedBuilder, Message, RepliableInteraction } from 'discord.js';
import { join } from 'path';
import fs from 'fs';

/**
 * Returns the absolute path to the custom Beyond The Final Whistle loading GIF.
 */
export function getLoadingGifPath(): string {
  const candidates = [
    join(process.cwd(), 'assets', 'loading.gif'),
    join(process.cwd(), '..', 'assets', 'loading.gif'),
  ];

  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return join(process.cwd(), 'assets', 'loading.gif');
}

function formatThinkingDescription(text: string): string {
  let clean = text.replace(/^(Beyond The Final Whistle|BTFW|LeagueMaster)\s+is\s+/i, '').trim();
  if (!clean || clean.toLowerCase() === 'thinking...') {
    clean = 'Processing matchday telemetry...';
  }

  if (clean.length <= 28) {
    return `⚡ **${clean}**`;
  }

  const words = clean.split(/\s+/);
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    if (!current) {
      current = word;
    } else if ((current + ' ' + word).length <= 26) {
      current += ' ' + word;
    } else {
      lines.push(current);
      current = word;
      if (lines.length === 2) break;
    }
  }
  if (current && lines.length < 2) lines.push(current);

  return lines.map((l, i) => (i === 0 ? `⚡ **${l}**` : `**${l}**`)).join('\n');
}

/**
 * Creates an animated "Thinking" payload with the custom bot loading GIF.
 */
export function createThinkingPayload(text = 'Beyond The Final Whistle is thinking...') {
  const gifPath = getLoadingGifPath();
  if (fs.existsSync(gifPath)) {
    const attachment = new AttachmentBuilder(gifPath, { name: 'loading.gif' });

    const embed = new EmbedBuilder()
      .setColor('#06b6d4')
      .setDescription(formatThinkingDescription(text))
      .setImage('attachment://loading.gif');

    return { embeds: [embed], files: [attachment] };
  }

  return { content: `⏳ **${text}**` };
}

/**
 * Sends a thinking state message or replies to an interaction with the animated loading GIF.
 */
export async function sendThinkingMessage<T extends Message | RepliableInteraction>(
  target: T,
  text = 'Beyond The Final Whistle is thinking...',
  ephemeral = false
): Promise<T> {
  const payload = createThinkingPayload(text);
  if ('editReply' in target) {
    if (target.deferred || target.replied) {
      await target.editReply(payload as any);
      return target;
    }
    await target.reply({ ...payload, ephemeral });
    return target;
  } else {
    return (await (target as Message).reply(payload as any)) as unknown as T;
  }
}

/**
 * Updates a previously sent thinking message/interaction with the final payload,
 * ensuring any previous loading GIF files/embeds are cleanly cleared.
 */
export async function updateLoadingMessage(
  target: Message | RepliableInteraction,
  payload: string | { content?: string; embeds?: any[]; files?: any[]; components?: any[] }
) {
  if (typeof payload === 'string') {
    const editPayload = { content: payload, embeds: [], files: [], components: [] };
    if ('editReply' in target) return await target.editReply(editPayload as any);
    return await target.edit(editPayload as any);
  }

  const editPayload: any = {
    embeds: payload.embeds ?? [],
    files: payload.files ?? [],
    components: payload.components ?? [],
  };
  if (payload.content !== undefined) {
    editPayload.content = payload.content;
  }

  if ('editReply' in target) {
    return await target.editReply(editPayload);
  } else {
    return await target.edit(editPayload);
  }
}
