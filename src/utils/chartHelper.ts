import zlib from 'zlib';

// Precomputed CRC32 lookup table
const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
  }
  crcTable[n] = c >>> 0;
}

function crc32(buf: Buffer): number {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = crcTable[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function makeChunk(type: string, data: Buffer): Buffer {
  const len = data.length;
  const buf = Buffer.alloc(4 + 4 + len + 4);
  buf.writeUInt32BE(len, 0);
  buf.write(type, 4, 4, 'ascii');
  data.copy(buf, 8);
  const typeAndData = buf.subarray(4, 8 + len);
  buf.writeUInt32BE(crc32(typeAndData), 8 + len);
  return buf;
}

function createPng(width: number, height: number, rgbaBuffer: Buffer): Buffer {
  const header = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR chunk
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8; // 8 bits per channel
  ihdrData[9] = 6; // RGBA
  ihdrData[10] = 0; // compression
  ihdrData[11] = 0; // filter
  ihdrData[12] = 0; // interlace
  const ihdrChunk = makeChunk('IHDR', ihdrData);

  // Scanlines with filter byte 0 (None)
  const scanlines = Buffer.alloc(height * (1 + width * 4));
  for (let y = 0; y < height; y++) {
    const rowOffset = y * (1 + width * 4);
    scanlines[rowOffset] = 0;
    rgbaBuffer.copy(scanlines, rowOffset + 1, y * width * 4, (y + 1) * width * 4);
  }

  const compressed = zlib.deflateSync(scanlines);
  const idatChunk = makeChunk('IDAT', compressed);
  const iendChunk = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([header, ihdrChunk, idatChunk, iendChunk]);
}

// 5x7 Basic Bitmap Font for letters and numbers
const FONT_MAP: Record<string, string[]> = {
  // Digits
  '0': ['111', '101', '101', '101', '111'],
  '1': ['010', '110', '010', '010', '111'],
  '2': ['111', '001', '111', '100', '111'],
  '3': ['111', '001', '111', '001', '111'],
  '4': ['101', '101', '111', '001', '001'],
  '5': ['111', '100', '111', '001', '111'],
  '6': ['111', '100', '111', '101', '111'],
  '7': ['111', '001', '010', '010', '010'],
  '8': ['111', '101', '111', '101', '111'],
  '9': ['111', '101', '111', '001', '111'],
  // Uppercase Letters
  'A': ['111', '101', '111', '101', '101'],
  'B': ['110', '101', '110', '101', '110'],
  'C': ['111', '100', '100', '100', '111'],
  'D': ['110', '101', '101', '101', '110'],
  'E': ['111', '100', '110', '100', '111'],
  'F': ['111', '100', '110', '100', '100'],
  'G': ['111', '100', '101', '101', '111'],
  'H': ['101', '101', '111', '101', '101'],
  'I': ['111', '010', '010', '010', '111'],
  'J': ['001', '001', '001', '101', '111'],
  'K': ['101', '110', '100', '110', '101'],
  'L': ['100', '100', '100', '100', '111'],
  'M': ['101', '111', '101', '101', '101'],
  'N': ['101', '111', '111', '101', '101'],
  'O': ['111', '101', '101', '101', '111'],
  'P': ['111', '101', '111', '100', '100'],
  'Q': ['111', '101', '101', '111', '001'],
  'R': ['111', '101', '110', '101', '101'],
  'S': ['111', '100', '111', '001', '111'],
  'T': ['111', '010', '010', '010', '010'],
  'U': ['101', '101', '101', '101', '111'],
  'V': ['101', '101', '101', '101', '010'],
  'W': ['101', '101', '101', '111', '101'],
  'X': ['101', '101', '010', '101', '101'],
  'Y': ['101', '101', '111', '010', '010'],
  'Z': ['111', '001', '010', '100', '111'],
  // Symbols
  '%': ['101', '001', '010', '100', '101'],
  '-': ['000', '000', '111', '000', '000'],
  ':': ['000', '010', '000', '010', '000'],
  '.': ['000', '000', '000', '000', '010'],
  '•': ['000', '010', '111', '010', '000'],
  ' ': ['000', '000', '000', '000', '000'],
};

/**
 * Draws bitmap text onto RGBA buffer with custom scale and color
 */
export function drawText(
  rgba: Buffer,
  width: number,
  height: number,
  text: string,
  startX: number,
  startY: number,
  scale: number,
  col: [number, number, number, number]
) {
  let curX = startX;
  for (const char of text.toUpperCase()) {
    const glyph = FONT_MAP[char] || FONT_MAP[' '];
    const charW = glyph[0].length;
    const charH = glyph.length;

    for (let r = 0; r < charH; r++) {
      for (let c = 0; c < charW; c++) {
        if (glyph[r][c] === '1') {
          for (let sy = 0; sy < scale; sy++) {
            for (let sx = 0; sx < scale; sx++) {
              const px = curX + c * scale + sx;
              const py = startY + r * scale + sy;
              if (px >= 0 && px < width && py >= 0 && py < height) {
                const idx = (py * width + px) * 4;
                rgba[idx] = col[0];
                rgba[idx + 1] = col[1];
                rgba[idx + 2] = col[2];
                rgba[idx + 3] = col[3];
              }
            }
          }
        }
      }
    }
    curX += (charW + 1) * scale;
  }
}

/**
 * Generates an authentic WITS/Blitz style possession pie chart
 */
export function generatePossessionPieChart(
  teamAName: string,
  teamAPoss: number,
  teamAColor: [number, number, number] = [16, 185, 129], // Emerald
  teamBName: string,
  teamBPoss: number,
  teamBColor: [number, number, number] = [5, 150, 105]   // Forest Green
): Buffer {
  const width = 580;
  const height = 360;
  const rgba = Buffer.alloc(width * height * 4);

  // Background: Deep obsidian/slate (#0f172a / #111827)
  const bgR = 17, bgG = 24, bgB = 39, bgA = 255;
  for (let i = 0; i < width * height; i++) {
    rgba[i * 4] = bgR;
    rgba[i * 4 + 1] = bgG;
    rgba[i * 4 + 2] = bgB;
    rgba[i * 4 + 3] = bgA;
  }

  // Draw rectangle helper
  function drawRect(x0: number, y0: number, w: number, h: number, col: [number, number, number]) {
    for (let y = y0; y < y0 + h; y++) {
      if (y < 0 || y >= height) continue;
      for (let x = x0; x < x0 + w; x++) {
        if (x < 0 || x >= width) continue;
        const idx = (y * width + x) * 4;
        rgba[idx] = col[0];
        rgba[idx + 1] = col[1];
        rgba[idx + 2] = col[2];
        rgba[idx + 3] = 255;
      }
    }
  }

  // Legend swatches at top
  drawRect(140, 24, 32, 10, teamAColor);
  drawRect(340, 24, 32, 10, teamBColor);

  // Draw circle
  const cx = width / 2;
  const cy = 200;
  const radius = 115;
  const total = teamAPoss + teamBPoss || 100;
  const ratioA = teamAPoss / total;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist <= radius) {
        // Clockwise from top (-PI/2)
        const angle = Math.atan2(dy, dx);
        let normAngle = angle - (-Math.PI / 2);
        if (normAngle < 0) normAngle += 2 * Math.PI;

        const isTeamA = normAngle < ratioA * 2 * Math.PI;
        const color = isTeamA ? teamAColor : teamBColor;

        let alpha = 255;
        if (dist > radius - 1) {
          alpha = Math.round(255 * (radius - dist));
        }

        const idx = (y * width + x) * 4;
        rgba[idx] = color[0];
        rgba[idx + 1] = color[1];
        rgba[idx + 2] = color[2];
        rgba[idx + 3] = alpha;
      }
    }
  }

  // Draw percentage numbers inside slices
  const angleA = -Math.PI / 2 + (ratioA * Math.PI);
  const textAx = Math.round(cx + Math.cos(angleA) * (radius * 0.55)) - 18;
  const textAy = Math.round(cy + Math.sin(angleA) * (radius * 0.55)) - 10;
  drawText(rgba, width, height, `${teamAPoss}%`, textAx, textAy, 2, [255, 255, 255, 230]);

  const angleB = -Math.PI / 2 + ratioA * 2 * Math.PI + ((1 - ratioA) * Math.PI);
  const textBx = Math.round(cx + Math.cos(angleB) * (radius * 0.55)) - 18;
  const textBy = Math.round(cy + Math.sin(angleB) * (radius * 0.55)) - 10;
  drawText(rgba, width, height, `${teamBPoss}%`, textBx, textBy, 2, [255, 255, 255, 230]);

  return createPng(width, height, rgba);
}

