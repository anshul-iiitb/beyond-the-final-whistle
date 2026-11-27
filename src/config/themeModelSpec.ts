/**
 * Theme Model & Pixel Grid Blueprint Specification for Beyond The Final Whistle (BTFW)
 *
 * Standardized pixel dimensions, safe margins, containers, columns, rows, and cutout slots
 * across all Discord Canvas graphics (Universal Dual-Box Frame, -profile Studio Card & Dossier,
 * -lb Top-10 Leaderboard, -showroom / -gm Showcase Grid, -ah Auction Vault, and Match/Standings Cards).
 *
 * Matching template PNG images live under assets/themes/templates/*.png so themes generated in
 * Gemini align 1:1 with runtime @napi-rs/canvas rendering coordinates.
 */

export interface BoundingBox {
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
  accent?: 'gold' | 'cyan' | 'emerald' | 'purple' | 'rose';
}

export interface CircleSlot {
  cx: number;
  cy: number;
  r: number;
  label: string;
  accent?: 'gold' | 'cyan' | 'emerald' | 'purple';
}

export interface GridModelSpec {
  id: string;
  name: string;
  templateFile: string;
  canvasWidth: number;
  canvasHeight: number;
  safeMargin: number;
  headerZone: BoundingBox;
  containerZone: BoundingBox;
  footerZone?: BoundingBox;
  columns?: BoundingBox[];
  rows?: {
    yCenter: number;
    height: number;
    rowIndex: number;
  }[];
  slots?: BoundingBox[];
  circles?: CircleSlot[];
}

/**
 * 1. UNIVERSAL DUAL-BOX THEME FRAME (Master 1024x764 Template)
 * Single background artwork skins -lb, -showroom, -gm, -ah, -intstats, -clubstats, -roster, -match & -help
 * across any of the 20 PROFILE_THEMES.
 */
export const DUAL_BOX_UNIVERSAL_SPEC: GridModelSpec = {
  id: 'dual_box_universal',
  name: 'Universal Dual-Box Frame (20 Themes Master Skin)',
  templateFile: 'dual_box_universal_grid_template.png',
  canvasWidth: 1024,
  canvasHeight: 764,
  safeMargin: 36,
  headerZone: {
    x: 102,
    y: 112,
    w: 820,
    h: 90,
    label: 'TOP HEADER GLASS BAR (Screen Title + Subtitle + Status Pill)',
    accent: 'gold',
  },
  containerZone: {
    x: 102,
    y: 238,
    w: 820,
    h: 428,
    label: 'MAIN GLASS CONTENT ARENA (Lists, Cards, Telemetry, Lots & Tables)',
    accent: 'cyan',
  },
  slots: [
    { x: 102, y: 112, w: 108, h: 90, label: 'CREST', accent: 'purple' },
    { x: 782, y: 141, w: 120, h: 32, label: 'MODE PILL', accent: 'gold' },
    { x: 120, y: 254, w: 784, h: 396, label: 'INNER SAFE CONTENT PADDING (MARGIN 18px)', accent: 'emerald' },
  ],
  circles: [
    { cx: 156, cy: 157, r: 32, label: 'LOGO', accent: 'gold' },
    { cx: 512, cy: 84, r: 22, label: 'CROWN CREST', accent: 'gold' },
  ],
  footerZone: {
    x: 102,
    y: 682,
    w: 820,
    h: 42,
    label: 'FOOTER HINT & THEME WATERMARK BAR',
    accent: 'purple',
  },
};

/**
 * 2. PROFILE STUDIO BANNER SPEC (-profile Tab 1 Header Card)
 * Matches live generatePlayerProfileCard() coordinates in src/utils/chartHelper.ts.
 */
