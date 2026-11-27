import { createCanvas, loadImage, SKRSContext2D } from '@napi-rs/canvas';
import path from 'path';
import fs from 'fs';
import {
  DUAL_BOX_UNIVERSAL_SPEC,
  PLAYER_STAT_CARD_SPEC,
  LEADERBOARD_GRID_SPEC,
  SHOWROOM_MARKET_GRID_SPEC,
  AUCTION_HOUSE_GRID_SPEC,
  STANDINGS_TABLE_GRID_SPEC,
} from '../config/themeModelSpec.js';
import { PROFILE_THEMES } from '../config/constants.js';
import { formatK } from './formatHelper.js';

const imageCache = new Map<string, any>();
const avatarUrlCache = new Map<string, any>();

/**
 * Draws a dark semi-opaque frosted scrim strictly inside a glass panel so text retains high contrast
 * even when bright stadium floodlight rays cross behind the background frame.
 */
export function drawGlassScrim(
  ctx: SKRSContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  radius = 8,
  alpha = 0.74
) {
  ctx.save();
  drawRoundedRect(ctx, x, y, w, h, radius);
  ctx.fillStyle = `rgba(5, 9, 18, ${alpha})`;
  ctx.fill();
  ctx.restore();
}

/**
 * Strips emojis/non-ASCII symbols that cause Skia canvas "tofu" boxes and normalizes fancy Unicode characters.
 */
