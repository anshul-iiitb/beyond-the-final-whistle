import { createCanvas, SKRSContext2D } from '@napi-rs/canvas';
import fs from 'fs';
import path from 'path';
import { COSMETIC_CATALOG, PROFILE_THEMES } from '../config/constants.js';
import { formatK } from './formatHelper.js';
import {
  cleanCanvasText,
  drawBrandLogoSeal,
  drawCircularImage,
  drawGlassScrim,
  loadLocalImageCached,
  paintThemeBackdrop,
  renderEquippedBannerPoster,
  resolveAvatarImage,
  resolveCosmeticAssetPath,
  resolveThemeAssetPath,
  truncateText,
} from './themeRenderers.js';

export interface ScorecardData {
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
  homePossession: number;
  awayPossession: number;
  motmName: string;
  motmRating: number;
  homeFlag?: string;
  awayFlag?: string;
  homeColor?: [number, number, number];
  awayColor?: [number, number, number];
}

/**
 * Helper to determine if two RGB colors are too similar (low contrast)
 */
function areColorsTooClose(c1: [number, number, number], c2: [number, number, number]): boolean {
  const dist = Math.sqrt(
    Math.pow(c1[0] - c2[0], 2) +
    Math.pow(c1[1] - c2[1], 2) +
    Math.pow(c1[2] - c2[2], 2)
  );
  return dist < 85;
}

function rgbToHex(rgb: [number, number, number]): string {
  return '#' + rgb.map(x => x.toString(16).padStart(2, '0')).join('');
}

/**
 * Helper to draw rounded rectangles
 */