export const PROFILE_BANNER_GRID_SPEC: GridModelSpec = {
  id: 'profile_banner',
  name: 'Player Profile Studio Banner (-profile Overview Card)',
  templateFile: 'profile_banner_grid_template.png',
  canvasWidth: 800,
  canvasHeight: 240,
  safeMargin: 12,
  headerZone: {
    x: 168,
    y: 28,
    w: 400,
    h: 102,
    label: 'PLAYER IDENTITY (Rank + Username + Club)',
    accent: 'gold',
  },
  containerZone: {
    x: 168,
    y: 134,
    w: 400,
    h: 78,
    label: 'BANNER PLAQUE & MILESTONE BADGES ROW',
    accent: 'emerald',
  },
  slots: [
    { x: 16, y: 28, w: 140, h: 184, label: 'AVATAR FRAME', accent: 'purple' },
    { x: 590, y: 28, w: 186, h: 184, label: 'OVR SHIELD & TRIAD', accent: 'cyan' },
    { x: 42, y: 170, w: 88, h: 22, label: 'JERSEY', accent: 'gold' },
  ],
  circles: [
    { cx: 86, cy: 112, r: 54, label: 'AVATAR', accent: 'gold' },
  ],
  footerZone: {
    x: 18,
    y: 214,
    w: 550,
    h: 18,
    label: 'STUDIO WATERMARK STRIP',
    accent: 'purple',
  },
};

/**
 * 3. FULL PLAYER CAREER DOSSIER & TELEMETRY SPEC (-profile Full Stat Card)
 * High-res standalone card matching League Master player_stat_card_grid_template (1000x550).
 */
export const PLAYER_STAT_CARD_SPEC: GridModelSpec = {
  id: 'player_stat_card',
  name: 'Player Career & Telemetry Card (-profile Full / -intstats / -clubstats)',
  templateFile: 'player_stat_card_grid_template.png',
  canvasWidth: 1000,
  canvasHeight: 550,
  safeMargin: 30,
  headerZone: {
    x: 45,
    y: 45,
    w: 560,
    h: 110,
    label: 'PLAYER HEADER (Username + Flag + Club + VIP Badge + Season Rank)',
    accent: 'gold',
  },
  containerZone: {
    x: 45,
    y: 170,
    w: 560,
    h: 320,
    label: '12-STAT PERFORMANCE GRID (W-D-L, Goals, Assists, Poss, Fouls, Saves, Pens)',
    accent: 'cyan',
  },
  slots: [
    { x: 625, y: 45, w: 330, h: 445, label: 'AVATAR + RADAR HEX + OVR', accent: 'purple' },
    { x: 650, y: 255, w: 280, h: 165, label: '15-ATTR RADAR / TRIAD', accent: 'emerald' },
    { x: 650, y: 430, w: 280, h: 46, label: 'RECENT FORM & MILESTONE STRIP', accent: 'gold' },
  ],
  circles: [
    { cx: 790, cy: 145, r: 70, label: 'AVATAR', accent: 'gold' },
  ],
  footerZone: {
    x: 45,
    y: 500,
    w: 910,
    h: 28,
    label: 'BOOT BOOST • TACTICAL INTEL • VEHICLE STATUS BAR',
    accent: 'emerald',
  },
};

/**
 * 4. LEADERBOARD SPECIFICATION (-lb ovr / goals / wealth / followers)
 * Standard 10-row broadcast leaderboard with podium highlights + caller rank bar (1000x1100).
 */
