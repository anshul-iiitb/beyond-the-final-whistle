import { createCanvas, SKRSContext2D } from '@napi-rs/canvas';
import { COSMETIC_CATALOG, PROFILE_THEMES } from '../config/constants.js';
import {
  cleanCanvasText,
  drawCircularImage,
  drawGlassScrim,
  fetchRemoteImage,
  paintThemeBackdrop,
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
}

/**
 * Generates an 800x240 generative Player Career Card PNG combining studio theme backdrop,
 * equipped monthly footballer Avatar/Banner badges, Season Rank, OVR triad, and milestones.
 */
export async function generatePlayerProfileCard(data: ProfileCardData): Promise<Buffer> {
  const width = 800;
  const height = 240;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  const avatarCosmetic = data.equippedAvatar
    ? COSMETIC_CATALOG.find(c => c.key === data.equippedAvatar)
    : undefined;
  const bannerCosmetic = data.equippedBanner
    ? COSMETIC_CATALOG.find(c => c.key === data.equippedBanner)
    : undefined;

  const theme = await paintThemeBackdrop(ctx, width, height, 'profile_banner', data.themeKey);
  const primaryAccent = bannerCosmetic?.accentHex || avatarCosmetic?.accentHex || theme.accent;

  // Dark frosted scrims inside all text zones so bright spotlights never wash out typography
  drawGlassScrim(ctx, 174, 34, 386, 90, 8, 0.74);
  drawGlassScrim(ctx, 174, 138, 386, 68, 8, 0.74);
  drawGlassScrim(ctx, 598, 34, 170, 172, 10, 0.78);
  drawGlassScrim(ctx, 42, 173, 88, 20, 5, 0.82);
  drawGlassScrim(ctx, 20, 217, 540, 18, 4, 0.82);

  // Optional Diagonal Legend Sash & Jersey Watermark when 3M Legend Banner equipped
  if (bannerCosmetic) {
    ctx.save();
    ctx.fillStyle = `${bannerCosmetic.accentHex}24`;
    ctx.beginPath();
    ctx.moveTo(410, 28);
    ctx.lineTo(568, 28);
    ctx.lineTo(500, 212);
    ctx.lineTo(342, 212);
    ctx.closePath();
    ctx.fill();

    ctx.font = 'bold 96px "Segoe UI", Arial, sans-serif';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.textAlign = 'right';
    ctx.fillText(`#${bannerCosmetic.jerseyNumber}`, 558, 196);
    ctx.restore();
  }

  // 1. Left Circular Avatar inside Obsidian Marble Frame (cx: 86, cy: 108, r: 48)
  const avX = 86;
  const avY = 108;
  const avRadius = 48;
  const avatarImg = await fetchRemoteImage(data.avatarUrl, 1200);
  drawCircularImage(
    ctx,
    avatarImg,
    avX,
    avY,
    avRadius,
    data.username,
    data.vipTier >= 1 ? '#f59e0b' : primaryAccent,
    false // metallic marble bezel provided by background plate
  );

  // Cosmetic or VIP Ring highlight + Edition Jersey Tag inside (42, 173, 88, 20)
  if (avatarCosmetic || data.vipTier >= 1) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(avX, avY, avRadius + 3, 0, Math.PI * 2);
    ctx.strokeStyle = avatarCosmetic ? avatarCosmetic.accentHex : '#f59e0b';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
  }

  const jerseyText = avatarCosmetic
    ? `#${avatarCosmetic.jerseyNumber} ${avatarCosmetic.subtitle.slice(0, 9)}`
    : data.vipTier >= 1
      ? 'VIP PASS'
      : 'PRO CARD';
  ctx.save();
  ctx.fillStyle = avatarCosmetic ? avatarCosmetic.accentHex : data.vipTier >= 1 ? '#fbbf24' : '#f1f5f9';
  ctx.font = 'bold 9.5px "Segoe UI", Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(cleanCanvasText(jerseyText), 86, 183);
  ctx.restore();

  // 2. Center Top Identity Glass Box (168, 28, 400x102)
  const textX = 182;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';

  const rankLabel = data.vipTier >= 1 ? `VIP STAR  •  ${data.seasonRank.toUpperCase()}` : `${data.seasonRank.toUpperCase()} TIER`;
  ctx.font = 'bold 10.5px "Segoe UI", Arial, sans-serif';
  const pillW = Math.min(360, Math.max(124, ctx.measureText(rankLabel).width + 20));
  ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
  ctx.strokeStyle = data.vipTier >= 1 ? '#f59e0b' : primaryAccent;
  ctx.lineWidth = 1.3;
  ctx.beginPath();
  ctx.roundRect(textX, 40, pillW, 21, 10.5);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = data.vipTier >= 1 ? '#fbbf24' : '#f8fafc';
  ctx.fillText(cleanCanvasText(rankLabel), textX + 10, 54);

  // Username
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 28px "Segoe UI", Arial, sans-serif';
  const cleanName = cleanCanvasText(data.username) || 'Player';
  ctx.fillText(truncateText(ctx, cleanName, 368), textX, 90);

  // Club & Nation
  ctx.fillStyle = '#e2e8f0';
  ctx.font = '13.5px "Segoe UI", Arial, sans-serif';
  const clubNation = `${cleanCanvasText(data.clubName)}  •  ${cleanCanvasText(data.nationName)}`;
  ctx.fillText(truncateText(ctx, clubNation, 368), textX, 114);

  // 3. Center Bottom Banner & Milestones Glass Box (168, 134, 400x78)
  if (bannerCosmetic) {
    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.strokeStyle = bannerCosmetic.accentHex;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.roundRect(textX, 144, 368, 22, 5);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = bannerCosmetic.accentHex;
    ctx.font = 'bold 10.5px "Segoe UI", Arial, sans-serif';
    ctx.fillText(
      truncateText(ctx, `BANNER: ${bannerCosmetic.name.toUpperCase()} (${bannerCosmetic.subtitle})`, 350),
      textX + 8,
      159
    );
  } else {
    ctx.fillStyle = '#7dd3fc';
    ctx.font = 'bold 11.5px "Segoe UI", Arial, sans-serif';
    ctx.fillText(`THEME: ${theme.name.toUpperCase()}`, textX, 158);
  }

  let badgeX = textX;
  const shownMilestones = data.milestones.slice(0, 3);
  for (const label of shownMilestones) {
    const cleanM = cleanCanvasText(label);
    ctx.font = 'bold 10px "Segoe UI", Arial, sans-serif';
    const mw = ctx.measureText(cleanM).width + 16;
    if (badgeX + mw > 556) break;

    ctx.fillStyle = 'rgba(30, 41, 59, 0.9)';
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.22)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(badgeX, 176, mw, 22, 5);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#f8fafc';
    ctx.fillText(cleanM, badgeX + 8, 191);
    badgeX += mw + 7;
  }

  if (shownMilestones.length === 0) {
    ctx.fillStyle = '#cbd5e1';
    ctx.font = 'italic 11px "Segoe UI", Arial, sans-serif';
    ctx.fillText('Build milestones on the pitch (Goals, Poss Won, MVPs, Caps)...', textX, 191);
  }

  // 4. Right OVR & ATK/MID/DEF Telemetry Panel (590..776, center X=683)
  const panelCenterX = 683;
  ctx.textAlign = 'center';
  ctx.fillStyle = '#e2e8f0';
  ctx.font = 'bold 11px "Segoe UI", Arial, sans-serif';
  ctx.fillText('OVERALL RATING', panelCenterX, 54);

  ctx.fillStyle = primaryAccent;
  ctx.font = 'bold 52px "Segoe UI", Arial, sans-serif';
  ctx.fillText(String(data.ovr), panelCenterX, 108);

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(610, 126);
  ctx.lineTo(756, 126);
  ctx.stroke();

  const triad = [
    { label: 'ATK', val: data.atk, x: 632 },
    { label: 'MID', val: data.mid, x: 683 },
    { label: 'DEF', val: data.def, x: 734 }
  ];
  for (const t of triad) {
    ctx.fillStyle = '#cbd5e1';
    ctx.font = 'bold 11px "Segoe UI", Arial, sans-serif';
    ctx.fillText(t.label, t.x, 152);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 22px "Segoe UI", Arial, sans-serif';
    ctx.fillText(String(t.val), t.x, 182);
  }

  // 5. Bottom Studio Watermark Strip (18, 226)
  ctx.textAlign = 'left';
  ctx.fillStyle = '#cbd5e1';
  ctx.font = 'bold 9.5px "Segoe UI", Arial, sans-serif';
  ctx.fillText('BEYOND THE FINAL WHISTLE  •  PLAYER STUDIO', 26, 226);

  return canvas.toBuffer('image/png');
}

/**
 * Backward compatibility stub for drawText
 */
export function drawText() {}