function roundRect(
  ctx: SKRSContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  radius: number
) {
  const r = Math.min(radius, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/**
 * Generates an authentic, high-definition broadcast-quality possession donut chart
 */
export function generatePossessionPieChart(
  teamAName: string,
  teamAPoss: number,
  teamAColor: [number, number, number] = [16, 185, 129], // Emerald
  teamBName: string,
  teamBPoss: number,
  teamBColor: [number, number, number] = [5, 150, 105]   // Default away
): Buffer {
  const width = 640;
  const height = 380;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  // Avoid blending if both teams use similar green/color palettes
  let colorA = rgbToHex(teamAColor);
  let colorB = areColorsTooClose(teamAColor, teamBColor)
    ? '#06b6d4' // Contrast Electric Cyan if away is also green
    : rgbToHex(teamBColor);

  // Background: Deep stadium obsidian
  const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
  bgGrad.addColorStop(0, '#090d16');
  bgGrad.addColorStop(1, '#0f172a');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, width, height);

  // Card Outer Glow Border
  roundRect(ctx, 16, 16, width - 32, height - 32, 16);
  ctx.strokeStyle = '#1e293b';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Top Accent Stripe
  const stripeGrad = ctx.createLinearGradient(0, 0, width, 0);
  stripeGrad.addColorStop(0, colorA);
  stripeGrad.addColorStop(0.5, '#f59e0b');
  stripeGrad.addColorStop(1, colorB);
  ctx.fillStyle = stripeGrad;
  ctx.fillRect(16, 16, width - 32, 4);

  // Header Title
  ctx.font = 'bold 13px "Segoe UI", Arial, sans-serif';
  ctx.fillStyle = '#f59e0b';
  ctx.textAlign = 'center';
  ctx.fillText('BEYOND THE FINAL WHISTLE • MATCHDAY ANALYTICS', width / 2, 44);

  // Legend Swatches at Top
  const legendY = 74;
  // Team A Legend
  roundRect(ctx, 80, legendY - 14, 18, 18, 5);
  ctx.fillStyle = colorA;
  ctx.fill();
  ctx.font = 'bold 15px "Segoe UI", Arial, sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'left';
  ctx.fillText(`${teamAName.toUpperCase()}  ${teamAPoss}%`, 108, legendY);

  // Team B Legend
  roundRect(ctx, width - 210, legendY - 14, 18, 18, 5);
  ctx.fillStyle = colorB;
  ctx.fill();
  ctx.font = 'bold 15px "Segoe UI", Arial, sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'left';
  ctx.fillText(`${teamBName.toUpperCase()}  ${teamBPoss}%`, width - 182, legendY);

  // Donut Geometry
  const cx = width / 2;
  const cy = 230;
  const outerR = 105;
  const innerR = 64;

  const total = teamAPoss + teamBPoss || 100;
  const angleA = (teamAPoss / total) * 2 * Math.PI;

  // Arc A (Team A)
  ctx.beginPath();
  ctx.arc(cx, cy, outerR, -Math.PI / 2, -Math.PI / 2 + angleA, false);
  ctx.arc(cx, cy, innerR, -Math.PI / 2 + angleA, -Math.PI / 2, true);
  ctx.closePath();
  ctx.fillStyle = colorA;
  ctx.shadowColor = colorA;
  ctx.shadowBlur = 10;
  ctx.fill();

  // Arc B (Team B)
  ctx.beginPath();
  ctx.arc(cx, cy, outerR, -Math.PI / 2 + angleA, -Math.PI / 2 + 2 * Math.PI, false);
  ctx.arc(cx, cy, innerR, -Math.PI / 2 + 2 * Math.PI, -Math.PI / 2 + angleA, true);
  ctx.closePath();
  ctx.fillStyle = colorB;
  ctx.shadowColor = colorB;
  ctx.shadowBlur = 10;
  ctx.fill();
  ctx.shadowBlur = 0; // reset shadow

  // Donut Center Hub
  ctx.beginPath();
  ctx.arc(cx, cy, innerR - 2, 0, 2 * Math.PI);
  ctx.fillStyle = '#0f172a';
  ctx.fill();
  ctx.strokeStyle = '#334155';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Donut Center Text
  ctx.textAlign = 'center';
  ctx.font = 'bold 11px "Segoe UI", Arial, sans-serif';
  ctx.fillStyle = '#94a3b8';
  ctx.fillText('BALL CONTROL', cx, cy - 6);
  ctx.font = 'bold 16px "Segoe UI", Arial, sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.fillText(`${teamAPoss}% : ${teamBPoss}%`, cx, cy + 14);

  // Footer Tagline
  ctx.font = '10px "Segoe UI", Arial, sans-serif';
  ctx.fillStyle = '#475569';
  ctx.fillText('OFFICIAL POSSESSION TELEMETRY BUREAU', width / 2, height - 24);

  return canvas.toBuffer('image/png');
}

/**
 * Generates an authentic dynamic matchday scorecard graphic for the Sports Gazette (800x410)
 */
export async function generateMatchScorecardGraphic(data: ScorecardData): Promise<Buffer> {
  const width = 800;
  const height = 410;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  // Determine contrasting team colors
  const homeColorRgb: [number, number, number] = data.homeColor || [16, 185, 129];
  const awayColorRgb: [number, number, number] = data.awayColor || [56, 189, 248];

  const colorHome = rgbToHex(homeColorRgb);
  const colorAway = areColorsTooClose(homeColorRgb, awayColorRgb)
    ? '#06b6d4'
    : rgbToHex(awayColorRgb);

  await paintThemeBackdrop(ctx, width, height, 'match_scorecard', 'obsidian');

  // Dark glass contrast scrims inside each frame zone
  drawGlassScrim(ctx, 44, 26, 712, 46, 8, 0.72);
  drawGlassScrim(ctx, 52, 98, 252, 88, 8, 0.70);
  drawGlassScrim(ctx, 322, 98, 156, 88, 8, 0.74);
  drawGlassScrim(ctx, 496, 98, 252, 88, 8, 0.70);
  drawGlassScrim(ctx, 52, 206, 696, 64, 8, 0.74);
  drawGlassScrim(ctx, 52, 290, 696, 70, 8, 0.74);

  // Header inside Top Header Zone (40, 24, 720x50)
  await drawBrandLogoSeal(ctx, 76, 49, 17, '#facc15');
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = 'bold 15px "Segoe UI", Arial, sans-serif';
  ctx.fillStyle = '#facc15';
  ctx.fillText('BEYOND THE FINAL WHISTLE  •  MATCHDAY TELEMETRY', width / 2, 42);

  ctx.font = 'bold 10px "Segoe UI", Arial, sans-serif';
  ctx.fillStyle = '#e2e8f0';
  ctx.fillText('OFFICIAL FULL TIME SCORECARD & GAZETTE', width / 2, 59);

  // ==========================================
  // SCORELINE STRIP (y: 94..190)
  // ==========================================
  const homeTeamClean = cleanCanvasText(data.homeTeam).toUpperCase() || 'HOME';
  const awayTeamClean = cleanCanvasText(data.awayTeam).toUpperCase() || 'AWAY';

  // Home Team Display (Left box: 48..308)
  ctx.textAlign = 'left';
  ctx.font = 'bold 23px "Segoe UI", Arial, sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.fillText(truncateText(ctx, homeTeamClean, 224), 66, 130);

  roundRect(ctx, 66, 148, 56, 20, 4);
  ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
  ctx.fill();
  ctx.strokeStyle = colorHome;
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.textAlign = 'center';
  ctx.font = 'bold 10px "Segoe UI", Arial, sans-serif';
  ctx.fillStyle = colorHome;
  ctx.fillText('HOME', 66 + 28, 158);

  // Center Score Box (318..482)
  ctx.textAlign = 'center';
  ctx.font = 'bold 40px "Segoe UI", Arial, sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.shadowColor = 'rgba(56, 189, 248, 0.45)';
  ctx.shadowBlur = 10;
  ctx.fillText(`${data.homeScore} - ${data.awayScore}`, width / 2, 134);
  ctx.shadowBlur = 0;

  roundRect(ctx, width / 2 - 24, 160, 48, 18, 9);
  ctx.fillStyle = '#10b981';
  ctx.fill();
  ctx.font = 'bold 10px "Segoe UI", Arial, sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.fillText('FT', width / 2, 169);

  // Away Team Display (Right box: 492..752)
  ctx.textAlign = 'right';
  ctx.font = 'bold 23px "Segoe UI", Arial, sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.fillText(truncateText(ctx, awayTeamClean, 224), 734, 130);

  roundRect(ctx, 734 - 56, 148, 56, 20, 4);
  ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
  ctx.fill();
  ctx.strokeStyle = colorAway;
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.textAlign = 'center';
  ctx.font = 'bold 10px "Segoe UI", Arial, sans-serif';
  ctx.fillStyle = colorAway;
  ctx.fillText('AWAY', 734 - 28, 158);

  // ==========================================
  // DUAL POSSESSION TELEMETRY BAR (48, 202, 704x72)
  // ==========================================
  const barW = 660;
  const barH = 14;
  const barX = (width - barW) / 2;
  const barY = 222;

  const homePoss = Math.max(5, Math.min(95, data.homePossession));
  const awayPoss = 100 - homePoss;
  const homeLen = Math.round((homePoss / 100) * barW);
  const awayLen = barW - homeLen;

  roundRect(ctx, barX, barY, barW, barH, 7);
  ctx.fillStyle = '#1e293b';
  ctx.fill();

  ctx.save();
  roundRect(ctx, barX, barY, barW, barH, 7);
  ctx.clip();
  ctx.fillStyle = colorHome;
  ctx.fillRect(barX, barY, homeLen, barH);
  ctx.fillStyle = colorAway;
  ctx.fillRect(barX + homeLen, barY, awayLen, barH);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(barX + homeLen - 1.5, barY, 3, barH);
  ctx.restore();

  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.font = 'bold 13px "Segoe UI", Arial, sans-serif';
  ctx.fillStyle = colorHome;
  ctx.fillText(`${homePoss}% POSSESSION`, barX, barY + 32);

  ctx.textAlign = 'center';
  ctx.font = 'bold 11px "Segoe UI", Arial, sans-serif';
  ctx.fillStyle = '#e2e8f0';
  ctx.fillText('BALL CONTROL', width / 2, barY + 32);

  ctx.textAlign = 'right';
  ctx.font = 'bold 13px "Segoe UI", Arial, sans-serif';
  ctx.fillStyle = colorAway;
  ctx.fillText(`${awayPoss}% POSSESSION`, barX + barW, barY + 32);

  // ==========================================
  // MAN OF THE MATCH SPOTLIGHT (48, 286, 704x78)
  // ==========================================
  ctx.textAlign = 'left';
  ctx.font = 'bold 11px "Segoe UI", Arial, sans-serif';
  ctx.fillStyle = '#facc15';
  ctx.fillText('MAN OF THE MATCH SPOTLIGHT', 70, 310);

  ctx.font = 'bold 21px "Segoe UI", Arial, sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.fillText(truncateText(ctx, cleanCanvasText(data.motmName).toUpperCase() || 'MVP', 490), 70, 338);

  const ratingBadgeW = 112;
  const ratingBadgeH = 36;
  const ratingBadgeX = 734 - ratingBadgeW;
  const ratingBadgeY = 306;

  roundRect(ctx, ratingBadgeX, ratingBadgeY, ratingBadgeW, ratingBadgeH, 18);
  ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
  ctx.fill();
  ctx.strokeStyle = '#facc15';
  ctx.lineWidth = 1.6;
  ctx.stroke();

  ctx.textAlign = 'center';
  ctx.font = 'bold 15px "Segoe UI", Arial, sans-serif';
  ctx.fillStyle = '#facc15';
  ctx.fillText(`OVR ${data.motmRating.toFixed(1)}`, ratingBadgeX + ratingBadgeW / 2, ratingBadgeY + 18);

  // ==========================================
  // FOOTER TAGLINE (40, 380, 720x20)
  // ==========================================
  ctx.textAlign = 'center';
  ctx.font = 'bold 10px "Segoe UI", Arial, sans-serif';
  ctx.fillStyle = '#e2e8f0';
  ctx.fillText('AI SPORTS JOURNALISM ENGINE  •  OFFICIAL LIVE MATCH TELEMETRY', width / 2, 390);

  return canvas.toBuffer('image/png');
}

export interface ProfileCollectableVisual {
  label: string;
  spriteMode: 'full' | 'split' | 'single';
  spriteKey: string;
}

export interface ProfileCardData {
  username: string;
  avatarUrl?: string;
  clubName: string;
  nationName: string;
  ovr: number;
  atk: number;
  mid: number;
  def: number;
  seasonRank: string;
  vipTier: number;
  themeKey?: string | null;
  equippedAvatar?: string | null;
  equippedBanner?: string | null;
  milestones: string[];
  playstyleName?: string;
  position?: string;
  coins?: bigint;
  followers?: bigint;
  trainingPoints?: number;
  matchesPlayed?: number;
  goalsScored?: number;
  assists?: number;
  yellowCards?: number;
  redCards?: number;
  cleanSheets?: number;
  motmCount?: number;
  collectables?: ProfileCollectableVisual[];
}

function drawObsidianPanel(
  ctx: SKRSContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  accentColor: string,
  radius = 14
) {
  ctx.save();
  roundRect(ctx, x, y, w, h, radius);
  ctx.fillStyle = 'rgba(7, 11, 22, 0.78)';
  ctx.fill();

  // Subtle top frosted glass highlight
  const sheen = ctx.createLinearGradient(x, y, x, y + h * 0.42);
  sheen.addColorStop(0, 'rgba(255, 255, 255, 0.065)');
  sheen.addColorStop(1, 'rgba(255, 255, 255, 0.0)');
  ctx.fillStyle = sheen;
  ctx.fill();

  ctx.strokeStyle = 'rgba(148, 163, 184, 0.30)';
  ctx.lineWidth = 1.4;
  ctx.stroke();

  // Thin top accent glow strip
  const accentGrad = ctx.createLinearGradient(x + 16, y, x + w - 16, y);
  accentGrad.addColorStop(0, 'rgba(255,255,255,0)');
  accentGrad.addColorStop(0.5, accentColor);
  accentGrad.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = accentGrad;
  ctx.fillRect(x + 24, y, w - 48, 2);
  ctx.restore();
}

async function drawHiresCollectable(
  ctx: SKRSContext2D,
  item: ProfileCollectableVisual,
  x: number,
  y: number,
  w: number,
  h: number
): Promise<boolean> {
  const hiresDir = path.resolve(process.cwd(), 'assets', 'emojis_hires');
  try {
    if (item.spriteMode === 'full') {
      const p = path.join(hiresDir, `${item.spriteKey}full.png`);
      if (fs.existsSync(p)) {
        const img = await loadLocalImageCached(p);
        ctx.drawImage(img, x, y, w, h);
        return true;
      }
    } else if (item.spriteMode === 'split') {
      const fp = path.join(hiresDir, `${item.spriteKey}front.png`);
      const bp = path.join(hiresDir, `${item.spriteKey}back.png`);
      if (fs.existsSync(fp) && fs.existsSync(bp)) {
        const [fImg, bImg] = await Promise.all([loadLocalImageCached(fp), loadLocalImageCached(bp)]);
        const hw = Math.floor(w / 2);
        ctx.drawImage(fImg, x, y + 2, hw, h - 4);
        ctx.drawImage(bImg, x + hw - 2, y + 2, hw, h - 4);
        return true;
      }
    } else {
      const sp = path.join(hiresDir, `${item.spriteKey}.png`);
      if (fs.existsSync(sp)) {
        const img = await loadLocalImageCached(sp);
        const padX = Math.max(0, Math.round((w - h) / 2));
        ctx.drawImage(img, x + padX, y + 2, h - 4, h - 4);
        return true;
      }
    }
  } catch {
    return false;
  }
  return false;
}

/**
 * Generates the charismatic 980x560 flagship Player Profile Hero Card combining volumetric stadium lighting,
 * Obsidian dark-glass panels, stained-glass ATK/MID/DEF overall cards, Wealth & Team, Career Stats, and Collectables.
 */
export async function generatePlayerProfileCard(data: ProfileCardData): Promise<Buffer> {
  const avatarCosmetic = data.equippedAvatar
    ? COSMETIC_CATALOG.find(c => c.key === data.equippedAvatar)
    : undefined;
  const bannerCosmetic = data.equippedBanner
    ? COSMETIC_CATALOG.find(c => c.key === data.equippedBanner)
    : undefined;

  // When a full Legend Collector Banner artwork file is present for the equipped banner, render it as the main bottom poster
  const customBannerPath = resolveCosmeticAssetPath('BANNER', data.equippedBanner);
  if (customBannerPath && bannerCosmetic) {
    return await renderEquippedBannerPoster({
      bannerPath: customBannerPath,
      username: data.username,
      bannerName: bannerCosmetic.name,
      bannerSubtitle: bannerCosmetic.subtitle,
      ovr: data.ovr,
      seasonRank: data.seasonRank,
      accentHex: bannerCosmetic.accentHex,
      vipTier: data.vipTier,
    });
  }

  const width = 980;
  const height = 560;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  const theme = PROFILE_THEMES.find(t => t.key === data.themeKey) || PROFILE_THEMES[0];
  const primaryAccent = bannerCosmetic?.accentHex || avatarCosmetic?.accentHex || (data.vipTier >= 1 ? '#f59e0b' : theme.accent);

  // 1. Atmospheric Stadium Backdrop + Volumetric Floodlights + Pitch Horizon Glow
  const baseGrad = ctx.createLinearGradient(0, 0, 0, height);
  baseGrad.addColorStop(0, theme.bgStart || '#060a14');
  baseGrad.addColorStop(0.62, theme.bgEnd || '#0b1528');
  baseGrad.addColorStop(1, '#071b16');
  ctx.fillStyle = baseGrad;
  ctx.fillRect(0, 0, width, height);

  // Blend obsidian stadium lights softly in background
  const { filePath: bgPath } = resolveThemeAssetPath('match_scorecard', data.themeKey);
  if (bgPath) {
    try {
      const bgImg = await loadLocalImageCached(bgPath);
      ctx.save();
      ctx.globalAlpha = 0.24;
      ctx.drawImage(bgImg, 0, 0, width, height);
      ctx.restore();
    } catch {}
  }

  // Dual Floodlight Volumetric Beams from upper arena
  ctx.save();
  const leftBeam = ctx.createRadialGradient(220, 40, 10, 220, 180, 380);
  leftBeam.addColorStop(0, 'rgba(56, 189, 248, 0.24)');
  leftBeam.addColorStop(0.55, theme.glow || 'rgba(14, 165, 233, 0.08)');
  leftBeam.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = leftBeam;
  ctx.fillRect(0, 0, width, height);

  const rightBeam = ctx.createRadialGradient(770, 40, 10, 770, 180, 380);
  rightBeam.addColorStop(0, 'rgba(250, 204, 21, 0.16)');
  rightBeam.addColorStop(0.55, 'rgba(16, 185, 129, 0.08)');
  rightBeam.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = rightBeam;
  ctx.fillRect(0, 0, width, height);

  // Turf glow along stadium pitch floor
  const turfGlow = ctx.createLinearGradient(0, 370, 0, height);
  turfGlow.addColorStop(0, 'rgba(16, 185, 129, 0)');
  turfGlow.addColorStop(1, 'rgba(16, 185, 129, 0.16)');
  ctx.fillStyle = turfGlow;
  ctx.fillRect(0, 370, width, height - 370);
  ctx.restore();

  // Outer Metallic Frame
  ctx.save();
  roundRect(ctx, 10, 10, width - 20, height - 20, 16);
  ctx.strokeStyle = data.vipTier >= 1 ? 'rgba(250, 204, 21, 0.45)' : 'rgba(148, 163, 184, 0.35)';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();

  // ==========================================
  // QUADRANT 1: IDENTITY & AVATAR (26, 24, 454x246)
  // ==========================================
  drawObsidianPanel(ctx, 26, 24, 454, 246, primaryAccent, 14);

  if (bannerCosmetic) {
    ctx.save();
    roundRect(ctx, 26, 24, 454, 246, 14);
    ctx.clip();
    ctx.fillStyle = `${bannerCosmetic.accentHex}22`;
    ctx.beginPath();
    ctx.moveTo(320, 24);
    ctx.lineTo(480, 24);
    ctx.lineTo(410, 270);
    ctx.lineTo(250, 270);
    ctx.closePath();
    ctx.fill();

    ctx.font = 'bold 104px "Segoe UI", Arial, sans-serif';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.07)';
    ctx.textAlign = 'right';
    ctx.fillText(`#${bannerCosmetic.jerseyNumber}`, 464, 252);
    ctx.restore();
  }

  const avX = 114;
  const avY = 128;
  const avRadius = 56;
  const avatarImg = await resolveAvatarImage(data.avatarUrl, data.equippedAvatar);
  drawCircularImage(
    ctx,
    avatarImg,
    avX,
    avY,
    avRadius,
    data.username,
    primaryAccent,
    true
  );

  // Outer metallic halo around avatar
  ctx.save();
  ctx.beginPath();
  ctx.arc(avX, avY, avRadius + 6, 0, Math.PI * 2);
  ctx.strokeStyle = avatarCosmetic ? avatarCosmetic.accentHex : 'rgba(148, 163, 184, 0.35)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.restore();

  // Badge tag below avatar
  const avBadgeText = avatarCosmetic
    ? `#${avatarCosmetic.jerseyNumber} ${avatarCosmetic.subtitle.slice(0, 10).toUpperCase()}`
    : data.vipTier >= 1
      ? 'VIP PASS'
      : `${data.seasonRank.toUpperCase()} TIER`;
  ctx.save();
  roundRect(ctx, avX - 54, 200, 108, 22, 11);
  ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
  ctx.fill();
  ctx.strokeStyle = primaryAccent;
  ctx.lineWidth = 1.2;
  ctx.stroke();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = data.vipTier >= 1 ? '#fde047' : '#f8fafc';
  ctx.font = 'bold 10px "Segoe UI", Arial, sans-serif';
  ctx.fillText(cleanCanvasText(avBadgeText), avX, 211);
  ctx.restore();

  // Right Identity Text Block (x: 192..464) + Official BTFW Seal top-right of Identity Panel
  await drawBrandLogoSeal(ctx, 444, 62, 21, primaryAccent);
  const idX = 194;
  ctx.save();
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';

  const roleText = `${cleanCanvasText(data.playstyleName || 'Poacher').toUpperCase()}  •  ${data.position || 'ATT'}`;
  ctx.font = 'bold 11px "Segoe UI", Arial, sans-serif';
  const roleW = Math.min(258, ctx.measureText(roleText).width + 22);
  roundRect(ctx, idX, 54, roleW, 22, 6);
  ctx.fillStyle = 'rgba(6, 182, 212, 0.16)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(34, 211, 238, 0.55)';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.fillStyle = '#67e8f9';
  ctx.fillText(roleText, idX + 11, 69);

  // @Username Hero Display
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 28px "Segoe UI", Arial, sans-serif';
  const cleanName = cleanCanvasText(data.username) || 'Player';
  ctx.fillText(truncateText(ctx, `@${cleanName}`, 268), idX, 118);

  // Club & Nation
  ctx.fillStyle = '#e2e8f0';
  ctx.font = 'bold 13.5px "Segoe UI", Arial, sans-serif';
  ctx.fillText(truncateText(ctx, `${cleanCanvasText(data.nationName)}  •  ${cleanCanvasText(data.clubName)}`, 268), idX, 146);

  // Active Theme / Banner Tag
  ctx.fillStyle = primaryAccent;
  ctx.font = 'bold 11px "Segoe UI", Arial, sans-serif';
  const studioLabel = bannerCosmetic
    ? `BANNER: ${bannerCosmetic.name.toUpperCase()}`
    : `STUDIO: ${theme.name.toUpperCase()}`;
  ctx.fillText(truncateText(ctx, cleanCanvasText(studioLabel), 268), idX, 178);

  ctx.fillStyle = '#cbd5e1';
  ctx.font = 'bold 11px "Segoe UI", Arial, sans-serif';
  ctx.fillText(`RANK: ${cleanCanvasText(data.seasonRank).toUpperCase()}`, idX, 202);
  ctx.restore();

  // ==========================================
  // QUADRANT 2: OVERALL & ATK / MID / DEF CARDS (496, 24, 458x246)
  // ==========================================
  drawObsidianPanel(ctx, 496, 24, 458, 246, '#facc15', 14);

  ctx.save();
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#f8fafc';
  ctx.font = 'bold 15px "Segoe UI", Arial, sans-serif';
  ctx.fillText('OVERALL', 518, 52);

  // Glowing OVR Shield Badge
  roundRect(ctx, 842, 38, 92, 28, 8);
  ctx.fillStyle = 'rgba(250, 204, 21, 0.16)';
  ctx.fill();
  ctx.strokeStyle = '#facc15';
  ctx.lineWidth = 1.4;
  ctx.stroke();
  ctx.textAlign = 'center';
  ctx.fillStyle = '#fde047';
  ctx.font = 'bold 14px "Segoe UI", Arial, sans-serif';
  ctx.fillText(`OVR ${data.ovr}`, 888, 53);
  ctx.restore();

  const triadBoxes = [
    {
      label: 'ATK',
      val: data.atk,
      x: 516,
      topColor: 'rgba(185, 28, 28, 0.56)',
      botColor: 'rgba(69, 10, 10, 0.80)',
      border: 'rgba(248, 113, 113, 0.60)',
      labelColor: '#fecaca',
      barColor: '#ef4444',
    },
    {
      label: 'MID',
      val: data.mid,
      x: 660,
      topColor: 'rgba(29, 78, 216, 0.56)',
      botColor: 'rgba(23, 37, 84, 0.80)',
      border: 'rgba(96, 165, 250, 0.60)',
      labelColor: '#bfdbfe',
      barColor: '#3b82f6',
    },
    {
      label: 'DEF',
      val: data.def,
      x: 804,
      topColor: 'rgba(4, 120, 87, 0.56)',
      botColor: 'rgba(6, 46, 36, 0.80)',
      border: 'rgba(52, 211, 153, 0.60)',
      labelColor: '#a7f3d0',
      barColor: '#10b981',
    },
  ];

  for (const box of triadBoxes) {
    const bw = 130;
    const bh = 166;
    const by = 82;
    ctx.save();
    roundRect(ctx, box.x, by, bw, bh, 12);
    const cg = ctx.createLinearGradient(box.x, by, box.x, by + bh);
    cg.addColorStop(0, box.topColor);
    cg.addColorStop(1, box.botColor);
    ctx.fillStyle = cg;
    ctx.fill();
    ctx.strokeStyle = box.border;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Glossy top diagonal highlight
    ctx.fillStyle = 'rgba(255, 255, 255, 0.07)';
    ctx.beginPath();
    roundRect(ctx, box.x + 2, by + 2, bw - 4, 46, 10);
    ctx.fill();

    // Big Numeric Value
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 54px "Segoe UI", Arial, sans-serif';
    ctx.fillText(String(box.val), box.x + bw / 2, by + 68);

    // Label below number
    ctx.fillStyle = box.labelColor;
    ctx.font = 'bold 14px "Segoe UI", Arial, sans-serif';
    ctx.fillText(box.label, box.x + bw / 2, by + 116);

    // Sleek Progress Fill Bar at Card Bottom
    const trackW = 90;
    const trackX = box.x + (bw - trackW) / 2;
    const trackY = by + 138;
    roundRect(ctx, trackX, trackY, trackW, 6, 3);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.42)';
    ctx.fill();
    const fillW = Math.max(8, Math.round((Math.min(99, Math.max(0, box.val)) / 99) * trackW));
    roundRect(ctx, trackX, trackY, fillW, 6, 3);
    ctx.fillStyle = box.barColor;
    ctx.fill();
    ctx.restore();
  }

  // ==========================================
  // QUADRANT 3: WEALTH & TEAM (26, 286, 454x186)
  // ==========================================
  drawObsidianPanel(ctx, 26, 286, 454, 186, '#10b981', 14);

  ctx.save();
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#fde047';
  ctx.font = 'bold 13px "Segoe UI", Arial, sans-serif';
  ctx.fillText('WEALTH & TEAM', 48, 310);

  // Subtle horizontal separator
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.2)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(48, 326);
  ctx.lineTo(458, 326);
  ctx.stroke();
  ctx.restore();

  const coinImgPath = path.resolve(process.cwd(), 'assets', 'emojis_hires', 'coin.png');
  const follImgPath = path.resolve(process.cwd(), 'assets', 'emojis_hires', 'followers.png');
  const [coinImg, follImg] = await Promise.all([
    fs.existsSync(coinImgPath) ? loadLocalImageCached(coinImgPath).catch(() => null) : null,
    fs.existsSync(follImgPath) ? loadLocalImageCached(follImgPath).catch(() => null) : null,
  ]);

  ctx.save();
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';

  // Coins Cell (x: 48, y: 344)
  if (coinImg) ctx.drawImage(coinImg, 48, 344, 22, 22);
  ctx.fillStyle = '#cbd5e1';
  ctx.font = 'bold 11px "Segoe UI", Arial, sans-serif';
  ctx.fillText('COINS', coinImg ? 76 : 48, 355);
  ctx.fillStyle = '#fde047';
  ctx.font = 'bold 24px "Segoe UI", Arial, sans-serif';
  ctx.fillText(formatK(data.coins ?? 0n), 48, 386);

  // Followers Cell (x: 266, y: 344)
  if (follImg) ctx.drawImage(follImg, 266, 344, 22, 22);
  ctx.fillStyle = '#cbd5e1';
  ctx.font = 'bold 11px "Segoe UI", Arial, sans-serif';
  ctx.fillText('FOLLOWERS', follImg ? 294 : 266, 355);
  ctx.fillStyle = '#38bdf8';
  ctx.font = 'bold 24px "Segoe UI", Arial, sans-serif';
  ctx.fillText(formatK(data.followers ?? 0n), 266, 386);

  // Nation Cell (x: 48, y: 416)
  ctx.fillStyle = '#cbd5e1';
  ctx.font = 'bold 11px "Segoe UI", Arial, sans-serif';
  ctx.fillText('NATIONAL TEAM', 48, 422);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 18px "Segoe UI", Arial, sans-serif';
  ctx.fillText(truncateText(ctx, cleanCanvasText(data.nationName) || 'Free Agent', 195), 48, 448);

  // Club Cell (x: 266, y: 416)
  ctx.fillStyle = '#cbd5e1';
  ctx.font = 'bold 11px "Segoe UI", Arial, sans-serif';
  ctx.fillText('CLUB FRANCHISE', 266, 422);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 18px "Segoe UI", Arial, sans-serif';
  ctx.fillText(truncateText(ctx, cleanCanvasText(data.clubName) || 'Free Agent', 195), 266, 448);
  ctx.restore();

  // ==========================================
  // QUADRANT 4: CAREER STATS (496, 286, 458x186)
  // ==========================================
  drawObsidianPanel(ctx, 496, 286, 458, 186, '#38bdf8', 14);

  ctx.save();
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#38bdf8';
  ctx.font = 'bold 13px "Segoe UI", Arial, sans-serif';
  ctx.fillText('CAREER STATS', 518, 310);

  ctx.strokeStyle = 'rgba(148, 163, 184, 0.2)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(518, 326);
  ctx.lineTo(932, 326);
  ctx.stroke();

  const careerLeft = [
    { label: 'Appearances', val: String(data.matchesPlayed ?? 0), color: '#ffffff' },
    { label: 'Goals', val: String(data.goalsScored ?? 0), color: '#fde047' },
    { label: 'Assists', val: String(data.assists ?? 0), color: '#38bdf8' },
    { label: 'Yellow Cards', val: String(data.yellowCards ?? 0), color: '#facc15' },
  ];
  const careerRight = [
    { label: 'Red Cards', val: String(data.redCards ?? 0), color: '#f87171' },
    { label: 'Clean Sheets', val: String(data.cleanSheets ?? 0), color: '#34d399' },
    { label: 'MOTM Awards', val: String(data.motmCount ?? 0), color: '#fbbf24' },
    { label: 'Training Pts', val: `${data.trainingPoints ?? 0} TP`, color: '#67e8f9' },
  ];

  for (let i = 0; i < 4; i++) {
    const ry = 348 + i * 32;
    // Left Col (518..708)
    ctx.textAlign = 'left';
    ctx.fillStyle = '#cbd5e1';
    ctx.font = 'bold 13px "Segoe UI", Arial, sans-serif';
    ctx.fillText(careerLeft[i].label, 520, ry);
    ctx.textAlign = 'right';
    ctx.fillStyle = careerLeft[i].color;
    ctx.font = 'bold 18px "Segoe UI", Arial, sans-serif';
    ctx.fillText(careerLeft[i].val, 706, ry);

    // Right Col (740..930)
    ctx.textAlign = 'left';
    ctx.fillStyle = '#cbd5e1';
    ctx.font = 'bold 13px "Segoe UI", Arial, sans-serif';
    ctx.fillText(careerRight[i].label, 742, ry);
    ctx.textAlign = 'right';
    ctx.fillStyle = careerRight[i].color;
    ctx.font = 'bold 18px "Segoe UI", Arial, sans-serif';
    ctx.fillText(careerRight[i].val, 928, ry);
  }

  // Subtle vertical divider between Left and Right Career Cols
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.16)';
  ctx.beginPath();
  ctx.moveTo(724, 336);
  ctx.lineTo(724, 458);
  ctx.stroke();
  ctx.restore();

  // ==========================================
  // BOTTOM BAR: COLLECTABLES & MILESTONES SHOWCASE (26, 486, 928x54)
  // ==========================================
  drawObsidianPanel(ctx, 26, 486, 928, 54, '#f59e0b', 10);

  ctx.save();
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#fde047';
  ctx.font = 'bold 11.5px "Segoe UI", Arial, sans-serif';
  ctx.fillText('COLLECTABLES', 44, 513);
  ctx.restore();

  const collectables = data.collectables || [];
  let cursorX = 160;
  if (collectables.length > 0) {
    const shownItems = collectables.slice(0, 8);
    for (const item of shownItems) {
      const slotW = item.spriteMode === 'single' ? 42 : 76;
      const slotH = 38;
      const sy = 494;
      ctx.save();
      roundRect(ctx, cursorX, sy, slotW, slotH, 7);
      ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.28)';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.restore();

      await drawHiresCollectable(ctx, item, cursorX + 4, sy + 2, slotW - 8, slotH - 4);
      cursorX += slotW + 8;
    }
    if (collectables.length > 8) {
      ctx.save();
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#fde047';
      ctx.font = 'bold 12px "Segoe UI", Arial, sans-serif';
      ctx.fillText(`+${collectables.length - 8} more`, cursorX + 4, 513);
      ctx.restore();
    }
  } else if (data.milestones.length > 0) {
    let bx = cursorX;
    for (const m of data.milestones.slice(0, 4)) {
      const cm = cleanCanvasText(m);
      ctx.save();
      ctx.font = 'bold 10.5px "Segoe UI", Arial, sans-serif';
      const mw = ctx.measureText(cm).width + 18;
      roundRect(ctx, bx, 500, mw, 26, 6);
      ctx.fillStyle = 'rgba(250, 204, 21, 0.14)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(250, 204, 21, 0.45)';
      ctx.stroke();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#fde047';
      ctx.fillText(cm, bx + mw / 2, 513);
      ctx.restore();
      bx += mw + 8;
    }
  } else {
    ctx.save();
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#94a3b8';
    ctx.font = 'bold 12px "Segoe UI", Arial, sans-serif';
    ctx.fillText('No rides or relics collected yet  •  Visit -showroom & -ah to build your showcase', cursorX, 513);
    ctx.restore();
  }

  await drawBrandLogoSeal(ctx, 926, 513, 16, '#facc15');
  ctx.save();
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#cbd5e1';
  ctx.font = 'bold 10px "Segoe UI", Arial, sans-serif';
  ctx.fillText('BEYOND THE FINAL WHISTLE', 902, 513);
  ctx.restore();

  return canvas.toBuffer('image/png');
}

/**
 * Backward compatibility stub for drawText
 */
export function drawText() {}
