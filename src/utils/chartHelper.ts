import { createCanvas, CanvasRenderingContext2D, loadImage } from '@napi-rs/canvas';
import { COSMETIC_CATALOG, PROFILE_THEMES } from '../config/constants.js';

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
  ctx: CanvasRenderingContext2D,
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
 * Generates an authentic dynamic matchday scorecard graphic for the Sports Gazette
 */
export function generateMatchScorecardGraphic(data: ScorecardData): Buffer {
  const width = 800;
  const height = 410;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  // Determine contrasting team colors
  const homeColorRgb: [number, number, number] = data.homeColor || [16, 185, 129];
  const awayColorRgb: [number, number, number] = data.awayColor || [5, 150, 105];

  const colorHome = rgbToHex(homeColorRgb);
  let colorAway = areColorsTooClose(homeColorRgb, awayColorRgb)
    ? '#06b6d4' // Electric Cyan if away color clashes with home color
    : rgbToHex(awayColorRgb);

  // Background: Obsidian Slate Gradient
  const bg = ctx.createLinearGradient(0, 0, 0, height);
  bg.addColorStop(0, '#090d16');
  bg.addColorStop(0.5, '#0d1322');
  bg.addColorStop(1, '#080c14');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, width, height);

  // Subtle Stadium Center Glow
  const radialGlow = ctx.createRadialGradient(width / 2, 130, 20, width / 2, 130, 320);
  radialGlow.addColorStop(0, 'rgba(30, 41, 59, 0.45)');
  radialGlow.addColorStop(1, 'rgba(9, 13, 22, 0)');
  ctx.fillStyle = radialGlow;
  ctx.fillRect(0, 0, width, height);

  // Outer Card Border
  roundRect(ctx, 16, 16, width - 32, height - 32, 18);
  ctx.strokeStyle = '#1e293b';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Top Champions Gold Accent Stripe
  const stripe = ctx.createLinearGradient(16, 0, width - 32, 0);
  stripe.addColorStop(0, colorHome);
  stripe.addColorStop(0.5, '#f59e0b');
  stripe.addColorStop(1, colorAway);
  ctx.fillStyle = stripe;
  ctx.fillRect(16, 16, width - 32, 4);

  // Header
  ctx.textAlign = 'center';
  ctx.font = 'bold 14px "Segoe UI", Arial, sans-serif';
  ctx.fillStyle = '#f59e0b';
  ctx.fillText('BEYOND THE FINAL WHISTLE', width / 2, 44);

  ctx.font = '11px "Segoe UI", Arial, sans-serif';
  ctx.fillStyle = '#94a3b8';
  ctx.fillText('OFFICIAL MATCHDAY TELEMETRY • FULL TIME', width / 2, 60);

  // Divider
  ctx.beginPath();
  ctx.moveTo(40, 74);
  ctx.lineTo(width - 40, 74);
  ctx.strokeStyle = '#1e293b';
  ctx.lineWidth = 1;
  ctx.stroke();

  // ==========================================
  // SCOREBOARD DISPLAY
  // ==========================================

  // Home Team Display (Left)
  ctx.textAlign = 'left';
  ctx.font = 'bold 28px "Segoe UI", Arial, sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.fillText(data.homeTeam.toUpperCase(), 50, 132);

  roundRect(ctx, 50, 144, 56, 20, 4);
  ctx.fillStyle = '#1e293b';
  ctx.fill();
  ctx.textAlign = 'center';
  ctx.font = 'bold 10px "Segoe UI", Arial, sans-serif';
  ctx.fillStyle = colorHome;
  ctx.fillText('HOME', 50 + 28, 158);

  // Center Score Glass Badge
  const scoreBadgeW = 150;
  const scoreBadgeH = 68;
  const scoreBadgeX = width / 2 - scoreBadgeW / 2;
  const scoreBadgeY = 96;

  roundRect(ctx, scoreBadgeX, scoreBadgeY, scoreBadgeW, scoreBadgeH, 12);
  ctx.fillStyle = '#0f172a';
  ctx.fill();
  ctx.strokeStyle = '#334155';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Glowing Score Text
  ctx.textAlign = 'center';
  ctx.font = 'bold 38px "Segoe UI", Arial, sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.shadowColor = 'rgba(255, 255, 255, 0.35)';
  ctx.shadowBlur = 8;
  ctx.fillText(`${data.homeScore} - ${data.awayScore}`, width / 2, scoreBadgeY + 47);
  ctx.shadowBlur = 0;

  // FT Pill below score
  roundRect(ctx, width / 2 - 20, scoreBadgeY + scoreBadgeH - 8, 40, 16, 8);
  ctx.fillStyle = '#10b981';
  ctx.fill();
  ctx.font = 'bold 9px "Segoe UI", Arial, sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.fillText('FT', width / 2, scoreBadgeY + scoreBadgeH + 4);

  // Away Team Display (Right)
  ctx.textAlign = 'right';
  ctx.font = 'bold 28px "Segoe UI", Arial, sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.fillText(data.awayTeam.toUpperCase(), width - 50, 132);

  roundRect(ctx, width - 106, 144, 56, 20, 4);
  ctx.fillStyle = '#1e293b';
  ctx.fill();
  ctx.textAlign = 'center';
  ctx.font = 'bold 10px "Segoe UI", Arial, sans-serif';
  ctx.fillStyle = colorAway;
  ctx.fillText('AWAY', width - 106 + 28, 158);

  // ==========================================
  // POSSESSION TELEMETRY BAR
  // ==========================================
  const barW = 680;
  const barH = 16;
  const barX = (width - barW) / 2;
  const barY = 200;

  const homePoss = Math.max(5, Math.min(95, data.homePossession));
  const awayPoss = 100 - homePoss;
  const homeLen = Math.round((homePoss / 100) * barW);
  const awayLen = barW - homeLen;

  // Background track
  roundRect(ctx, barX, barY, barW, barH, 8);
  ctx.fillStyle = '#1e293b';
  ctx.fill();

  // Home Segment (Left Rounded)
  ctx.save();
  roundRect(ctx, barX, barY, barW, barH, 8);
  ctx.clip();

  ctx.fillStyle = colorHome;
  ctx.fillRect(barX, barY, homeLen, barH);

  // Away Segment
  ctx.fillStyle = colorAway;
  ctx.fillRect(barX + homeLen, barY, awayLen, barH);

  // Divider Notch
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(barX + homeLen - 1.5, barY, 3, barH);
  ctx.restore();

  // Possession Text Indicators
  ctx.textAlign = 'left';
  ctx.font = 'bold 14px "Segoe UI", Arial, sans-serif';
  ctx.fillStyle = colorHome;
  ctx.fillText(`${homePoss}% POSSESSION`, barX, barY + 34);

  ctx.textAlign = 'center';
  ctx.font = 'bold 11px "Segoe UI", Arial, sans-serif';
  ctx.fillStyle = '#64748b';
  ctx.fillText('BALL CONTROL', width / 2, barY + 34);

  ctx.textAlign = 'right';
  ctx.font = 'bold 14px "Segoe UI", Arial, sans-serif';
  ctx.fillStyle = colorAway;
  ctx.fillText(`${awayPoss}% POSSESSION`, barX + barW, barY + 34);

  // ==========================================
  // MAN OF THE MATCH SPOTLIGHT
  // ==========================================
  const motmBoxW = 700;
  const motmBoxH = 68;
  const motmBoxX = (width - motmBoxW) / 2;
  const motmBoxY = 265;

  roundRect(ctx, motmBoxX, motmBoxY, motmBoxW, motmBoxH, 12);
  const motmBg = ctx.createLinearGradient(motmBoxX, 0, motmBoxX + motmBoxW, 0);
  motmBg.addColorStop(0, 'rgba(30, 41, 59, 0.7)');
  motmBg.addColorStop(1, 'rgba(15, 23, 42, 0.7)');
  ctx.fillStyle = motmBg;
  ctx.fill();
  ctx.strokeStyle = '#334155';
  ctx.lineWidth = 1;
  ctx.stroke();

  // MOTM Info (Left inside box)
  ctx.textAlign = 'left';
  ctx.font = 'bold 11px "Segoe UI", Arial, sans-serif';
  ctx.fillStyle = '#f59e0b';
  ctx.fillText('👑  MAN OF THE MATCH', motmBoxX + 24, motmBoxY + 26);

  ctx.font = 'bold 20px "Segoe UI", Arial, sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.fillText(data.motmName.toUpperCase(), motmBoxX + 24, motmBoxY + 52);

  // Rating Badge (Right inside box)
  const ratingBadgeW = 100;
  const ratingBadgeH = 36;
  const ratingBadgeX = motmBoxX + motmBoxW - ratingBadgeW - 20;
  const ratingBadgeY = motmBoxY + (motmBoxH - ratingBadgeH) / 2;

  roundRect(ctx, ratingBadgeX, ratingBadgeY, ratingBadgeW, ratingBadgeH, 18);
  ctx.fillStyle = '#1e293b';
  ctx.fill();
  ctx.strokeStyle = '#f59e0b';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.textAlign = 'center';
  ctx.font = 'bold 16px "Segoe UI", Arial, sans-serif';
  ctx.fillStyle = '#f59e0b';
  ctx.fillText(`⭐ ${data.motmRating.toFixed(1)}`, ratingBadgeX + ratingBadgeW / 2, ratingBadgeY + 24);

  // ==========================================
  // FOOTER TAGLINE
  // ==========================================
  ctx.textAlign = 'center';
  ctx.font = '10px "Segoe UI", Arial, sans-serif';
  ctx.fillStyle = '#475569';
  ctx.fillText('AI SPORTS JOURNALISM ENGINE • OFFICIAL LIVE MATCH TELEMETRY', width / 2, height - 24);

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

  const theme = PROFILE_THEMES.find(t => t.key === data.themeKey) || PROFILE_THEMES[0];
  const avatarCosmetic = data.equippedAvatar
    ? COSMETIC_CATALOG.find(c => c.key === data.equippedAvatar)
    : undefined;
  const bannerCosmetic = data.equippedBanner
    ? COSMETIC_CATALOG.find(c => c.key === data.equippedBanner)
    : undefined;

  const primaryAccent = bannerCosmetic?.accentHex || avatarCosmetic?.accentHex || theme.accent;

  // 1. Studio Gradient Backdrop
  const bgGrad = ctx.createLinearGradient(0, 0, width, height);
  bgGrad.addColorStop(0, theme.bgStart);
  bgGrad.addColorStop(1, bannerCosmetic ? bannerCosmetic.secondaryHex : theme.bgEnd);
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, width, height);

  // 2. Ambient Floodlights & Radial Glows
  const glowLeft = ctx.createRadialGradient(90, 60, 10, 90, 60, 260);
  glowLeft.addColorStop(0, theme.glow);
  glowLeft.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = glowLeft;
  ctx.fillRect(0, 0, width, height);

  const glowRight = ctx.createRadialGradient(width - 90, height - 30, 10, width - 90, height - 30, 280);
  glowRight.addColorStop(0, theme.glow);
  glowRight.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = glowRight;
  ctx.fillRect(0, 0, width, height);

  // 3. Tactical Pitch Arcs & Diagonal Legend Sash (if Banner equipped)
  ctx.save();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.055)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(width * 0.65, height / 2, 135, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(width * 0.65, 0);
  ctx.lineTo(width * 0.65, height);
  ctx.stroke();

  if (bannerCosmetic) {
    ctx.fillStyle = `${bannerCosmetic.accentHex}1F`; // translucent diagonal sash
    ctx.beginPath();
    ctx.moveTo(430, 0);
    ctx.lineTo(640, 0);
    ctx.lineTo(540, height);
    ctx.lineTo(330, height);
    ctx.closePath();
    ctx.fill();

    // Watermark Legend Squad Number
    ctx.font = 'bold 124px "Segoe UI", Arial, sans-serif';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.07)';
    ctx.textAlign = 'right';
    ctx.fillText(`#${bannerCosmetic.jerseyNumber}`, width - 190, height - 32);
  }
  ctx.restore();

  // 4. Outer Card Frame & Top Accent Bar
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.14)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(4, 4, width - 8, height - 8, 16);
  ctx.stroke();

  ctx.fillStyle = primaryAccent;
  ctx.beginPath();
  ctx.roundRect(14, 10, width - 28, 4, 2);
  ctx.fill();

  // 5. Left Circular Avatar + Cosmetic Edition Ring
  const avX = 86;
  const avY = 112;
  const avRadius = 54;

  // Outer VIP / Avatar Ring
  ctx.save();
  ctx.beginPath();
  ctx.arc(avX, avY, avRadius + 6, 0, Math.PI * 2);
  ctx.strokeStyle = data.vipTier >= 1 ? '#f59e0b' : primaryAccent;
  ctx.lineWidth = 4;
  ctx.stroke();

  if (avatarCosmetic) {
    ctx.beginPath();
    ctx.arc(avX, avY, avRadius + 11, 0, Math.PI * 2);
    ctx.strokeStyle = avatarCosmetic.accentHex;
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  // Clipped Avatar Image or Monogram Fallback
  ctx.beginPath();
  ctx.arc(avX, avY, avRadius, 0, Math.PI * 2);
  ctx.clip();

  let renderedImage = false;
  if (data.avatarUrl) {
    try {
      const resp = await fetch(data.avatarUrl, { signal: AbortSignal.timeout(3000) });
      if (resp.ok) {
        const arrBuf = await resp.arrayBuffer();
        const img = await loadImage(Buffer.from(arrBuf));
        ctx.drawImage(img, avX - avRadius, avY - avRadius, avRadius * 2, avRadius * 2);
        renderedImage = true;
      }
    } catch {
      // Non-fatal network/canvas image fallback to monogram
    }
  }

  if (!renderedImage) {
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(avX - avRadius, avY - avRadius, avRadius * 2, avRadius * 2);
    ctx.fillStyle = primaryAccent;
    ctx.font = 'bold 42px "Segoe UI", Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText((data.username[0] || 'P').toUpperCase(), avX, avY + 2);
  }
  ctx.restore();

  if (avatarCosmetic) {
    // Edition Jersey Badge at bottom-right of avatar
    ctx.fillStyle = '#090d16';
    ctx.strokeStyle = avatarCosmetic.accentHex;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(avX - 44, avY + avRadius - 10, 88, 22, 11);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 10px "Segoe UI", Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`#${avatarCosmetic.jerseyNumber} ${avatarCosmetic.subtitle.slice(0, 10)}`, avX, avY + avRadius + 1);
  }

  // 6. Identity & Badges Column
  const textX = 168;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';

  // Top Pill (VIP + Season Rank)
  const rankLabel = data.vipTier >= 1 ? `VIP STAR  •  ${data.seasonRank.toUpperCase()}` : `${data.seasonRank.toUpperCase()} TIER`;
  ctx.font = 'bold 11px "Segoe UI", Arial, sans-serif';
  const pillW = Math.max(130, ctx.measureText(rankLabel).width + 24);
  ctx.fillStyle = 'rgba(15, 23, 42, 0.82)';
  ctx.strokeStyle = data.vipTier >= 1 ? '#f59e0b' : theme.accent;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(textX, 34, pillW, 24, 12);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = data.vipTier >= 1 ? '#fbbf24' : '#e2e8f0';
  ctx.fillText(rankLabel, textX + 12, 50);

  // Player Name
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 30px "Segoe UI", Arial, sans-serif';
  const cleanName = data.username.length > 18 ? `${data.username.slice(0, 17)}…` : data.username;
  ctx.fillText(cleanName, textX, 94);

  // Club & Nation
  ctx.fillStyle = '#cbd5e1';
  ctx.font = '14px "Segoe UI", Arial, sans-serif';
  ctx.fillText(`${data.clubName}  •  ${data.nationName}`, textX, 120);

  // Equipped Banner Plaque (if any)
  if (bannerCosmetic) {
    ctx.fillStyle = 'rgba(15, 23, 42, 0.78)';
    ctx.strokeStyle = bannerCosmetic.accentHex;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(textX, 134, 340, 26, 6);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = bannerCosmetic.accentHex;
    ctx.font = 'bold 11px "Segoe UI", Arial, sans-serif';
    ctx.fillText(`BANNER: ${bannerCosmetic.name.toUpperCase()} (${bannerCosmetic.subtitle})`, textX + 10, 151);
  } else {
    ctx.fillStyle = '#94a3b8';
    ctx.font = '12px "Segoe UI", Arial, sans-serif';
    ctx.fillText(`Theme: ${theme.name}`, textX, 148);
  }

  // Milestones Row (up to 3 pills)
  let badgeX = textX;
  const shownMilestones = data.milestones.slice(0, 3);
  for (const label of shownMilestones) {
    ctx.font = 'bold 10px "Segoe UI", Arial, sans-serif';
    const mw = ctx.measureText(label).width + 18;
    if (badgeX + mw > 565) break;

    ctx.fillStyle = 'rgba(30, 41, 59, 0.9)';
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.16)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(badgeX, 180, mw, 24, 6);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#f1f5f9';
    ctx.fillText(label, badgeX + 9, 196);
    badgeX += mw + 8;
  }

  if (shownMilestones.length === 0) {
    ctx.fillStyle = '#64748b';
    ctx.font = 'italic 11px "Segoe UI", Arial, sans-serif';
    ctx.fillText('Build milestones on the pitch (Goals, Poss Won, MVPs, Caps)...', textX, 196);
  }

  // 7. Right OVR & ATK/MID/DEF Telemetry Panel
  const panelX = 590;
  ctx.fillStyle = 'rgba(9, 13, 22, 0.84)';
  ctx.strokeStyle = primaryAccent;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(panelX, 28, 186, 184, 14);
  ctx.fill();
  ctx.stroke();

  // OVR Value
  ctx.textAlign = 'center';
  ctx.fillStyle = '#94a3b8';
  ctx.font = 'bold 11px "Segoe UI", Arial, sans-serif';
  ctx.fillText('OVERALL RATING', panelX + 93, 52);

  ctx.fillStyle = primaryAccent;
  ctx.font = 'bold 54px "Segoe UI", Arial, sans-serif';
  ctx.fillText(String(data.ovr), panelX + 93, 108);

  // Divider inside OVR card
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.10)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(panelX + 18, 126);
  ctx.lineTo(panelX + 168, 126);
  ctx.stroke();

  // ATK / MID / DEF sub-boxes
  const triad = [
    { label: 'ATK', val: data.atk, x: panelX + 36 },
    { label: 'MID', val: data.mid, x: panelX + 93 },
    { label: 'DEF', val: data.def, x: panelX + 150 }
  ];
  for (const t of triad) {
    ctx.fillStyle = '#94a3b8';
    ctx.font = 'bold 11px "Segoe UI", Arial, sans-serif';
    ctx.fillText(t.label, t.x, 152);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 22px "Segoe UI", Arial, sans-serif';
    ctx.fillText(String(t.val), t.x, 182);
  }

  // Subtle footer watermark
  ctx.textAlign = 'left';
  ctx.fillStyle = '#64748b';
  ctx.font = '10px "Segoe UI", Arial, sans-serif';
  ctx.fillText('BEYOND THE FINAL WHISTLE • PLAYER STUDIO', 18, height - 14);

  return canvas.toBuffer('image/png');
}

/**
 * Backward compatibility stub for drawText
 */
export function drawText() {}