export const LEADERBOARD_GRID_SPEC: GridModelSpec = {
  id: 'leaderboard',
  name: 'Global Leaderboard (-lb OVR, Goals, Wealth, Followers)',
  templateFile: 'leaderboard_grid_template.png',
  canvasWidth: 1000,
  canvasHeight: 1100,
  safeMargin: 40,
  headerZone: {
    x: 70,
    y: 50,
    w: 860,
    h: 110,
    label: 'CATEGORY BANNER & TROPHY HEADER ZONE (OVR / GOALS / WEALTH / FANS)',
    accent: 'gold',
  },
  containerZone: {
    x: 60,
    y: 176,
    w: 880,
    h: 836,
    label: '10-ROW LEADERBOARD ARENA',
    accent: 'cyan',
  },
  columns: [
    { x: 60, y: 176, w: 120, h: 44, label: 'RANK', accent: 'gold' },
    { x: 180, y: 176, w: 580, h: 44, label: 'PLAYER (Avatar + Flag + Name + Club)', accent: 'cyan' },
    { x: 760, y: 176, w: 180, h: 44, label: 'METRIC VALUE', accent: 'gold' },
  ],
  rows: [
    { rowIndex: 1, yCenter: 266, height: 75 },
    { rowIndex: 2, yCenter: 341, height: 75 },
    { rowIndex: 3, yCenter: 416, height: 75 },
    { rowIndex: 4, yCenter: 491, height: 75 },
    { rowIndex: 5, yCenter: 566, height: 75 },
    { rowIndex: 6, yCenter: 641, height: 75 },
    { rowIndex: 7, yCenter: 716, height: 75 },
    { rowIndex: 8, yCenter: 791, height: 75 },
    { rowIndex: 9, yCenter: 866, height: 75 },
    { rowIndex: 10, yCenter: 941, height: 75 },
  ],
  circles: Array.from({ length: 10 }, (_, i) => ({
    cx: 215,
    cy: 266 + i * 75,
    r: 25,
    label: `P${i + 1}`,
    accent: i < 3 ? 'gold' : 'cyan',
  })),
  footerZone: {
    x: 60,
    y: 1028,
    w: 880,
    h: 46,
    label: 'CALLER RANK HIGHLIGHT BAR & CATEGORY TABS FOOTER',
    accent: 'purple',
  },
};

/**
 * 5. SHOWROOM & MARKET GRID SPEC (-showroom 16 Cars / -gm / -avatar Boutique)
 * 6-Card Showroom / Shop / Boutique Tier Page inside Dual-Box Bounds (1024x764).
 */
export const SHOWROOM_MARKET_GRID_SPEC: GridModelSpec = {
  id: 'showroom_market',
  name: 'Showroom, Global Market & Avatar Boutique Grid (-showroom, -gm, -avatar)',
  templateFile: 'showroom_grid_template.png',
  canvasWidth: 1024,
  canvasHeight: 764,
  safeMargin: 36,
  headerZone: {
    x: 102,
    y: 112,
    w: 820,
    h: 90,
    label: 'DEALERSHIP / MARKET HEADER (Tier Name + Wallet Coins + Active Cooldown)',
    accent: 'rose',
  },
  containerZone: {
    x: 102,
    y: 238,
    w: 820,
    h: 428,
    label: '6-CARD SHOWROOM & CATALOG ARENA (2 Columns x 3 Rows per Page)',
    accent: 'cyan',
  },
  slots: [
    { x: 122, y: 254, w: 382, h: 120, label: 'CARD 1: SPRITE (L) + NAME / COOLDOWN / PRICE (R)', accent: 'gold' },
    { x: 520, y: 254, w: 382, h: 120, label: 'CARD 2: SPRITE (L) + NAME / COOLDOWN / PRICE (R)', accent: 'gold' },
    { x: 122, y: 392, w: 382, h: 120, label: 'CARD 3: SPRITE (L) + NAME / COOLDOWN / PRICE (R)', accent: 'cyan' },
    { x: 520, y: 392, w: 382, h: 120, label: 'CARD 4: SPRITE (L) + NAME / COOLDOWN / PRICE (R)', accent: 'cyan' },
    { x: 122, y: 530, w: 382, h: 120, label: 'CARD 5: SPRITE (L) + NAME / COOLDOWN / PRICE (R)', accent: 'emerald' },
    { x: 520, y: 530, w: 382, h: 120, label: 'CARD 6: SPRITE (L) + NAME / COOLDOWN / PRICE (R)', accent: 'emerald' },
  ],
  footerZone: {
    x: 102,
    y: 682,
    w: 820,
    h: 42,
    label: 'CURRENT RIDE / PAGE INDICATOR / QUICK-BUY HINT',
    accent: 'purple',
  },
};

/**
 * 6. AUCTION HOUSE VAULT SPEC (-ah Automated Daily Collectible Vault)
 * 2-Lot Hero Showcase inside Dual-Box Bounds (1024x764).
 */