/**
 * Generates an authentic dynamic matchday scorecard graphic for the Sports Gazette
 */
export function generateMatchScorecardGraphic(data: {
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
  homePossession: number;
  awayPossession: number;
  motmName: string;
  motmRating: number;
}): Buffer {
  const width = 640;
  const height = 320;
  const rgba = Buffer.alloc(width * height * 4);

  // Background: Obsidian Slate (#0b0f19)
  const bgR = 11, bgG = 15, bgB = 25, bgA = 255;
  for (let i = 0; i < width * height; i++) {
    rgba[i * 4] = bgR;
    rgba[i * 4 + 1] = bgG;
    rgba[i * 4 + 2] = bgB;
    rgba[i * 4 + 3] = bgA;
  }

  function drawRect(x0: number, y0: number, w: number, h: number, col: [number, number, number, number]) {
    for (let y = y0; y < y0 + h; y++) {
      if (y < 0 || y >= height) continue;
      for (let x = x0; x < x0 + w; x++) {
        if (x < 0 || x >= width) continue;
        const idx = (y * width + x) * 4;
        rgba[idx] = col[0];
        rgba[idx + 1] = col[1];
        rgba[idx + 2] = col[2];
        rgba[idx + 3] = col[3];
      }
    }
  }

  // Top Accent Bar (Champions Gold)
  drawRect(0, 0, width, 4, [245, 158, 11, 255]);

  // Card Outer Border
  drawRect(20, 20, width - 40, 2, [30, 41, 59, 255]);
  drawRect(20, height - 22, width - 40, 2, [30, 41, 59, 255]);
  drawRect(20, 20, 2, height - 40, [30, 41, 59, 255]);
  drawRect(width - 22, 20, 2, height - 40, [30, 41, 59, 255]);

  // Header Title
  drawText(rgba, width, height, 'BEYOND THE FINAL WHISTLE', 190, 36, 2, [245, 158, 11, 255]);
  drawText(rgba, width, height, 'OFFICIAL MATCHDAY TELEMETRY', 200, 56, 1, [148, 163, 184, 255]);

  // Divider
  drawRect(40, 72, width - 80, 1, [51, 65, 85, 255]);

  // Team Names and Center Score
  const scoreText = `${data.homeScore}  -  ${data.awayScore}`;
  drawText(rgba, width, height, data.homeTeam.slice(0, 10).toUpperCase(), 60, 110, 3, [255, 255, 255, 255]);
  drawText(rgba, width, height, scoreText, 250, 106, 4, [16, 185, 129, 255]);
  drawText(rgba, width, height, data.awayTeam.slice(0, 10).toUpperCase(), 430, 110, 3, [255, 255, 255, 255]);

  // Dual Possession Bar in Center
  const barWidth = 440;
  const barX = 100;
  const barY = 170;
  const homeBarLen = Math.round((data.homePossession / 100) * barWidth);
  const awayBarLen = barWidth - homeBarLen;

  drawRect(barX, barY, homeBarLen, 12, [16, 185, 129, 255]); // Emerald
  drawRect(barX + homeBarLen, barY, awayBarLen, 12, [5, 150, 105, 255]); // Forest green

  // Possession labels
  drawText(rgba, width, height, `${data.homePossession}% POSSESSION`, 100, 190, 1, [16, 185, 129, 255]);
  drawText(rgba, width, height, `${data.awayPossession}% POSSESSION`, 430, 190, 1, [5, 150, 105, 255]);

  // Divider
  drawRect(40, 220, width - 80, 1, [51, 65, 85, 255]);

  // MOTM Banner
  drawText(rgba, width, height, `MOTM: ${data.motmName.toUpperCase()}`, 160, 240, 2, [245, 158, 11, 255]);
  drawText(rgba, width, height, `RATING: ${data.motmRating.toFixed(1)}`, 430, 240, 2, [255, 255, 255, 255]);

  // Footer Tagline
  drawText(rgba, width, height, 'AI SPORTS JOURNALISM ENGINE • LIVE MATCH TELEMETRY', 140, 285, 1, [100, 116, 139, 255]);

  return createPng(width, height, rgba);
}