export function cleanCanvasText(input?: string | null): string {
  if (!input) return '';
  return input
    .normalize('NFKD')
    .replace(/[\u2018\u2019\u201A\u201B\u2032]/g, "'")
    .replace(/[\u201C\u201D\u201E\u201F\u2033]/g, '"')
    .replace(/[\u2013\u2014\u2015]/g, '-')
    .replace(/\u2026/g, '...')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/<a?:\w+:\d+>/g, '')
    .replace(/[^\x20-\x7E\u00A0-\u00FF\u2022]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function truncateText(ctx: SKRSContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let str = text;
  while (str.length > 0 && ctx.measureText(`${str}..`).width > maxWidth) {
    str = str.slice(0, -1);
  }
  return str.length > 0 ? `${str}..` : '';
}

/**
 * Scales font down smoothly between maxPx and minPx so text never overflows maxWidth on Linux or Windows fonts.
 */
export function drawFittedText(
  ctx: SKRSContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  fontFamily: string,
  maxPx: number,
  minPx: number,
  weight = 'bold'
) {
  let size = maxPx;
  ctx.font = `${weight} ${size}px ${fontFamily}`;
  while (size > minPx && ctx.measureText(text).width > maxWidth) {
    size -= 0.5;
    ctx.font = `${weight} ${size}px ${fontFamily}`;
  }
  ctx.fillText(truncateText(ctx, text, maxWidth), x, y);
}

export function drawRoundedRect(
  ctx: SKRSContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  radius: number
) {
  const r = Math.min(radius, w / 2, h / 2);
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

/**
 * Resolves a custom generated theme image for a given slot (`profile_banner`, `leaderboard`, `showroom`, etc.).
 * Prefers the user's explicit theme folder (`assets/themes/<themeKey>/<slot>.png|jpg|webp`) and falls back to `obsidian`.
 */
export function resolveCosmeticAssetPath(
  kind: 'AVATAR' | 'BANNER',
  cosmeticKey?: string | null
): string | null {
  if (!cosmeticKey) return null;
  const subDir = kind === 'AVATAR' ? 'avatars' : 'banners';
  const cleanKey = cosmeticKey.toLowerCase().trim();
  const exts = ['png', 'jpg', 'jpeg', 'webp'];
  for (const ext of exts) {
    const p = path.resolve(process.cwd(), 'assets', 'cosmetics', subDir, `${cleanKey}.${ext}`);
    if (fs.existsSync(p)) return p;
  }
  return null;
}

/**
 * Resolves a player's display avatar image, preferring their equipped custom Footballer Avatar artwork if present.
 */
export async function resolveAvatarImage(avatarUrl?: string | null, equippedAvatar?: string | null) {
  const customPath = resolveCosmeticAssetPath('AVATAR', equippedAvatar);
  if (customPath) {
    try {
      return await loadLocalImageCached(customPath);
    } catch {}
  }
  return await fetchRemoteImage(avatarUrl, 1200);
}

/**
 * Composites a Legend Collector Banner Poster (`assets/cosmetics/banners/<key>`) with crisp BTFW frame & bottom corner badge.
 */
export async function renderEquippedBannerPoster(options: {
  bannerPath: string;
  username: string;
  bannerName: string;
  bannerSubtitle: string;
  ovr: number;
  seasonRank: string;
  accentHex: string;
  vipTier: number;
}): Promise<Buffer> {
  const img = await loadLocalImageCached(options.bannerPath);
  const width = 1000;
  const aspectRatio = img.width > 0 ? img.height / img.width : 0.38;
  const height = Math.max(220, Math.min(580, Math.round(width * aspectRatio)));

  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#060a14';
  ctx.fillRect(0, 0, width, height);

  // Clip cleanly to rounded frame preserving the entire full-bleed banner artwork without cropping
  ctx.save();
  drawRoundedRect(ctx, 3, 3, width - 6, height - 6, 12);
  ctx.clip();
  ctx.drawImage(img, 0, 0, width, height);
  ctx.restore();

  // Outer sleek metallic frame matching VIP gold / banner accent
  ctx.save();
  drawRoundedRect(ctx, 3, 3, width - 6, height - 6, 12);
  ctx.strokeStyle = options.vipTier >= 1 ? '#facc15' : options.accentHex;
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.restore();

  return canvas.toBuffer('image/png');
}

export function resolveThemeAssetPath(
  slot:
    | 'dual_box'
    | 'profile_banner'
    | 'player_stat_card'
    | 'leaderboard'
    | 'showroom'
    | 'auction_house'
    | 'points_table'
    | 'match_scorecard',
  themeKey?: string | null
): { filePath: string | null; isExactTheme: boolean } {
  const cleanKey = (themeKey || 'obsidian').toLowerCase();
  const candidates = cleanKey !== 'obsidian' ? [cleanKey, 'obsidian'] : ['obsidian'];
  const exts = ['png', 'jpg', 'jpeg', 'webp'];

  for (const folder of candidates) {
    for (const ext of exts) {
      const p = path.resolve(process.cwd(), 'assets', 'themes', folder, `${slot}.${ext}`);
      if (fs.existsSync(p)) {
        return { filePath: p, isExactTheme: folder === cleanKey };
      }
    }
  }
  return { filePath: null, isExactTheme: false };
}

export async function loadLocalImageCached(filePath: string) {
  if (imageCache.has(filePath)) return imageCache.get(filePath);
  const img = await loadImage(filePath);
  imageCache.set(filePath, img);
  return img;
}

export async function fetchRemoteImage(url?: string | null, timeoutMs = 1200) {
  if (!url) return null;
  if (avatarUrlCache.has(url)) return avatarUrlCache.get(url);
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    const img = await loadImage(buf);
    if (avatarUrlCache.size >= 150) {
      const oldest = avatarUrlCache.keys().next().value;
      if (oldest) avatarUrlCache.delete(oldest);
    }
    avatarUrlCache.set(url, img);
    return img;
  } catch {
    return null;
  }
}

export function drawCircularImage(
  ctx: SKRSContext2D,
  img: any,
  cx: number,
  cy: number,
  r: number,
  fallbackText: string,
  accentColor: string,
  drawRing = true
) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.clip();

  if (img) {
    ctx.drawImage(img, cx - r, cy - r, r * 2, r * 2);
  } else {
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
    ctx.fillStyle = accentColor;
    ctx.font = `bold ${Math.max(12, Math.round(r * 0.72))}px "Segoe UI", Arial, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText((fallbackText[0] || 'P').toUpperCase(), cx, cy + 1);
  }
  ctx.restore();

  if (drawRing) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r + 1.5, 0, Math.PI * 2);
    ctx.strokeStyle = accentColor;
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.restore();
  }
}

/**
 * Draws the circular BTFW (Beyond The Final Whistle) crest emblem from assets/branding/icon.png.
 */
export async function drawBrandLogoSeal(
  ctx: SKRSContext2D,
  cx: number,
  cy: number,
  r: number,
  ringColor = 'rgba(250, 204, 21, 0.72)'
) {
  const iconPath = path.resolve(process.cwd(), 'assets', 'branding', 'icon.png');
  if (!fs.existsSync(iconPath)) return;
  try {
    const iconImg = await loadLocalImageCached(iconPath);
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(iconImg, cx - r, cy - r, r * 2, r * 2);
    ctx.restore();

    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r + 1, 0, Math.PI * 2);
    ctx.strokeStyle = ringColor;
    ctx.lineWidth = 1.6;
    ctx.stroke();
    ctx.restore();
  } catch {
    // Skip silently if asset cannot decode
  }
}

/**
 * Draws the resolved Obsidian/Theme backdrop + optional subtle tint when a secondary theme borrows the structural obsidian plate.
 */
export async function paintThemeBackdrop(
  ctx: SKRSContext2D,
  w: number,
  h: number,
  slot:
    | 'dual_box'
    | 'profile_banner'
    | 'player_stat_card'
    | 'leaderboard'
    | 'showroom'
    | 'auction_house'
    | 'points_table'
    | 'match_scorecard',
  themeKey?: string | null
) {
  const themeDef = PROFILE_THEMES.find(t => t.key === themeKey) || PROFILE_THEMES[0];
  const { filePath, isExactTheme } = resolveThemeAssetPath(slot, themeKey);

  if (filePath) {
    const bgImg = await loadLocalImageCached(filePath);
    ctx.drawImage(bgImg, 0, 0, w, h);

    // Subtle thematic color wash only if using another palette on the obsidian structural base
    if (!isExactTheme && themeDef.key !== 'obsidian') {
      ctx.save();
      ctx.globalCompositeOperation = 'source-atop';
      ctx.fillStyle = themeDef.glow;
      ctx.fillRect(0, 0, w, h);
      ctx.restore();
    }
    return themeDef;
  }

  // Fallback gradient backdrop
  const grad = ctx.createLinearGradient(0, 0, w, h);
  grad.addColorStop(0, themeDef.bgStart);
  grad.addColorStop(1, themeDef.bgEnd);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);
  return themeDef;
}

// =========================================================================
// 1. GLOBAL LEADERBOARD RENDERER (-lb) [1000x1100]
// =========================================================================

export interface LeaderboardEntryData {
  rank: number;
  userId: string;
  username: string;
  clubTag: string;
  avatarUrl?: string | null;
  valueText: string;
  isCaller?: boolean;
}

export async function renderLeaderboardCanvas(options: {
  title: string;
  subtitle: string;
  metricHeader: string;
  entries: LeaderboardEntryData[];
  callerSummary?: string;
  accentHex?: string;
  themeKey?: string | null;
}): Promise<Buffer> {
  const spec = LEADERBOARD_GRID_SPEC;
  const width = spec.canvasWidth; // 1000
  const fullHeight = spec.canvasHeight; // 1100
  const shownEntries = options.entries.slice(0, 10);
  const count = shownEntries.length;
  const isCompact = count > 0 && count < 10;

  const bottomCapH = 110; // bottom frame border + caller footer height from bottom of 1100px template
  const topCutY = isCompact ? 228 + count * 75 : fullHeight;
  const height = isCompact ? topCutY + bottomCapH : fullHeight;

  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  const themeDef = PROFILE_THEMES.find(t => t.key === options.themeKey) || PROFILE_THEMES[0];
  const { filePath, isExactTheme } = resolveThemeAssetPath('leaderboard', options.themeKey);

  if (filePath) {
    const bgImg = await loadLocalImageCached(filePath);
    if (isCompact) {
      const srcTopH = Math.round(bgImg.height * (topCutY / fullHeight));
      const srcBotY = Math.round(bgImg.height * ((fullHeight - bottomCapH) / fullHeight));
      const srcBotH = bgImg.height - srcBotY;
      ctx.drawImage(bgImg, 0, 0, bgImg.width, srcTopH, 0, 0, width, topCutY);
      ctx.drawImage(bgImg, 0, srcBotY, bgImg.width, srcBotH, 0, topCutY, width, bottomCapH);

      // Clean horizon transition across the spliced table bottom boundary
      const blendGrad = ctx.createLinearGradient(0, topCutY - 8, 0, topCutY + 12);
      blendGrad.addColorStop(0, 'rgba(7, 11, 20, 0.25)');
      blendGrad.addColorStop(0.5, 'rgba(7, 11, 20, 0.92)');
      blendGrad.addColorStop(1, 'rgba(7, 11, 20, 0.25)');
      ctx.fillStyle = blendGrad;
      ctx.fillRect(54, topCutY - 8, width - 108, 20);

      ctx.strokeStyle = 'rgba(250, 204, 21, 0.42)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(54, topCutY + 1);
      ctx.lineTo(width - 54, topCutY + 1);
      ctx.stroke();
    } else {
      ctx.drawImage(bgImg, 0, 0, width, height);
    }

    if (!isExactTheme && themeDef.key !== 'obsidian') {
      ctx.save();
      ctx.globalCompositeOperation = 'source-atop';
      ctx.fillStyle = themeDef.glow;
      ctx.fillRect(0, 0, width, height);
      ctx.restore();
    }
  } else {
    const grad = ctx.createLinearGradient(0, 0, width, height);
    grad.addColorStop(0, themeDef.bgStart);
    grad.addColorStop(1, themeDef.bgEnd);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);
  }

  const accent = options.accentHex || themeDef.accent;

  // 1. Header Banner Zone (70, 50, 860x110) + high-contrast dark glass scrim + BTFW crest
  const hz = spec.headerZone;
  drawGlassScrim(ctx, hz.x + 8, hz.y + 6, hz.w - 16, hz.h - 12, 8, 0.72);
  await drawBrandLogoSeal(ctx, hz.x + 48, hz.y + hz.h / 2, 26, accent);
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#ffffff';
  ctx.shadowColor = accent;
  ctx.shadowBlur = 14;
  ctx.font = 'bold 32px "Segoe UI", Arial, sans-serif';
  ctx.fillText(truncateText(ctx, cleanCanvasText(options.title).toUpperCase(), hz.w - 180), hz.x + hz.w / 2 + 12, hz.y + 44);
  ctx.shadowBlur = 0;

  ctx.fillStyle = '#7dd3fc';
  ctx.font = 'bold 14px "Segoe UI", Arial, sans-serif';
  ctx.fillText(truncateText(ctx, cleanCanvasText(options.subtitle).toUpperCase(), hz.w - 180), hz.x + hz.w / 2 + 12, hz.y + 82);
  ctx.restore();

  // 2. Replace "METRIC VALUE" label in the 3rd column pill with the active category header
  const metricCol = spec.columns![2];
  ctx.save();
  ctx.fillStyle = '#070b14';
  drawRoundedRect(ctx, metricCol.x + 10, metricCol.y + 7, metricCol.w - 20, metricCol.h - 14, 5);
  ctx.fill();
  ctx.fillStyle = '#fde047';
  ctx.font = 'bold 13px "Segoe UI", Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(cleanCanvasText(options.metricHeader).toUpperCase(), metricCol.x + metricCol.w / 2, metricCol.y + metricCol.h / 2);
  ctx.restore();

  // Fetch player avatars concurrently
  const avatarImages = await Promise.all(
    shownEntries.map(e => fetchRemoteImage(e.avatarUrl, 1200))
  );

  // 3. Draw populated rows cleanly aligned with leaderboard rings + dark text scrims
  for (let i = 0; i < shownEntries.length; i++) {
    const e = shownEntries[i];
    const rowSpec = spec.rows![i];
    const yCenter = rowSpec.yCenter;
    const isPodium = e.rank <= 3;

    const rankColor =
      e.rank === 1 ? '#facc15' : e.rank === 2 ? '#f8fafc' : e.rank === 3 ? '#fb923c' : '#e2e8f0';

    // Dark high-contrast scrim behind rank box & player/metric columns (leaves circular avatar ring exposed!)
    drawGlassScrim(ctx, 64, yCenter - 27, 112, 54, 6, 0.72);
    drawGlassScrim(ctx, 248, yCenter - 27, 686, 54, 6, 0.72);

    // Highlight current caller row inside the arena
    if (e.isCaller) {
      ctx.save();
      drawRoundedRect(ctx, 56, yCenter - 32, 888, 64, 8);
      ctx.fillStyle = 'rgba(56, 189, 248, 0.14)';
      ctx.fill();
      ctx.strokeStyle = accent;
      ctx.lineWidth = 1.8;
      ctx.stroke();
      ctx.restore();
    }

    // Rank # in Column 1 (x: 60..175)
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = rankColor;
    ctx.font = isPodium ? 'bold 26px "Segoe UI", Arial, sans-serif' : 'bold 21px "Segoe UI", Arial, sans-serif';
    ctx.fillText(`#${e.rank}`, 120, yCenter);
    ctx.restore();

    // Circular Avatar centered inside template socket (cx: 213, cy: yCenter - 5, r: 22)
    drawCircularImage(
      ctx,
      avatarImages[i],
      213,
      yCenter - 5,
      22,
      e.username,
      rankColor,
      false // metallic circular ring provided by background plate
    );

    // Player Name & Club/Nation Subtext (x: 256..755)
    ctx.save();
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = e.isCaller ? '#fef08a' : '#ffffff';
    ctx.font = isPodium ? 'bold 21px "Segoe UI", Arial, sans-serif' : 'bold 19px "Segoe UI", Arial, sans-serif';
    const cleanName = cleanCanvasText(e.username) || 'Player';
    ctx.fillText(truncateText(ctx, cleanName, 485), 258, yCenter - 9);

    ctx.fillStyle = e.isCaller ? '#e2e8f0' : '#cbd5e1';
    ctx.font = 'bold 12.5px "Segoe UI", Arial, sans-serif';
    ctx.fillText(truncateText(ctx, cleanCanvasText(e.clubTag), 485), 258, yCenter + 14);
    ctx.restore();

    // Metric Value Pill in Right Column (760..940)
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = isPodium ? rankColor : '#f8fafc';
    ctx.font = isPodium ? 'bold 22px "Segoe UI", Arial, sans-serif' : 'bold 20px "Segoe UI", Arial, sans-serif';
    ctx.fillText(truncateText(ctx, cleanCanvasText(e.valueText), 160), 850, yCenter);
    ctx.restore();
  }

  // Empty state check
  if (shownEntries.length === 0) {
    drawGlassScrim(ctx, 220, 520, 560, 64, 10, 0.78);
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#e2e8f0';
    ctx.font = 'bold 22px "Segoe UI", Arial, sans-serif';
    ctx.fillText('No ranked players recorded yet.', width / 2, 552);
    ctx.restore();
  }

  // 4. Bottom Caller Footer Zone
  if (options.callerSummary) {
    const fz = spec.footerZone!;
    const footerCenterY = isCompact ? topCutY + 69 : fz.y + fz.h / 2 + 12;
    drawGlassScrim(ctx, fz.x + 8, footerCenterY - 19, fz.w - 16, 38, 6, 0.80);
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 15px "Segoe UI", Arial, sans-serif';
    ctx.fillText(truncateText(ctx, cleanCanvasText(options.callerSummary), fz.w - 40), fz.x + fz.w / 2, footerCenterY);
    ctx.restore();
  }

  return canvas.toBuffer('image/png');
}

