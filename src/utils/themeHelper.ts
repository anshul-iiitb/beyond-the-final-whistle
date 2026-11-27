/**
 * Theme & UI Design System for Beyond The Final Whistle (BTFW)
 * Provides cohesive color palettes, visual progress bars, dividers, and typography presets.
 */

export const THEME_COLORS = {
  // Brand & Identity
  PRIMARY: 0x0ea5e9,    // Electric Sky Blue (Base / Overview)
  GOLD: 0xf59e0b,       // Champions Gold (VIP, MOTM, Trophies, Form)
  TURF: 0x16a34a,       // Pitch / Turf Green (Matches, Telemetry, International)
  CYAN: 0x06b6d4,       // Cyber Cyan (Training, Biomechanics, Research)
  EMERALD: 0x10b981,    // Market Emerald (Economy, Shop, Transfers)
  SCARLET: 0xef4444,    // Racing Scarlet (Showroom, Supercars, High-Octane)
  PURPLE: 0xa855f7,     // Glamour Violet (Brand Sponsors, Photoshoot, Clout)
  INDIGO: 0x6366f1,     // Academy Indigo (Guides, Handbook, Onboarding)
  COBALT: 0x2563eb,     // Royal Cobalt (Rules, Federation, Officials)
  SLATE: 0x1e293b,      // Obsidian Slate (Subtle dark card accents)
} as const;

export const UI = {
  DIVIDER: '━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
  SUB_DIVIDER: '───────────────────────────',
  DOT_DIVIDER: '• • • • • • • • • • • • • • • • • • • •',
  DOUBLE_DIVIDER: '════════════════════════════',
  SPACER: '\n\u200b\n',
};

/**
 * Creates an authentic Unicode stat / progress bar.
 * e.g. ▰▰▰▰▰▰▰▰▱▱ (80%)
 */
export function makeProgressBar(
  current: number,
  max: number,
  length: number = 8,
  fillChar: string = '▰',
  emptyChar: string = '▱'
): string {
  if (max <= 0) return emptyChar.repeat(length);
  const ratio = Math.max(0, Math.min(1, current / max));
  const filled = Math.round(ratio * length);
  const empty = Math.max(0, length - filled);
  return `${fillChar.repeat(filled)}${emptyChar.repeat(empty)}`;
}

/**
 * Creates a two-sided ratio comparison bar (e.g. for possession: 55% vs 45%).
 */
export function makeDualProgressBar(
  valA: number,
  valB: number,
  length: number = 10,
  fillCharA: string = '▰',
  fillCharB: string = '▱'
): string {
  const total = valA + valB;
  if (total <= 0) return fillCharA.repeat(Math.floor(length / 2)) + fillCharB.repeat(Math.ceil(length / 2));
  const ratioA = valA / total;
  const countA = Math.round(ratioA * length);
  const countB = Math.max(0, length - countA);
  return `${fillCharA.repeat(countA)}${fillCharB.repeat(countB)}`;
}

/**
 * Wraps text into Discord's native subtext notation (-# text).
 */
export function subtext(text: string): string {
  return `-# ${text}`;
}

/**
 * Formats a clean HUD metric tag: `[ LABEL: VALUE ]`
 */
export function hudBadge(label: string, value: string | number): string {
  return `\`[ ${label}: ${value} ]\``;
}