export const AUCTION_HOUSE_GRID_SPEC: GridModelSpec = {
  id: 'auction_house',
  name: 'Automated Collector Auction House (-ah)',
  templateFile: 'auction_house_grid_template.png',
  canvasWidth: 1024,
  canvasHeight: 764,
  safeMargin: 36,
  headerZone: {
    x: 102,
    y: 112,
    w: 820,
    h: 90,
    label: 'AUCTION HALL HEADER (Vault Title + Anti-Snipe +2m Badge)',
    accent: 'gold',
  },
  containerZone: {
    x: 102,
    y: 238,
    w: 820,
    h: 428,
    label: 'DUAL COLLECTOR LOT SHOWCASE ARENA (Lot #1 & Lot #2 Side-by-Side)',
    accent: 'gold',
  },
  slots: [
    { x: 122, y: 256, w: 380, h: 392, label: 'LOT #1 RELIC CARD', accent: 'gold' },
    { x: 522, y: 256, w: 380, h: 392, label: 'LOT #2 RELIC CARD', accent: 'cyan' },
  ],
  circles: [
    { cx: 312, cy: 350, r: 58, label: 'RELIC 1', accent: 'gold' },
    { cx: 712, cy: 350, r: 58, label: 'RELIC 2', accent: 'cyan' },
  ],
  footerZone: {
    x: 102,
    y: 682,
    w: 820,
    h: 42,
    label: 'ESCROW STATUS & -bid <amount> [lot#] COMMAND BAR',
    accent: 'purple',
  },
};

/**
 * 7. MATCH SCORECARD & STANDINGS SPEC (-match / -livematch / Standings Tables)
 */
export const STANDINGS_TABLE_GRID_SPEC: GridModelSpec = {
  id: 'points_table',
  name: 'League & International Standings Table (1200x900)',
  templateFile: 'points_table_grid_template.png',
  canvasWidth: 1200,
  canvasHeight: 900,
  safeMargin: 40,
  headerZone: {
    x: 60,
    y: 44,
    w: 1080,
    h: 96,
    label: 'COMPETITION BRANDING HEADER (Logo + League/Tournament + Matchday)',
    accent: 'gold',
  },
  containerZone: {
    x: 60,
    y: 160,
    w: 1080,
    h: 640,
    label: '8-TEAM STANDINGS TABLE ARENA',
    accent: 'cyan',
  },
  columns: [
    { x: 60, y: 160, w: 75, h: 48, label: 'POS', accent: 'gold' },
    { x: 135, y: 160, w: 385, h: 48, label: 'TEAM / NATION', accent: 'gold' },
    { x: 520, y: 160, w: 70, h: 48, label: 'P', accent: 'cyan' },
    { x: 590, y: 160, w: 70, h: 48, label: 'W', accent: 'cyan' },
    { x: 660, y: 160, w: 70, h: 48, label: 'D', accent: 'cyan' },
    { x: 730, y: 160, w: 70, h: 48, label: 'L', accent: 'cyan' },
    { x: 800, y: 160, w: 70, h: 48, label: 'GF', accent: 'cyan' },
    { x: 870, y: 160, w: 70, h: 48, label: 'GA', accent: 'cyan' },
    { x: 940, y: 160, w: 70, h: 48, label: 'GD', accent: 'cyan' },
    { x: 1010, y: 160, w: 130, h: 48, label: 'PTS', accent: 'gold' },
  ],
  rows: Array.from({ length: 8 }, (_, idx) => ({
    rowIndex: idx + 1,
    yCenter: 243 + idx * 65,
    height: 65,
  })),
  footerZone: {
    x: 60,
    y: 824,
    w: 1080,
    h: 46,
    label: 'QUALIFICATION ZONE KEY & PAGINATION BAR',
    accent: 'purple',
  },
};

/**
 * 8. MATCHDAY SCORECARD & GAZETTE SPEC (-match / -livematch 800x410 Card)
 * Matches live generateMatchScorecardGraphic() dimensions in src/utils/chartHelper.ts.
 */
