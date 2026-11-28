const { createCanvas } = require('@napi-rs/canvas');
const fs = require('fs');
const path = require('path');

function drawRoundedRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.arcTo(x + width, y, x + width, y + radius, radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.arcTo(x + width, y + height, x + width - radius, y + height, radius);
  ctx.lineTo(x + radius, y + height);
  ctx.arcTo(x, y + height, x, y + height - radius, radius);
  ctx.lineTo(x, y + radius);
  ctx.arcTo(x, y, x + radius, y, radius);
  ctx.closePath();
}

function drawGlassPanel(ctx, x, y, w, h, radius, borderColor, accentGlow = false) {
  ctx.save();
  drawRoundedRect(ctx, x, y, w, h, radius);
  ctx.fillStyle = 'rgba(10, 16, 30, 0.88)';
  ctx.fill();

  if (accentGlow) {
    ctx.shadowColor = borderColor;
    ctx.shadowBlur = 12;
  }
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = borderColor;
  ctx.stroke();
  ctx.restore();
}

async function generateTacticalMatrixImage() {
  const width = 1280;
  const height = 820;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  // 1. Background Gradient (Deep Carbon & Stadium Cobalt)
  const bgGrad = ctx.createLinearGradient(0, 0, width, height);
  bgGrad.addColorStop(0, '#040711');
  bgGrad.addColorStop(0.5, '#081021');
  bgGrad.addColorStop(1, '#03060d');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, width, height);

  // Pitch Pattern & Subtle Grid
  ctx.save();
  ctx.strokeStyle = 'rgba(30, 58, 138, 0.18)';
  ctx.lineWidth = 1;
  for (let x = 40; x < width; x += 60) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }
  for (let y = 40; y < height; y += 60) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }
  // Center Pitch Circle Accent
  ctx.beginPath();
  ctx.arc(width / 2, height / 2 + 30, 160, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.08)';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();

  // 2. Header Zone
  drawGlassPanel(ctx, 35, 22, width - 70, 95, 12, 'rgba(56, 189, 248, 0.35)', true);

  // Brand Pill
  ctx.save();
  drawRoundedRect(ctx, 55, 34, 260, 24, 6);
  ctx.fillStyle = 'rgba(245, 158, 11, 0.18)';
  ctx.fill();
  ctx.strokeStyle = '#f59e0b';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.font = 'bold 11px sans-serif';
  ctx.fillStyle = '#fbbf24';
  ctx.fillText('⚽ BEYOND THE FINAL WHISTLE • ENGINE', 67, 50);

  // Main Title
  ctx.font = '900 28px sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.fillText('TACTICAL SYNERGY & COUNTER MATRIX', 55, 84);

  // Subtitle
  ctx.font = 'bold 13px sans-serif';
  ctx.fillStyle = '#38bdf8';
  ctx.fillText('⚖️ NO UNBEATABLE META — EVERY PLAYSTYLE & TACTIC HAS A DIRECT PREDATOR & PREY', 55, 104);
  ctx.restore();

  // 3. Three Columns (Strikers vs Defenders, Midfield War, 6 Team Systems)
  const colY = 135;
  const colH = 610;
  const colW = 384;
  const colGap = 24;

  // --- COLUMN 1: STRIKERS VS DEFENDERS ---
  const c1X = 35;
  drawGlassPanel(ctx, c1X, colY, colW, colH, 12, 'rgba(239, 68, 68, 0.35)');

  // Header Col 1
  ctx.save();
  drawRoundedRect(ctx, c1X + 12, colY + 12, colW - 24, 38, 8);
  ctx.fillStyle = 'rgba(239, 68, 68, 0.15)';
  ctx.fill();
  ctx.strokeStyle = '#ef4444';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.font = 'bold 15px sans-serif';
  ctx.fillStyle = '#f87171';
  ctx.fillText('⚔️ STRIKERS VS DEFENDERS', c1X + 24, colY + 36);

  const strikerRows = [
    { code: 'PCH', name: 'Poacher', beats: 'Zonal / Aerial Titans', loses: 'Stopper (STP), Sweeper' },
    { code: 'F9', name: 'False Nine', beats: 'Sweeper, Stopper (drags out)', loses: 'Anchor (ANC), Ball-Playing' },
    { code: 'TGT', name: 'Target Man', beats: 'Covering DC, Wide CB', loses: 'Aerial Titan (AER), Stopper' },
    { code: 'SPD', name: 'Speedster', beats: 'Stopper, Ball-Playing DC', loses: 'Covering DC (COV), Sweeper' },
    { code: 'INF', name: 'Inside Fwd', beats: 'Narrow Central Defense', loses: 'Wide Centre-Back (WCB)' },
    { code: 'PFW', name: 'Pressing Fwd', beats: 'Ball-Playing DC (errors)', loses: 'No-Nonsense (NND longs)' }
  ];

  let rY = colY + 62;
  for (const r of strikerRows) {
    drawRoundedRect(ctx, c1X + 12, rY, colW - 24, 82, 8);
    ctx.fillStyle = 'rgba(15, 23, 42, 0.70)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(239, 68, 68, 0.20)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Code Badge
    drawRoundedRect(ctx, c1X + 20, rY + 10, 46, 22, 5);
    ctx.fillStyle = 'rgba(239, 68, 68, 0.25)';
    ctx.fill();
    ctx.font = '900 12px monospace';
    ctx.fillStyle = '#fca5a5';
    ctx.fillText(r.code, c1X + 28, rY + 25);

    // Name
    ctx.font = 'bold 14px sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(r.name, c1X + 74, rY + 26);

    // Beats
    ctx.font = 'bold 11px sans-serif';
    ctx.fillStyle = '#4ade80';
    ctx.fillText('🟢 BEATS:', c1X + 22, rY + 48);
    ctx.font = '11px sans-serif';
    ctx.fillStyle = '#e2e8f0';
    ctx.fillText(r.beats, c1X + 80, rY + 48);

    // Loses
    ctx.font = 'bold 11px sans-serif';
    ctx.fillStyle = '#f87171';
    ctx.fillText('🔴 WEAK TO:', c1X + 22, rY + 68);
    ctx.font = '11px sans-serif';
    ctx.fillStyle = '#cbd5e1';
    ctx.fillText(r.loses, c1X + 94, rY + 68);

    rY += 89;
  }
  ctx.restore();

  // --- COLUMN 2: MIDFIELD BATTLEGROUND ---
  const c2X = c1X + colW + colGap;
  drawGlassPanel(ctx, c2X, colY, colW, colH, 12, 'rgba(168, 85, 247, 0.35)');

  // Header Col 2
  ctx.save();
  drawRoundedRect(ctx, c2X + 12, colY + 12, colW - 24, 38, 8);
  ctx.fillStyle = 'rgba(168, 85, 247, 0.15)';
  ctx.fill();
  ctx.strokeStyle = '#a855f7';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.font = 'bold 15px sans-serif';
  ctx.fillStyle = '#c084fc';
  ctx.fillText('🎯 MIDFIELD BATTLEGROUND', c2X + 24, colY + 36);

  const midRows = [
    { code: 'PLM', name: 'Playmaker', beats: 'Anchor Man, Low Block', loses: 'Ball Winner (BWM tackles)' },
    { code: 'B2B', name: 'Box-to-Box', beats: 'Regista, Mezzala (stamina)', loses: 'Anchor Man (blocks box)' },
    { code: 'MEZ', name: 'Mezzala', beats: 'Anchor Man, Ball Winner', loses: 'Wide CB (WCB), Box-to-Box' },
    { code: 'REG', name: 'Regista', beats: 'Ball Winner, Deep Blocks', loses: 'Pressing Forward, Box-to-Box' },
    { code: 'BWM', name: 'Ball Winner', beats: 'Playmaker, Mezzala', loses: 'Regista (quick passing)' },
    { code: 'ANC', name: 'Anchor Man', beats: 'Box-to-Box, False Nine', loses: 'Mezzala (drifts wide away)' }
  ];

  rY = colY + 62;
  for (const r of midRows) {
    drawRoundedRect(ctx, c2X + 12, rY, colW - 24, 82, 8);
    ctx.fillStyle = 'rgba(15, 23, 42, 0.70)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(168, 85, 247, 0.20)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Code Badge
    drawRoundedRect(ctx, c2X + 20, rY + 10, 46, 22, 5);
    ctx.fillStyle = 'rgba(168, 85, 247, 0.25)';
    ctx.fill();
    ctx.font = '900 12px monospace';
    ctx.fillStyle = '#e9d5ff';
    ctx.fillText(r.code, c2X + 28, rY + 25);

    // Name
    ctx.font = 'bold 14px sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(r.name, c2X + 74, rY + 26);

    // Beats
    ctx.font = 'bold 11px sans-serif';
    ctx.fillStyle = '#4ade80';
    ctx.fillText('🟢 BEATS:', c2X + 22, rY + 48);
    ctx.font = '11px sans-serif';
    ctx.fillStyle = '#e2e8f0';
    ctx.fillText(r.beats, c2X + 80, rY + 48);

    // Loses
    ctx.font = 'bold 11px sans-serif';
    ctx.fillStyle = '#f87171';
    ctx.fillText('🔴 WEAK TO:', c2X + 22, rY + 68);
    ctx.font = '11px sans-serif';
    ctx.fillStyle = '#cbd5e1';
    ctx.fillText(r.loses, c2X + 94, rY + 68);

    rY += 89;
  }
  ctx.restore();

  // --- COLUMN 3: 6 TEAM TACTICAL SYSTEMS ---
  const c3X = c2X + colW + colGap;
  drawGlassPanel(ctx, c3X, colY, colW, colH, 12, 'rgba(16, 185, 129, 0.35)');

  // Header Col 3
  ctx.save();
  drawRoundedRect(ctx, c3X + 12, colY + 12, colW - 24, 38, 8);
  ctx.fillStyle = 'rgba(16, 185, 129, 0.15)';
  ctx.fill();
  ctx.strokeStyle = '#10b981';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.font = 'bold 15px sans-serif';
  ctx.fillStyle = '#34d399';
  ctx.fillText('🧭 6 TEAM TACTICAL PHILOSOPHIES', c3X + 24, colY + 36);

  const tacticRows = [
    { title: '🪄 Tiki-Taka / Control', syn: 'F9, PLM, BPD, MEZ', prey: 'Low Block / Deep Shell', pred: 'Gegenpress & Counter' },
    { title: '⚡ Gegenpress / High Hunt', syn: 'PFW, BWM, B2B, COV', prey: 'Tiki-Taka / Possession', pred: 'Route One Long Balls' },
    { title: '🏎️ Direct Counter Break', syn: 'SPD, REG, INF, NND', prey: 'Gegenpress & High Line', pred: 'Low Block / Deep Shell' },
    { title: '🦅 Wing Overload / Flank', syn: 'TGT, MEZ, WCB, INF', prey: 'Narrow Central Blocks', pred: 'Aerial Titans & Wide CB' },
    { title: '🎯 Route One (Direct)', syn: 'TGT, PCH, NND, B2B', prey: 'Gegenpress (bypasses)', pred: 'Stoppers & Aerial Titans' },
    { title: '🧱 Low Block (Park Bus)', syn: 'ANC, STP, AER, NND', prey: 'Speedsters & Counters', pred: 'Tiki-Taka & False Nines' }
  ];

  rY = colY + 62;
  for (const t of tacticRows) {
    drawRoundedRect(ctx, c3X + 12, rY, colW - 24, 82, 8);
    ctx.fillStyle = 'rgba(15, 23, 42, 0.70)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(16, 185, 129, 0.20)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Title
    ctx.font = 'bold 13px sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(t.title, c3X + 22, rY + 24);

    // Synergies tag
    ctx.font = 'bold 10px monospace';
    ctx.fillStyle = '#38bdf8';
    ctx.fillText(`★ Key: ${t.syn}`, c3X + 225, rY + 24);

    // Prey
    ctx.font = 'bold 11px sans-serif';
    ctx.fillStyle = '#4ade80';
    ctx.fillText('🟢 COUNTERS:', c3X + 22, rY + 48);
    ctx.font = '11px sans-serif';
    ctx.fillStyle = '#e2e8f0';
    ctx.fillText(t.prey, c3X + 104, rY + 48);

    // Predator
    ctx.font = 'bold 11px sans-serif';
    ctx.fillStyle = '#f87171';
    ctx.fillText('🔴 WEAK TO:', c3X + 22, rY + 68);
    ctx.font = '11px sans-serif';
    ctx.fillStyle = '#cbd5e1';
    ctx.fillText(t.pred, c3X + 96, rY + 68);

    rY += 89;
  }
  ctx.restore();

  // 4. Bottom Footer Note
  ctx.save();
  drawRoundedRect(ctx, 35, 760, width - 70, 42, 8);
  ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(245, 158, 11, 0.3)';
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.font = 'bold 12px sans-serif';
  ctx.fillStyle = '#fbbf24';
  ctx.fillText('💡 TACTICAL TIP:', 50, 786);
  ctx.font = '12px sans-serif';
  ctx.fillStyle = '#94a3b8';
  ctx.fillText('Halftime tactical shifts (3-minute window) allow captains to counter the opponent\'s setup and completely turn match momentum.', 160, 786);
  ctx.restore();

  // Save to assets/tactical_matrix.png
  const outPath = path.resolve(process.cwd(), 'assets/tactical_matrix.png');
  const buffer = canvas.toBuffer('image/png');
  fs.writeFileSync(outPath, buffer);
  console.log(`✅ Tactical Matrix image saved successfully (${buffer.length} bytes) to: ${outPath}`);
}

generateTacticalMatrixImage().catch(err => {
  console.error('Failed to generate tactical matrix image:', err);
  process.exit(1);
});