// =========================================================================
// 2. FULL PLAYER STAT & TELEMETRY CARD (-profile stats / -intstats / -clubstats) [1000x550]
// =========================================================================

export interface PlayerStatCanvasData {
  titleTag: string;
  username: string;
  clubAndNation: string;
  seasonRank: string;
  vipTier: number;
  avatarUrl?: string | null;
  equippedAvatar?: string | null;
  ovr: number;
  atk: number;
  mid: number;
  def: number;
  stats: Array<{ label: string; value: string; highlight?: boolean }>;
  recentForm: string[];
  milestones: string[];
  footerSummary: string;
  themeKey?: string | null;
}

export async function renderPlayerStatCanvas(data: PlayerStatCanvasData): Promise<Buffer> {
  const spec = PLAYER_STAT_CARD_SPEC;
  const width = spec.canvasWidth;   // 1000
  const height = spec.canvasHeight; // 550
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  const theme = await paintThemeBackdrop(ctx, width, height, 'player_stat_card', data.themeKey);
  const accent = data.vipTier >= 1 ? '#f59e0b' : theme.accent;

  // 1. Header Zone (45, 45, 560x110)
  const hz = spec.headerZone;
  drawGlassScrim(ctx, hz.x + 8, hz.y + 8, hz.w - 16, hz.h - 16, 8, 0.70);
  ctx.save();
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';

  const topPill = `${cleanCanvasText(data.titleTag).toUpperCase()}  •  ${cleanCanvasText(data.seasonRank).toUpperCase()}${data.vipTier >= 1 ? '  •  VIP' : ''}`;
  ctx.fillStyle = accent;
  ctx.font = 'bold 12px "Segoe UI", Arial, sans-serif';
  ctx.fillText(topPill, hz.x + 22, hz.y + 34);

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 30px "Segoe UI", Arial, sans-serif';
  ctx.fillText(truncateText(ctx, cleanCanvasText(data.username), hz.w - 44), hz.x + 22, hz.y + 72);

  ctx.fillStyle = '#e2e8f0';
  ctx.font = '14px "Segoe UI", Arial, sans-serif';
  ctx.fillText(truncateText(ctx, cleanCanvasText(data.clubAndNation), hz.w - 44), hz.x + 22, hz.y + 96);
  ctx.restore();

  // 2. 12-Stat Matrix Grid (45, 170, 560x320) -> 2 columns x 6 rows
  const cz = spec.containerZone;
  const colW = 250;
  const rowH = 44;
  const colX1 = cz.x + 22;
  const colX2 = cz.x + 292;
  const startY = cz.y + 24;

  const shownStats = data.stats.slice(0, 12);
  for (let i = 0; i < shownStats.length; i++) {
    const item = shownStats[i];
    const isRightCol = i >= 6;
    const rowIdx = i % 6;
    const bx = isRightCol ? colX2 : colX1;
    const by = startY + rowIdx * (rowH + 5);

    ctx.save();
    drawRoundedRect(ctx, bx, by, colW, rowH - 2, 8);
    ctx.fillStyle = 'rgba(7, 11, 22, 0.82)';
    ctx.fill();
    ctx.strokeStyle = item.highlight ? accent : 'rgba(148, 163, 184, 0.28)';
    ctx.lineWidth = item.highlight ? 1.4 : 1;
    ctx.stroke();

    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#cbd5e1';
    ctx.font = 'bold 11px "Segoe UI", Arial, sans-serif';
    ctx.fillText(cleanCanvasText(item.label).toUpperCase(), bx + 12, by + (rowH - 2) / 2);

    ctx.textAlign = 'right';
    ctx.fillStyle = item.highlight ? accent : '#ffffff';
    ctx.font = item.value.length >= 12 ? 'bold 14px "Segoe UI", Arial, sans-serif' : 'bold 16px "Segoe UI", Arial, sans-serif';
    ctx.fillText(truncateText(ctx, cleanCanvasText(item.value), 128), bx + colW - 12, by + (rowH - 2) / 2);
    ctx.restore();
  }

  // 3. Right Panel: Avatar Cutout + BTFW Crest + OVR Triad Matrix + Recent Form
  const avatarImg = await resolveAvatarImage(data.avatarUrl, data.equippedAvatar);
  const avCircle = spec.circles![0]; // (790, 145, r=70)
  drawCircularImage(ctx, avatarImg, avCircle.cx, avCircle.cy, 62, data.username, accent, false);
  await drawBrandLogoSeal(ctx, 922, 76, 19, accent);

  // Inner Triad + OVR Gauge inside (650, 255, 280x165)
  const radarBox = spec.slots![1];
  drawGlassScrim(ctx, radarBox.x + 2, radarBox.y + 2, radarBox.w - 4, radarBox.h - 4, 10, 0.76);
  ctx.save();
  ctx.textAlign = 'center';
  ctx.fillStyle = '#e2e8f0';
  ctx.font = 'bold 11px "Segoe UI", Arial, sans-serif';
  ctx.fillText('OVERALL RATING & TRIAD', radarBox.x + radarBox.w / 2, radarBox.y + 24);

  ctx.fillStyle = accent;
  ctx.font = 'bold 48px "Segoe UI", Arial, sans-serif';
  ctx.fillText(String(data.ovr), radarBox.x + radarBox.w / 2, radarBox.y + 74);

  // Divider
  ctx.strokeStyle = 'rgba(255,255,255,0.16)';
  ctx.beginPath();
  ctx.moveTo(radarBox.x + 28, radarBox.y + 92);
  ctx.lineTo(radarBox.x + radarBox.w - 28, radarBox.y + 92);
  ctx.stroke();

  const pillars = [
    { label: 'ATK', val: data.atk, x: radarBox.x + 56 },
    { label: 'MID', val: data.mid, x: radarBox.x + 140 },
    { label: 'DEF', val: data.def, x: radarBox.x + 224 },
  ];
  for (const p of pillars) {
    ctx.fillStyle = '#cbd5e1';
    ctx.font = 'bold 11px "Segoe UI", Arial, sans-serif';
    ctx.fillText(p.label, p.x, radarBox.y + 116);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 22px "Segoe UI", Arial, sans-serif';
    ctx.fillText(String(p.val), p.x, radarBox.y + 144);
  }
  ctx.restore();

  // Recent Form / Milestone Strip (650, 430, 280x46)
  const formBox = spec.slots![2];
  drawGlassScrim(ctx, formBox.x + 2, formBox.y + 2, formBox.w - 4, formBox.h - 4, 8, 0.76);
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const formText = data.milestones.length > 0
    ? data.milestones.slice(0, 2).join('  •  ')
    : `FORM: ${data.recentForm.slice(-5).join(' • ')}`;
  ctx.fillStyle = '#f8fafc';
  ctx.font = 'bold 12px "Segoe UI", Arial, sans-serif';
  ctx.fillText(truncateText(ctx, cleanCanvasText(formText), formBox.w - 20), formBox.x + formBox.w / 2, formBox.y + formBox.h / 2);
  ctx.restore();

  // 4. Footer Bar (45, 500, 910x28)
  const fz = spec.footerZone!;
  drawGlassScrim(ctx, fz.x + 6, fz.y + 2, fz.w - 12, fz.h - 4, 6, 0.78);
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#e2e8f0';
  ctx.font = 'bold 12px "Segoe UI", Arial, sans-serif';
  ctx.fillText(truncateText(ctx, cleanCanvasText(data.footerSummary), fz.w - 30), fz.x + fz.w / 2, fz.y + fz.h / 2 + 1);
  ctx.restore();

  return canvas.toBuffer('image/png');
}