export const MATCH_SCORECARD_GRID_SPEC: GridModelSpec = {
  id: 'match_scorecard',
  name: 'Matchday Gazette Scorecard (-match / -friendly / -livematch)',
  templateFile: 'match_scorecard_grid_template.png',
  canvasWidth: 800,
  canvasHeight: 410,
  safeMargin: 16,
  headerZone: {
    x: 40,
    y: 24,
    w: 720,
    h: 50,
    label: 'COMPETITION & TELEMETRY HEADER BAR',
    accent: 'gold',
  },
  containerZone: {
    x: 40,
    y: 84,
    w: 720,
    h: 290,
    label: 'SCORELINE + POSSESSION + MOTM CARD ARENA',
    accent: 'cyan',
  },
  slots: [
    { x: 48, y: 94, w: 260, h: 96, label: 'HOME TEAM + CREST/FLAG', accent: 'emerald' },
    { x: 318, y: 94, w: 164, h: 96, label: 'FULL TIME SCORE BOX', accent: 'gold' },
    { x: 492, y: 94, w: 260, h: 96, label: 'AWAY TEAM + CREST/FLAG', accent: 'cyan' },
    { x: 48, y: 202, w: 704, h: 72, label: 'DUAL POSSESSION TELEMETRY BAR', accent: 'purple' },
    { x: 48, y: 286, w: 704, h: 78, label: 'MAN OF THE MATCH SPOTLIGHT + RATING', accent: 'gold' },
  ],
  footerZone: {
    x: 40,
    y: 380,
    w: 720,
    h: 20,
    label: 'SPORTS JOURNALISM ENGINE FOOTER',
    accent: 'purple',
  },
};

export const BANNER_POSTER_SPEC: GridModelSpec = {
  id: 'cosmetic_banner_poster',
  name: 'Legend Profile Banner Poster (-equip <banner> on -profile)',
  templateFile: 'banner_blueprint_template.png',
  canvasWidth: 1000,
  canvasHeight: 562,
  safeMargin: 24,
  headerZone: {
    x: 24,
    y: 18,
    w: 952,
    h: 56,
    label: 'TOP SAFE ZONE (Small corner badge margin; keep legend heads clear above y:40)',
    accent: 'gold',
  },
  containerZone: {
    x: 24,
    y: 40,
    w: 952,
    h: 454,
    label: 'MAIN FULL-ART LEGEND POSTER ARENA (16:9 Action Composition / Signature)',
    accent: 'cyan',
  },
  footerZone: {
    x: 20,
    y: 500,
    w: 960,
    h: 46,
    label: 'BOTTOM CORNER OVERLAY RESERVE (Player Pill Left + BTFW Crest Right)',
    accent: 'purple',
  },
};

export const AVATAR_COSMETIC_SPEC: GridModelSpec = {
  id: 'cosmetic_avatar',
  name: 'Player Profile Avatar Portrait (-equip <avatar> Top-Right Corner)',
  templateFile: 'avatar_blueprint_template.png',
  canvasWidth: 512,
  canvasHeight: 512,
  safeMargin: 46,
  headerZone: {
    x: 46,
    y: 46,
    w: 420,
    h: 420,
    label: 'CIRCULAR SAFE PORTRAIT FRAME (centered 256,256 r=210 for Hero/Stats + 1:1 embed thumb)',
    accent: 'gold',
  },
  containerZone: {
    x: 64,
    y: 64,
    w: 384,
    h: 384,
    label: 'HEAD, FACE & TROPHY BUST SAFE AREA',
    accent: 'cyan',
  },
  circles: [
    { cx: 256, cy: 256, r: 210, label: 'CIRCULAR CROP SAFE RING', accent: 'gold' },
  ],
};

export const ALL_BTFW_THEME_GRID_SPECS: Record<string, GridModelSpec> = {
  dual_box_universal: DUAL_BOX_UNIVERSAL_SPEC,
  profile_banner: PROFILE_BANNER_GRID_SPEC,
  player_stat_card: PLAYER_STAT_CARD_SPEC,
  leaderboard: LEADERBOARD_GRID_SPEC,
  showroom_market: SHOWROOM_MARKET_GRID_SPEC,
  auction_house: AUCTION_HOUSE_GRID_SPEC,
  points_table: STANDINGS_TABLE_GRID_SPEC,
  match_scorecard: MATCH_SCORECARD_GRID_SPEC,
  cosmetic_avatar: AVATAR_COSMETIC_SPEC,
  cosmetic_banner_poster: BANNER_POSTER_SPEC,
};