// =========================================================================
// 2b. PLAYER BIOMECHANICS (15-ATTR) MATRIX & HEX RADAR RENDERER [1000x550]
// =========================================================================

export interface PlayerBiomechanicsCanvasData {
  username: string;
  clubAndNation: string;
  seasonRank: string;
  vipTier: number;
  avatarUrl?: string | null;
  equippedAvatar?: string | null;
  playstyleCode: string;
  playstyleName: string;
  position: string;
  keyStats: string[];
  trainingPoints: number;
  ovr: number;
  atk: number;
  mid: number;
  def: number;
  intelSummary: string;
  bootsSummary: string;
  attributes: {
    fin: number;
    pow: number;
    hea: number;
    pas: number;
    vis: number;
    cro: number;
    dri: number;
    tck: number;
    int: number;
    mrk: number;
    pac: number;
    phy: number;
    cmp: number;
    agi: number;
    wrk: number;
  };
  themeKey?: string | null;
}

function getBiomechBarColor(val: number, isKey: boolean): string {
  if (val >= 85) return '#f59e0b';
  if (val >= 75) return '#10b981';
  if (isKey) return '#38bdf8';
  return '#06b6d4';
}

function drawStatRadarHexagon(
  ctx: SKRSContext2D,
  cx: number,
  cy: number,
  maxR: number,
  axes: Array<{ label: string; value: number }>,
  strokeColor: string,
  fillRgba: string
) {
  const n = axes.length;
  const angleAt = (idx: number) => -Math.PI / 2 + (idx * Math.PI * 2) / n;

  // Web rings (33%, 66%, 100%)
  ctx.save();
  for (const ratio of [0.33, 0.66, 1.0]) {
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const a = angleAt(i);
      const px = cx + Math.cos(a) * maxR * ratio;
      const py = cy + Math.sin(a) * maxR * ratio;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.strokeStyle = ratio === 1 ? 'rgba(148, 163, 184, 0.36)' : 'rgba(148, 163, 184, 0.18)';
    ctx.lineWidth = ratio === 1 ? 1.2 : 1;
    ctx.stroke();
  }

  // Axis spokes
  for (let i = 0; i < n; i++) {
    const a = angleAt(i);
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(a) * maxR, cy + Math.sin(a) * maxR);
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.2)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  // Filled attribute polygon
  ctx.beginPath();
  const points: Array<{ x: number; y: number }> = [];
  for (let i = 0; i < n; i++) {
    const norm = Math.max(0.18, Math.min(1, axes[i].value / 99));
    const a = angleAt(i);
    const px = cx + Math.cos(a) * maxR * norm;
    const py = cy + Math.sin(a) * maxR * norm;
    points.push({ x: px, y: py });
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fillStyle = fillRgba;
  ctx.fill();
  ctx.strokeStyle = strokeColor;
  ctx.lineWidth = 2.2;
  ctx.stroke();

  // Glowing vertex markers
  for (const pt of points) {
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, 3.2, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  // Vertex labels outside hexagon perimeter
  for (let i = 0; i < n; i++) {
    const a = angleAt(i);
    const cos = Math.cos(a);
    const sin = Math.sin(a);
    const labelDist = maxR + (Math.abs(sin) > 0.85 ? 16 : 15);
    const lx = cx + cos * labelDist;
    const ly = cy + sin * labelDist;

    ctx.textBaseline = 'middle';
    ctx.textAlign = Math.abs(cos) < 0.2 ? 'center' : cos > 0 ? 'left' : 'right';
    ctx.fillStyle = '#94a3b8';
    ctx.font = 'bold 10px "Segoe UI", Arial, sans-serif';
    const text = `${axes[i].label} `;
    const valStr = String(axes[i].value);
    if (ctx.textAlign === 'center') {
      ctx.fillStyle = '#e2e8f0';
      ctx.fillText(`${axes[i].label} ${valStr}`, lx, ly);
    } else if (ctx.textAlign === 'left') {
      ctx.fillStyle = '#cbd5e1';
      ctx.fillText(text, lx, ly);
      const tw = ctx.measureText(text).width;
      ctx.fillStyle = strokeColor;
      ctx.fillText(valStr, lx + tw, ly);
    } else {
      ctx.fillStyle = strokeColor;
      ctx.fillText(valStr, lx, ly);
      const vw = ctx.measureText(valStr).width;
      ctx.fillStyle = '#cbd5e1';
      ctx.fillText(text, lx - vw, ly);
    }
  }
  ctx.restore();
}

export async function renderPlayerBiomechanicsCanvas(data: PlayerBiomechanicsCanvasData): Promise<Buffer> {
  const spec = PLAYER_STAT_CARD_SPEC;
  const width = spec.canvasWidth;   // 1000
  const height = spec.canvasHeight; // 550
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  const theme = await paintThemeBackdrop(ctx, width, height, 'player_stat_card', data.themeKey);
  const accent = data.vipTier >= 1 ? '#f59e0b' : theme.accent;
  const keySet = new Set(data.keyStats.map(k => k.toLowerCase()));

  // 1. Header Zone (45, 45, 560x110)
  const hz = spec.headerZone;
  drawGlassScrim(ctx, hz.x + 8, hz.y + 8, hz.w - 16, hz.h - 16, 8, 0.76);
  ctx.save();
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';

  const eyebrow = `BIOMECHANICS MATRIX (15)  •  ${cleanCanvasText(data.playstyleName).toUpperCase()} (${data.position})`;
  ctx.fillStyle = accent;
  ctx.font = 'bold 11.5px "Segoe UI", Arial, sans-serif';
  ctx.fillText(eyebrow, hz.x + 22, hz.y + 33);

  // TP Available Pill top-right of header
  const tpPillX = hz.x + hz.w - 140;
  const tpPillY = hz.y + 18;
  drawRoundedRect(ctx, tpPillX, tpPillY, 118, 24, 6);
  ctx.fillStyle = 'rgba(6, 182, 212, 0.18)';
  ctx.fill();
  ctx.strokeStyle = '#22d3ee';
  ctx.lineWidth = 1.2;
  ctx.stroke();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#67e8f9';
  ctx.font = 'bold 11px "Segoe UI", Arial, sans-serif';
  ctx.fillText(`${data.trainingPoints} TP READY`, tpPillX + 59, tpPillY + 12.5);

  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 29px "Segoe UI", Arial, sans-serif';
  ctx.fillText(truncateText(ctx, cleanCanvasText(data.username), hz.w - 172), hz.x + 22, hz.y + 71);

  const keyDisplay = data.keyStats.map(s => s.toUpperCase()).join(' · ');
  ctx.fillStyle = '#cbd5e1';
  ctx.font = 'bold 12px "Segoe UI", Arial, sans-serif';
  ctx.fillText(truncateText(ctx, `KEY FOCUS: ${keyDisplay}  •  ${cleanCanvasText(data.clubAndNation)}`, hz.w - 44), hz.x + 22, hz.y + 96);
  ctx.restore();

  // 2. 15-Attribute Biomechanical Bars inside Container Arena (45, 170, 560x320)
  const a = data.attributes;
  const drawAttrGroup = (
    gx: number,
    gy: number,
    gw: number,
    title: string,
    titleAccent: string,
    items: Array<{ key: string; code: string; name: string; val: number }>
  ) => {
    ctx.save();
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = titleAccent;
    ctx.font = 'bold 10.5px "Segoe UI", Arial, sans-serif';
    ctx.fillText(title, gx + 4, gy + 8);
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.2)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(gx + ctx.measureText(title).width + 12, gy + 8);
    ctx.lineTo(gx + gw, gy + 8);
    ctx.stroke();

    const rowPitch = 29;
    const pillH = 25;
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const isKey = keySet.has(item.key);
      const by = gy + 22 + i * rowPitch;

      drawRoundedRect(ctx, gx, by, gw, pillH, 6);
      ctx.fillStyle = isKey ? 'rgba(15, 23, 42, 0.90)' : 'rgba(7, 11, 22, 0.84)';
      ctx.fill();
      ctx.strokeStyle = isKey ? 'rgba(250, 204, 21, 0.65)' : 'rgba(148, 163, 184, 0.24)';
      ctx.lineWidth = isKey ? 1.3 : 1;
      ctx.stroke();

      if (isKey) {
        drawRoundedRect(ctx, gx + 2, by + 4, 3, pillH - 8, 1.5);
        ctx.fillStyle = '#facc15';
        ctx.fill();
      }

      ctx.textAlign = 'left';
      ctx.fillStyle = isKey ? '#fde047' : titleAccent;
      ctx.font = 'bold 10.5px Consolas, monospace';
      ctx.fillText(item.code, gx + 10, by + pillH / 2 + 0.5);

      ctx.fillStyle = '#e2e8f0';
      ctx.font = 'bold 11.5px "Segoe UI", Arial, sans-serif';
      ctx.fillText(item.name, gx + 40, by + pillH / 2 + 0.5);

      // Neon progress track
      const barX = gx + 128;
      const barW = 86;
      const barY = by + 9;
      drawRoundedRect(ctx, barX, barY, barW, 7, 3.5);
      ctx.fillStyle = 'rgba(148, 163, 184, 0.22)';
      ctx.fill();

      const fillW = Math.max(5, Math.round((Math.min(99, Math.max(0, item.val)) / 99) * barW));
      drawRoundedRect(ctx, barX, barY, fillW, 7, 3.5);
      ctx.fillStyle = getBiomechBarColor(item.val, isKey);
      ctx.fill();

      ctx.textAlign = 'right';
      ctx.fillStyle = isKey ? '#fde047' : '#ffffff';
      ctx.font = 'bold 13px "Segoe UI", Arial, sans-serif';
      ctx.fillText(String(item.val), gx + gw - 9, by + pillH / 2 + 0.5);
    }
    ctx.restore();
  };

  const col1X = spec.containerZone.x + 16; // 61
  const col2X = spec.containerZone.x + 288; // 333
  const colW = 256;

  drawAttrGroup(col1X, 182, colW, 'ATTACKING (3)', '#f87171', [
    { key: 'fin', code: 'FIN', name: 'Finishing', val: a.fin },
    { key: 'pow', code: 'POW', name: 'Shot Power', val: a.pow },
    { key: 'hea', code: 'HEA', name: 'Heading', val: a.hea },
  ]);

  drawAttrGroup(col1X, 300, colW, 'TECHNICAL (4)', '#38bdf8', [
    { key: 'pas', code: 'PAS', name: 'Passing', val: a.pas },
    { key: 'vis', code: 'VIS', name: 'Vision', val: a.vis },
    { key: 'cro', code: 'CRO', name: 'Crossing', val: a.cro },
    { key: 'dri', code: 'DRI', name: 'Dribbling', val: a.dri },
  ]);

  // Role affinity legend aligning bottom of Col 1 with Col 2's 5th row
  ctx.save();
  drawRoundedRect(ctx, col1X, 439, colW, 25, 6);
  ctx.fillStyle = 'rgba(250, 204, 21, 0.10)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(250, 204, 21, 0.35)';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#fde047';
  ctx.font = 'bold 10.5px "Segoe UI", Arial, sans-serif';
  ctx.fillText(`GOLD BORDER = KEY ${cleanCanvasText(data.playstyleCode)} BIOMETRICS`, col1X + colW / 2, 452);
  ctx.restore();

  drawAttrGroup(col2X, 182, colW, 'DEFENDING (3)', '#60a5fa', [
    { key: 'tck', code: 'TCK', name: 'Tackling', val: a.tck },
    { key: 'int', code: 'INT', name: 'Intercept.', val: a.int },
    { key: 'mrk', code: 'MRK', name: 'Marking', val: a.mrk },
  ]);

  drawAttrGroup(col2X, 300, colW, 'PHYSICAL & MENTAL (5)', '#facc15', [
    { key: 'pac', code: 'PAC', name: 'Pace', val: a.pac },
    { key: 'phy', code: 'PHY', name: 'Physicality', val: a.phy },
    { key: 'cmp', code: 'CMP', name: 'Composure', val: a.cmp },
    { key: 'agi', code: 'AGI', name: 'Agility', val: a.agi },
    { key: 'wrk', code: 'WRK', name: 'Work Rate', val: a.wrk },
  ]);

  // 3. Right Panel: Avatar + BTFW Crest + 6-Axis Radar Hexagon + Triad Readout
  const avatarImg = await resolveAvatarImage(data.avatarUrl, data.equippedAvatar);
  const avCircle = spec.circles![0];
  drawCircularImage(ctx, avatarImg, avCircle.cx, avCircle.cy, 62, data.username, accent, false);
  await drawBrandLogoSeal(ctx, 922, 76, 19, accent);

  const radarBox = spec.slots![1]; // (650, 255, 280x165)
  drawGlassScrim(ctx, radarBox.x + 2, radarBox.y + 2, radarBox.w - 4, radarBox.h - 4, 10, 0.80);

  const radarStroke = data.vipTier >= 1 ? '#facc15' : '#22d3ee';
  const radarFill = data.vipTier >= 1 ? 'rgba(250, 204, 21, 0.24)' : 'rgba(6, 182, 212, 0.28)';
  const radarAxes = [
    { label: 'PAC', value: a.pac },
    { label: 'SHO', value: Math.round((a.fin + a.pow + a.hea) / 3) },
    { label: 'PAS', value: Math.round((a.pas + a.vis + a.cro) / 3) },
    { label: 'DRI', value: Math.round((a.dri + a.agi + a.cmp) / 3) },
    { label: 'DEF', value: Math.round((a.tck + a.int + a.mrk) / 3) },
    { label: 'PHY', value: Math.round((a.phy + a.wrk) / 2) },
  ];
  drawStatRadarHexagon(ctx, radarBox.x + radarBox.w / 2, radarBox.y + 85, 43, radarAxes, radarStroke, radarFill);

  const formBox = spec.slots![2]; // (650, 430, 280x46)
  drawGlassScrim(ctx, formBox.x + 2, formBox.y + 2, formBox.w - 4, formBox.h - 4, 8, 0.78);
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#f8fafc';
  ctx.font = 'bold 13px "Segoe UI", Arial, sans-serif';
  ctx.fillText(`ATK ${data.atk}   •   MID ${data.mid}   •   DEF ${data.def}   •   OVR ${data.ovr}`, formBox.x + formBox.w / 2, formBox.y + formBox.h / 2);
  ctx.restore();

  // 4. Footer Bar (45, 500, 910x28)
  const fz = spec.footerZone!;
  drawGlassScrim(ctx, fz.x + 6, fz.y + 2, fz.w - 12, fz.h - 4, 6, 0.80);
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#e2e8f0';
  ctx.font = 'bold 12px "Segoe UI", Arial, sans-serif';
  ctx.fillText(
    truncateText(
      ctx,
      cleanCanvasText(`UPGRADE LAB: -travel rf -> -sptrain <attr>  •  BOOTS: ${data.bootsSummary}  •  INTEL: ${data.intelSummary}`),
      fz.w - 30
    ),
    fz.x + fz.w / 2,
    fz.y + fz.h / 2 + 1
  );
  ctx.restore();

  return canvas.toBuffer('image/png');
}

// =========================================================================
// 3. SHOWROOM VEHICLE DEALERSHIP RENDERER (-showroom) [1024x764]
// =========================================================================

export interface ShowroomCardItem {
  key: string;
  name: string;
  cooldownMinutes: number;
  price: bigint;
  owned: boolean;
  spriteMode: 'full' | 'split';
  spritePrefix: string; // e.g. 'mini', 'hc'
}

async function drawVehicleSprite(ctx: SKRSContext2D, item: ShowroomCardItem, x: number, y: number, w: number, h: number) {
  const hiresDir = path.resolve(process.cwd(), 'assets', 'emojis_hires');
  try {
    if (item.spriteMode === 'full') {
      const fullPath = path.join(hiresDir, `${item.spritePrefix}full.png`);
      if (fs.existsSync(fullPath)) {
        const img = await loadLocalImageCached(fullPath);
        ctx.drawImage(img, x, y, w, h);
        return;
      }
    } else {
      const fPath = path.join(hiresDir, `${item.spritePrefix}front.png`);
      const bPath = path.join(hiresDir, `${item.spritePrefix}back.png`);
      if (fs.existsSync(fPath) && fs.existsSync(bPath)) {
        const [fImg, bImg] = await Promise.all([loadLocalImageCached(fPath), loadLocalImageCached(bPath)]);
        const halfW = Math.floor(w / 2);
        // Right-facing Discord emojis list front + back side-by-side
        ctx.drawImage(fImg, x, y + 6, halfW, h - 12);
        ctx.drawImage(bImg, x + halfW - 2, y + 6, halfW, h - 12);
        return;
      }
    }
  } catch {
    // Fallback emblem below
  }

  ctx.save();
  ctx.fillStyle = '#38bdf8';
  ctx.font = 'bold 14px "Segoe UI", Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(item.key.toUpperCase(), x + w / 2, y + h / 2);
  ctx.restore();
}

export async function renderShowroomCanvas(options: {
  pageTitle: string;
  page: number;
  totalPages: number;
  currentRide: string;
  currentCooldown: number;
  walletCoins: bigint;
  items: ShowroomCardItem[];
  themeKey?: string | null;
}): Promise<Buffer> {
  const spec = SHOWROOM_MARKET_GRID_SPEC;
  const width = spec.canvasWidth;   // 1024
  const height = spec.canvasHeight; // 764
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  const theme = await paintThemeBackdrop(ctx, width, height, 'showroom', options.themeKey);

  // 1. Header Zone (102, 112, 820x90)
  const hz = spec.headerZone;
  drawGlassScrim(ctx, hz.x + 8, hz.y + 8, hz.w - 16, hz.h - 16, 8, 0.72);
  await drawBrandLogoSeal(ctx, hz.x + 48, hz.y + hz.h / 2, 26, theme.accent);
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#ffffff';
  drawFittedText(
    ctx,
    cleanCanvasText(options.pageTitle).toUpperCase(),
    hz.x + hz.w / 2 + 12,
    hz.y + 32,
    hz.w - 170,
    '"Segoe UI", Arial, sans-serif',
    26,
    18
  );

  ctx.fillStyle = '#fde047';
  drawFittedText(
    ctx,
    `CURRENT RIDE: ${cleanCanvasText(options.currentRide).toUpperCase()} (${options.currentCooldown}M CD)  •  WALLET: ${formatK(options.walletCoins)} COINS  •  PAGE ${options.page}/${options.totalPages}`,
    hz.x + hz.w / 2 + 12,
    hz.y + 66,
    hz.w - 170,
    '"Segoe UI", Arial, sans-serif',
    13,
    10
  );
  ctx.restore();

  // 2. Render up to 6 Vehicle Cards inside slots[0..5]
  const cards = options.items.slice(0, 6);
  for (let i = 0; i < cards.length; i++) {
    const car = cards[i];
    const slot = spec.slots![i];

    drawGlassScrim(ctx, slot.x + 132, slot.y + 12, slot.w - 142, slot.h - 24, 6, 0.74);

    if (car.owned) {
      ctx.save();
      drawRoundedRect(ctx, slot.x + 2, slot.y + 2, slot.w - 4, slot.h - 4, 8);
      ctx.strokeStyle = '#10b981';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();
    }

    // Left Vehicle Sprite Display (w: 116x88)
    await drawVehicleSprite(ctx, car, slot.x + 12, slot.y + 16, 116, 88);

    // Right Info Block — strictly bounded inside the dark scrim (tx: +142 .. slot.w - 22)
    const tx = slot.x + 142;
    const tw = slot.w - 166;
    ctx.save();
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';

    ctx.fillStyle = '#ffffff';
    drawFittedText(
      ctx,
      cleanCanvasText(car.name).toUpperCase(),
      tx,
      slot.y + 34,
      tw,
      '"Segoe UI", Arial, sans-serif',
      17,
      12.5
    );

    ctx.fillStyle = '#cbd5e1';
    drawFittedText(
      ctx,
      `alias: ${cleanCanvasText(car.key)}  •  ${car.cooldownMinutes}m travel`,
      tx,
      slot.y + 58,
      tw,
      '"Segoe UI", Arial, sans-serif',
      12.5,
      10
    );

    // Bottom Price + Owned Badge
    ctx.fillStyle = car.owned ? '#34d399' : '#facc15';
    const priceMaxW = car.owned ? tw - 84 : tw;
    drawFittedText(
      ctx,
      `${formatK(car.price)} COINS`,
      tx,
      slot.y + 92,
      priceMaxW,
      '"Segoe UI", Arial, sans-serif',
      18,
      13.5
    );

    if (car.owned) {
      ctx.fillStyle = 'rgba(16, 185, 129, 0.25)';
      drawRoundedRect(ctx, slot.x + slot.w - 88, slot.y + 72, 76, 26, 6);
      ctx.fill();
      ctx.strokeStyle = '#10b981';
      ctx.lineWidth = 1.2;
      ctx.stroke();
      ctx.textAlign = 'center';
      ctx.fillStyle = '#a7f3d0';
      ctx.font = 'bold 11px "Segoe UI", Arial, sans-serif';
      ctx.fillText('OWNED', slot.x + slot.w - 50, slot.y + 89);
    }
    ctx.restore();
  }

  if (cards.length < 6 && spec.slots![5]) {
    const slot = spec.slots![5];
    drawGlassScrim(ctx, slot.x + 10, slot.y + 10, slot.w - 20, slot.h - 20, 8, 0.76);
    ctx.save();
    drawRoundedRect(ctx, slot.x + 10, slot.y + 10, slot.w - 20, slot.h - 20, 8);
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.35)';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 11px "Segoe UI", Arial, sans-serif';
    ctx.fillText(`SHOWROOM TIER ${options.page}/${options.totalPages}`, slot.x + 26, slot.y + 36);

    ctx.fillStyle = '#ffffff';
    drawFittedText(ctx, `${cards.length} MODELS ON THIS FLOOR`, slot.x + 26, slot.y + 62, slot.w - 52, '"Segoe UI", Arial, sans-serif', 16, 12);

    ctx.fillStyle = '#cbd5e1';
    drawFittedText(
      ctx,
      `Ride: ${cleanCanvasText(options.currentRide)} (${options.currentCooldown}m CD)`,
      slot.x + 26,
      slot.y + 90,
      slot.w - 52,
      '"Segoe UI", Arial, sans-serif',
      12.5,
      10
    );
    ctx.restore();
  }

  // 3. Footer Zone (102, 682, 820x42)
  const fz = spec.footerZone!;
  drawGlassScrim(ctx, fz.x + 8, fz.y + 4, fz.w - 16, fz.h - 8, 6, 0.80);
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#7dd3fc';
  ctx.font = 'bold 13px "Segoe UI", Arial, sans-serif';
  ctx.fillText('GLOBAL MARKET DEALERSHIP (-travel gm)  •  BUY VIA -vehiclebuy <alias>', fz.x + fz.w / 2, fz.y + fz.h / 2 + 1);
  ctx.restore();

  return canvas.toBuffer('image/png');
}

// =========================================================================
// 4. AUCTION HOUSE COLLECTOR VAULT RENDERER (-ah) [1024x764]
// =========================================================================

export interface AuctionLotCanvasData {
  lotNumber: number;
  itemKey: string;
  itemName: string;
  description: string;
  leaderName: string | null;
  currentOrStartBid: bigint;
  minNextBid: bigint;
  timeRemaining: string;
}

function resolveRelicSpritePath(itemKey: string): string | null {
  const hiresDir = path.resolve(process.cwd(), 'assets', 'emojis_hires');
  const map: Record<string, string> = {
    worldcup_replica: 'worldcup.png',
    golden_boot_relic: 'goldenboot.png',
    ballon_trophy: 'motm.png',
  };
  const file = map[itemKey];
  if (file) {
    const p = path.join(hiresDir, file);
    if (fs.existsSync(p)) return p;
  }
  return null;
}

export async function renderAuctionHouseCanvas(
  lots: AuctionLotCanvasData[],
  themeKey?: string | null
): Promise<Buffer> {
  const spec = AUCTION_HOUSE_GRID_SPEC;
  const width = spec.canvasWidth;   // 1024
  const height = spec.canvasHeight; // 764
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  const theme = await paintThemeBackdrop(ctx, width, height, 'auction_house', themeKey);

  // Header Zone (102, 112, 820x90)
  const hz = spec.headerZone;
  drawGlassScrim(ctx, hz.x + 8, hz.y + 8, hz.w - 16, hz.h - 16, 8, 0.74);
  await drawBrandLogoSeal(ctx, hz.x + 48, hz.y + hz.h / 2, 26, theme.accent);
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 26px "Segoe UI", Arial, sans-serif';
  ctx.fillText('COLLECTOR AUCTION HOUSE VAULT', hz.x + hz.w / 2 + 12, hz.y + 32);
  ctx.fillStyle = '#fde047';
  ctx.font = 'bold 13px "Segoe UI", Arial, sans-serif';
  ctx.fillText('ESCROWED DAILY RELIC AUCTIONS  •  +2M ANTI-SNIPE PROTECTION UNDER 60S', hz.x + hz.w / 2 + 12, hz.y + 66);
  ctx.restore();

  // Render up to 2 side-by-side Collector Pedestals
  const shown = lots.slice(0, 2);
  for (let i = 0; i < shown.length; i++) {
    const lot = shown[i];
    const slot = spec.slots![i];
    const dome = spec.circles![i]; // (312, 350, r=58) & (712, 350, r=58)
    const accent = i === 0 ? '#facc15' : '#38bdf8';

    // Lot Number Pill Top Left
    ctx.save();
    drawRoundedRect(ctx, slot.x + 16, slot.y + 14, 78, 24, 6);
    ctx.fillStyle = 'rgba(250, 204, 21, 0.16)';
    ctx.fill();
    ctx.strokeStyle = accent;
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = accent;
    ctx.font = 'bold 12px "Segoe UI", Arial, sans-serif';
    ctx.fillText(`LOT #${lot.lotNumber}`, slot.x + 55, slot.y + 26);

    // Countdown Top Right
    ctx.textAlign = 'right';
    ctx.fillStyle = '#fb7185';
    ctx.font = 'bold 13px Consolas, monospace';
    ctx.fillText(`ENDS: ${lot.timeRemaining}`, slot.x + slot.w - 16, slot.y + 26);
    ctx.restore();

    // Relic Sprite inside spotlight dome
    const spritePath = resolveRelicSpritePath(lot.itemKey);
    if (spritePath) {
      const img = await loadLocalImageCached(spritePath);
      ctx.drawImage(img, dome.cx - 42, dome.cy - 42, 84, 84);
    } else {
      ctx.save();
      ctx.fillStyle = accent;
      ctx.font = 'bold 28px "Segoe UI", Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('RELIC', dome.cx, dome.cy);
      ctx.restore();
    }

    // Details below dome
    const cx = slot.x + slot.w / 2;
    drawGlassScrim(ctx, slot.x + 18, slot.y + 162, slot.w - 36, 62, 6, 0.72);
    ctx.save();
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 20px "Segoe UI", Arial, sans-serif';
    ctx.fillText(truncateText(ctx, cleanCanvasText(lot.itemName).toUpperCase(), slot.w - 44), cx, slot.y + 186);

    ctx.fillStyle = '#e2e8f0';
    ctx.font = '12px "Segoe UI", Arial, sans-serif';
    ctx.fillText(truncateText(ctx, cleanCanvasText(lot.description), slot.w - 48), cx, slot.y + 212);

    // Escrow Metrics Box
    drawRoundedRect(ctx, slot.x + 22, slot.y + 234, slot.w - 44, 134, 10);
    ctx.fillStyle = 'rgba(5, 9, 18, 0.86)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.16)';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = '#cbd5e1';
    ctx.font = 'bold 11px "Segoe UI", Arial, sans-serif';
    ctx.fillText(lot.leaderName ? 'HIGHEST BIDDER' : 'OPENING RESERVE PRICE', cx, slot.y + 258);

    ctx.fillStyle = lot.leaderName ? '#7dd3fc' : '#f1f5f9';
    ctx.font = 'bold 17px "Segoe UI", Arial, sans-serif';
    ctx.fillText(truncateText(ctx, cleanCanvasText(lot.leaderName || 'NO BIDS YET'), slot.w - 70), cx, slot.y + 282);

    ctx.fillStyle = accent;
    ctx.font = 'bold 24px "Segoe UI", Arial, sans-serif';
    ctx.fillText(`${formatK(lot.currentOrStartBid)} COINS`, cx, slot.y + 318);

    ctx.fillStyle = '#6ee7b7';
    ctx.font = 'bold 12px "Segoe UI", Arial, sans-serif';
    ctx.fillText(`MIN NEXT BID: ${formatK(lot.minNextBid)} COINS`, cx, slot.y + 348);
    ctx.restore();
  }

  // Footer Zone (102, 682, 820x42)
  const fz = spec.footerZone!;
  drawGlassScrim(ctx, fz.x + 8, fz.y + 4, fz.w - 16, fz.h - 8, 6, 0.80);
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#7dd3fc';
  ctx.font = 'bold 13px "Segoe UI", Arial, sans-serif';
  ctx.fillText('TRAVEL TO AUCTION HALL (-travel ah)  •  PLACE ESCROWED BIDS VIA -bid <amount> [lot#]', fz.x + fz.w / 2, fz.y + fz.h / 2 + 1);
  ctx.restore();

  return canvas.toBuffer('image/png');
}

// =========================================================================
// 5. COMPETITION STANDINGS / POINTS TABLE RENDERER [1200x900]
// =========================================================================

export interface StandingsRowData {
  rank: number;
  teamName: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  gf: number;
  ga: number;
  gd: number;
  points: number;
}

export async function renderStandingsTableCanvas(options: {
  title: string;
  subtitle: string;
  rows: StandingsRowData[];
  footerText?: string;
  themeKey?: string | null;
}): Promise<Buffer> {
  const spec = STANDINGS_TABLE_GRID_SPEC;
  const width = spec.canvasWidth;   // 1200
  const height = spec.canvasHeight; // 900
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  const theme = await paintThemeBackdrop(ctx, width, height, 'points_table', options.themeKey);

  // Header Zone (60, 44, 1080x96)
  const hz = spec.headerZone;
  drawGlassScrim(ctx, hz.x + 8, hz.y + 6, hz.w - 16, hz.h - 12, 8, 0.74);
  await drawBrandLogoSeal(ctx, hz.x + 54, hz.y + hz.h / 2, 28, theme.accent);
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 32px "Segoe UI", Arial, sans-serif';
  ctx.fillText(truncateText(ctx, cleanCanvasText(options.title).toUpperCase(), hz.w - 180), hz.x + hz.w / 2 + 12, hz.y + 34);
  ctx.fillStyle = '#fde047';
  ctx.font = 'bold 14px "Segoe UI", Arial, sans-serif';
  ctx.fillText(truncateText(ctx, cleanCanvasText(options.subtitle).toUpperCase(), hz.w - 180), hz.x + hz.w / 2 + 12, hz.y + 72);
  ctx.restore();

  // Column Labels (60..1140 at y:160..208)
  drawGlassScrim(ctx, 64, 162, 1072, 44, 6, 0.78);
  ctx.save();
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#facc15';
  ctx.font = 'bold 14px "Segoe UI", Arial, sans-serif';
  for (const col of spec.columns!) {
    ctx.textAlign = col.label === 'TEAM / NATION' ? 'left' : 'center';
    const tx = col.label === 'TEAM / NATION' ? col.x + 14 : col.x + col.w / 2;
    ctx.fillText(col.label, tx, col.y + col.h / 2);
  }
  ctx.restore();

  // 8 Team Rows
  const shown = options.rows.slice(0, 8);
  for (let i = 0; i < shown.length; i++) {
    const r = shown[i];
    const rowSpec = spec.rows![i];
    const cy = rowSpec.yCenter;
    drawGlassScrim(ctx, 64, cy - 26, 1072, 52, 6, 0.72);
    const cols = spec.columns!;
    const vals = [
      String(r.rank),
      truncateText(ctx, cleanCanvasText(r.teamName), 355),
      String(r.played),
      String(r.won),
      String(r.drawn),
      String(r.lost),
      String(r.gf),
      String(r.ga),
      r.gd >= 0 ? `+${r.gd}` : String(r.gd),
      String(r.points),
    ];

    ctx.save();
    ctx.textBaseline = 'middle';
    for (let c = 0; c < cols.length; c++) {
      const col = cols[c];
      const isTeam = c === 1;
      const isPts = c === 9;
      ctx.textAlign = isTeam ? 'left' : 'center';
      ctx.fillStyle = isPts ? '#facc15' : c === 0 && r.rank <= 3 ? theme.accent : '#f8fafc';
      ctx.font = isPts || isTeam ? 'bold 18px "Segoe UI", Arial, sans-serif' : '16px "Segoe UI", Arial, sans-serif';
      const tx = isTeam ? col.x + 14 : col.x + col.w / 2;
      ctx.fillText(vals[c], tx, cy);
    }
    ctx.restore();
  }

  // Footer Zone (60, 824, 1080x46)
  if (options.footerText) {
    const fz = spec.footerZone!;
    drawGlassScrim(ctx, fz.x + 8, fz.y + 4, fz.w - 16, fz.h - 8, 6, 0.80);
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 13px "Segoe UI", Arial, sans-serif';
    ctx.fillText(cleanCanvasText(options.footerText), fz.x + fz.w / 2, fz.y + fz.h / 2);
    ctx.restore();
  }

  return canvas.toBuffer('image/png');
}

export function getDualBoxSpec() {
  return DUAL_BOX_UNIVERSAL_SPEC;
}
