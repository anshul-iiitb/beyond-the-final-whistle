export interface LocationDef {
  id: string;
  name: string;
  alias: string;
  channelName: string;
  emoji: string;
  description: string;
  activities: string[];
}

export const CAMPUS_LOCATIONS: Record<string, LocationDef> = {
  tc: {
    id: 'tc',
    name: 'Training Center',
    alias: 'tc',
    channelName: 'training-center',
    emoji: '🏋️',
    description: 'Premier football training ground with state-of-the-art pitch and VIP drills.',
    activities: [
      '-train (Normal: 30m | VIP: 6h +6 TP | No Effort VIP: 20h +20 TP)'
    ]
  },
  rf: {
    id: 'rf',
    name: 'Research Facility',
    alias: 'rf',
    channelName: 'research-facility',
    emoji: '🔬',
    description: 'Biomechanics lab to permanently boost attributes using TP and change playstyles.',
    activities: [
      '-sptrain <attr> (Upgrade attribute with TP, costs 50 stamina & 3-15 dynamic TP)',
      '-convert <playstyle> (Change playstyle role, 7-day cooldown)'
    ]
  },
  ch: {
    id: 'ch',
    name: 'Player Clubhouse',
    alias: 'ch',
    channelName: 'player-clubhouse',
    emoji: '🏡',
    description: 'Unified squad lounge combining cryotherapy sauna recovery, academy coaching, and fan meet & greets.',
    activities: [
      '-recovery (Sauna recovery: +30 Regular, +100 VIP stamina, 12h cooldown)',
      '-coaching (Youth academy coaching: +50k coins, 10 stamina, 2h cooldown)',
      '-meetgreet (Fan autographs: +50k followers, 10 stamina, 2h cooldown)'
    ]
  },
  gm: {
    id: 'gm',
    name: 'Global Market',
    alias: 'gm',
    channelName: 'global-market',
    emoji: '🛍️',
    description: 'One-stop marketplace combining matchday gear, the 16-car showroom, and monthly avatar boutique.',
    activities: [
      '-buy <sd|strika|passa|bully> (Drinks & +10 Matchday Boots)',
      '-showroom / -vehiclebuy <alias> (16-Car Dealership slashing travel cooldowns)',
      '-avatar / -avatarbuy <alias> (Monthly rotating Avatar & Banner Boutique)'
    ]
  },
  ph: {
    id: 'ph',
    name: 'Photoshooting Hall',
    alias: 'ph',
    channelName: 'photoshoot-hall',
    emoji: '📸',
    description: 'Commercial studio to sign lucrative brand sponsorship contracts (including VIP 300k deals).',
    activities: [
      '-advert (Heineken, Adidas, Coca-Cola, Netflix, Nike, and VIP 300k Signature, 2h cooldown)'
    ]
  },
  ih: {
    id: 'ih',
    name: 'Intel Hub',
    alias: 'ih',
    channelName: 'intel-hub',
    emoji: '🛰️',
    description: 'Opposition tactical scouting center providing pre-match stat intelligence.',
    activities: [
      '-intel (Free pre-match tactical scouting report, +1 to +6 random attribute boost)'
    ]
  },
  ah: {
    id: 'ah',
    name: 'Auction House',
    alias: 'ah',
    channelName: 'auction-house',
    emoji: '🏛️',
    description: 'Automated daily auction hall for bidding on rare collectibles, trophies, and prestige badges.',
    activities: [
      '-ah (Inspect active daily bot auctions)',
      '-bid <amount> [lot#] (Place escrowed bid; +2m anti-snipe timer under 60s)'
    ]
  }
};

export const LOCATION_ALIASES: Record<string, string> = {
  tc: 'tc',
  training: 'tc',
  rf: 'rf',
  research: 'rf',
  lab: 'rf',
  ch: 'ch',
  clubhouse: 'ch',
  ps: 'ch',
  sauna: 'ch',
  lc: 'ch',
  club: 'ch',
  gm: 'gm',
  shop: 'gm',
  market: 'gm',
  vs: 'gm',
  showroom: 'gm',
  dealership: 'gm',
  avatar: 'gm',
  boutique: 'gm',
  ph: 'ph',
  photoshoot: 'ph',
  ih: 'ih',
  intel: 'ih',
  ah: 'ah',
  auction: 'ah',
  auctions: 'ah'
};

export function resolveLocationAlias(raw: string): { target?: LocationDef; redirectedFrom?: string } {
  const clean = raw.toLowerCase().trim();
  const canonical = LOCATION_ALIASES[clean];
  if (!canonical) return {};
  const target = CAMPUS_LOCATIONS[canonical];
  const redirectedFrom = clean !== canonical && ['ps', 'lc', 'vs'].includes(clean) ? clean : undefined;
  return { target, redirectedFrom };
}

export const BASE_TRAVEL_COOLDOWN_MINUTES = 20;

export interface VehicleDef {
  key: string;
  name: string;
  cost: bigint;
  cooldownMinutes: number;
  emoji: string;
}

export const VEHICLE_CATALOG: VehicleDef[] = [
  // Page 1 — Tier 1: Entry Roadsters & Sports Coupes (16m - 7m) [5 Cars]
  { key: 'mini', name: 'Mini Cooper', cost: 850000n, cooldownMinutes: 16, emoji: '<:minifront:1575602186698760290><:miniback:1575602191182340226>' },
  { key: 'honda', name: 'Honda Civic', cost: 1000000n, cooldownMinutes: 14, emoji: '<:hcfront:1574441090503938158><:hcback:1574441085294616640>' },
  { key: 'toyota', name: 'Toyota Supra', cost: 3000000n, cooldownMinutes: 10, emoji: '<:tsfront:1574441146850082917><:tsback:1574441142022570014>' },
  { key: 'bmwm3', name: 'BMW M3', cost: 3800000n, cooldownMinutes: 9, emoji: '<:bmwm3front:1575602195741675681><:bmwm3back:1575602200074522635>' },
  { key: 'porsche', name: 'Porsche 911', cost: 5350000n, cooldownMinutes: 7, emoji: '<:p911front:1574441127464014015><:p911back:1574441122716065923>' },

  // Page 2 — Tier 2: Track Weapons & American Muscle (6m - 3m) [6 Cars]
  { key: 'corvettec8', name: 'Corvette C8', cost: 6500000n, cooldownMinutes: 6, emoji: '<:corvettec8front:1575602205040443592><:corvettec8back:1575602209717092382>' },
  { key: 'nissan', name: 'Nissan GTR', cost: 6750000n, cooldownMinutes: 6, emoji: '<:ngtrfront:1574441117662052483><:ngtrback:1574441112632958999>' },
  { key: 'audi', name: 'Audi R8', cost: 6750000n, cooldownMinutes: 5, emoji: '<:ar8front:1574441060116074632><:ar8back:1574441055099813898>' },
  { key: 'shelbymustang', name: 'Shelby Mustang', cost: 6900000n, cooldownMinutes: 5, emoji: '<:shelbymustangfront:1575602214167117854><:shelbymustangback:1575602218684522601>' },
  { key: 'jaguartype', name: 'Jaguar E-Type', cost: 7250000n, cooldownMinutes: 4, emoji: '<:jaguartypefront:1575602223088668828><:jaguartypeback:1575602228025106462>' },
  { key: 'lamborghini', name: 'Lamborghini Huracan', cost: 8400000n, cooldownMinutes: 3, emoji: '<:lhfront:1574441105301315615><:lhback:1574441100280602727>' },

  // Page 3 — Tier 3: Ultra-Luxury & Pinnacle Hypercars (3m - 1m) [5 Cars]
  { key: 'bentley', name: 'Bentley Bentayga', cost: 9200000n, cooldownMinutes: 3, emoji: '<:bentleyfront:1575602232685232159><:bentleyback:1575602237562953869>' },
  { key: 'rollsroyce', name: 'Rolls Royce Ghost', cost: 10250000n, cooldownMinutes: 2, emoji: '<:rrgfront:1574441137098195125><:rrgback:1574441132413292725>' },
  { key: 'ferrari', name: 'Ferrari La Ferrari', cost: 17700000n, cooldownMinutes: 1, emoji: '<:ffront:1574441080403787816><:fback:1574441075366564000>' },
  { key: 'mclarenf1', name: 'McLaren F1', cost: 19500000n, cooldownMinutes: 1, emoji: '<:mclarenf1front:1575602242256371782><:mclarenf1back:1575602252666904768>' },
  { key: 'bugatti', name: 'Bugatti Chiron', cost: 20500000n, cooldownMinutes: 1, emoji: '<:bcfront:1574441070484394104><:bcback:1574441065535246396>' }
];

export interface PlaystyleDef {
  code: string;
  name: string;
  position: 'ATT' | 'MID' | 'DEF';
  emoji: string;
  description: string;
  keyStats: string[];
}

export const PLAYSTYLES: Record<string, PlaystyleDef> = {
  PCH: {
    code: 'PCH',
    name: 'Poacher',
    position: 'ATT',
    emoji: '🎯',
    description: 'Box predator with lethal instinct, clinical finishing, and ice-cold composure.',
    keyStats: ['fin', 'cmp', 'agi']
  },
  SPD: {
    code: 'SPD',
    name: 'Speedster',
    position: 'ATT',
    emoji: '⚡',
    description: 'Explosive counter-attack runner who incinerates high backlines with blistering pace.',
    keyStats: ['pac', 'dri', 'pow']
  },
  TGT: {
    code: 'TGT',
    name: 'Target Man',
    position: 'ATT',
    emoji: '🦘',
    description: 'Colossal physical powerhouse who bullies center-backs in aerial duels and hold-up play.',
    keyStats: ['hea', 'phy', 'pow']
  },
  PLM: {
    code: 'PLM',
    name: 'Playmaker',
    position: 'MID',
    emoji: '🪄',
    description: 'Visionary midfield maestro threading pin-point through balls between compact defensive lines.',
    keyStats: ['vis', 'pas', 'dri']
  },
  B2B: {
    code: 'B2B',
    name: 'Box-to-Box',
    position: 'MID',
    emoji: '🔋',
    description: 'Endless engine dominating both boxes with relentless work rate and tactical tackling.',
    keyStats: ['wrk', 'cmp', 'tck']
  },
  ANC: {
    code: 'ANC',
    name: 'Anchor',
    position: 'MID',
    emoji: '🛡️',
    description: 'Deep holding defensive shield who sweeps up loose balls and shuts down transition attacks.',
    keyStats: ['tck', 'int', 'mrk']
  },
  STP: {
    code: 'STP',
    name: 'Stopper',
    position: 'DEF',
    emoji: '🛑',
    description: 'Aggressive physical enforcer who clatters strikers and clears box danger without mercy.',
    keyStats: ['phy', 'tck', 'hea']
  },
  SWP: {
    code: 'SWP',
    name: 'Sweeper',
    position: 'DEF',
    emoji: '🧹',
    description: 'Rapid recovery defender reading long balls and covering for out-of-position full-backs.',
    keyStats: ['pac', 'mrk', 'cmp']
  },
  BPD: {
    code: 'BPD',
    name: 'Ball-Playing Defender',
    position: 'DEF',
    emoji: '🧠',
    description: 'Cerebral ball-carrier stepping out of the defensive block with laser-guided progressive passing.',
    keyStats: ['int', 'pas', 'cmp']
  }
};

export interface SponsorDef {
  key: string;
  name: string;
  emoji: string;
  minFollowers: bigint;
  staminaCost: number;
  rewardCoins: bigint;
  followerDelta: bigint;
  vipOnly?: boolean;
}

export const SPONSORS: SponsorDef[] = [
  { key: 'heineken', name: 'Heineken', emoji: '<:heineken:1574441095511937045>', minFollowers: 100000n, staminaCost: 5, rewardCoins: 100000n, followerDelta: -50000n },
  { key: 'adidas', name: 'Adidas', emoji: '<:adidas:1574453812675088515>', minFollowers: 1000000n, staminaCost: 10, rewardCoins: 200000n, followerDelta: 0n },
  { key: 'vip', name: 'VIP Signature', emoji: '👑', minFollowers: 1000000n, staminaCost: 10, rewardCoins: 300000n, followerDelta: 0n, vipOnly: true },
  { key: 'cocacola', name: 'Coca-Cola', emoji: '<:cocacola:1574453824171671633>', minFollowers: 5000000n, staminaCost: 10, rewardCoins: 300000n, followerDelta: -200000n },
  { key: 'netflix', name: 'Netflix', emoji: '<:netflix:1574453835148169269>', minFollowers: 6000000n, staminaCost: 30, rewardCoins: 300000n, followerDelta: 50000n },
  { key: 'nike', name: 'Nike', emoji: '<:nike:1574453846812397578>', minFollowers: 8000000n, staminaCost: 50, rewardCoins: 500000n, followerDelta: -300000n }
];

export const ATTRIBUTES_LIST = [
  { key: 'fin', name: 'Finishing', category: 'Attacking' },
  { key: 'pow', name: 'Shot Power', category: 'Attacking' },
  { key: 'hea', name: 'Heading', category: 'Attacking' },
  { key: 'pas', name: 'Passing', category: 'Technical' },
  { key: 'vis', name: 'Vision', category: 'Technical' },
  { key: 'cro', name: 'Crossing', category: 'Technical' },
  { key: 'dri', name: 'Dribbling', category: 'Technical' },
  { key: 'tck', name: 'Tackling', category: 'Defending' },
  { key: 'int', name: 'Interceptions', category: 'Defending' },
  { key: 'mrk', name: 'Marking', category: 'Defending' },
  { key: 'pac', name: 'Pace', category: 'Physical & Mental' },
  { key: 'phy', name: 'Physicality', category: 'Physical & Mental' },
  { key: 'cmp', name: 'Composure', category: 'Physical & Mental' },
  { key: 'agi', name: 'Agility', category: 'Physical & Mental' },
  { key: 'wrk', name: 'Work Rate', category: 'Physical & Mental' }
] as const;

export interface ItemDef {
  key: string;
  name: string;
  symbol: string;
  type: 'consumable' | 'boots' | 'trophy' | 'medal' | 'award' | 'collectable';
  price?: bigint;
  effect?: string;
  position?: 'ATK' | 'MID' | 'DEF';
}

export const ITEM_CATALOG: Record<string, ItemDef> = {
  sd: { key: 'sd', name: 'Sports Drink', symbol: '<:sd:1574453670198902784>', type: 'consumable', price: 100000n, effect: '+50 Stamina' },
  strika: { key: 'strika', name: 'Strika Boots', symbol: '<:strika:1574453680709566594>', type: 'boots', price: 500000n, effect: '+10 Attack next match', position: 'ATK' },
  passa: { key: 'passa', name: 'Passa Boots', symbol: '<:passa:1574453692646563950>', type: 'boots', price: 500000n, effect: '+10 Midfield next match', position: 'MID' },
  bully: { key: 'bully', name: 'Bully Boots', symbol: '<:bully:1574453703514263713>', type: 'boots', price: 500000n, effect: '+10 Defence next match', position: 'DEF' },
  worldcup: { key: 'worldcup', name: 'World Cup Trophy', symbol: '<:worldcup:1574454369338925219>', type: 'trophy' },
  goldmedal: { key: 'goldmedal', name: 'Gold Medal', symbol: '<:goldmedal:1574453777497464913>', type: 'medal' },
  silvermedal: { key: 'silvermedal', name: 'Silver Medal', symbol: '<:silvermedal:1574453789157752907>', type: 'medal' },
  motm: { key: 'motm', name: 'Man of the Match Award', symbol: '<:motm:1574453801287557251>', type: 'award' },
  goldenboot: { key: 'goldenboot', name: 'Golden Boot', symbol: '<:goldenboot:1574453765698879639>', type: 'award' }
};

export interface CosmeticDef {
  key: string;
  name: string;
  kind: 'AVATAR' | 'BANNER';
  cost: bigint;
  rotationSlot: number; // 0 or 1 alternating months
  emoji: string;
  accentHex: string;
  secondaryHex: string;
  jerseyNumber: string;
  subtitle: string;
}

/**
 * Curated rotating boutique items: 8 footballers active each month (4 Avatars + 4 Full Banners)
 */
export const COSMETIC_CATALOG: CosmeticDef[] = [
  // Rotation A (Odd / Even alternating monthly drops - 8 footballers)
  { key: 'rodri', name: 'Rodri Edition', kind: 'AVATAR', cost: 750000n, rotationSlot: 0, emoji: '🩵', accentHex: '#38bdf8', secondaryHex: '#0284c7', jerseyNumber: '16', subtitle: 'METRONOME' },
  { key: 'bellingham', name: 'Bellingham Edition', kind: 'AVATAR', cost: 750000n, rotationSlot: 0, emoji: '🤍', accentHex: '#f8fafc', secondaryHex: '#94a3b8', jerseyNumber: '5', subtitle: 'GALACTICO' },
  { key: 'saka', name: 'Saka Edition', kind: 'AVATAR', cost: 750000n, rotationSlot: 0, emoji: '🔴', accentHex: '#ef4444', secondaryHex: '#991b1b', jerseyNumber: '7', subtitle: 'STARBOY' },
  { key: 'pedri', name: 'Pedri Edition', kind: 'AVATAR', cost: 750000n, rotationSlot: 0, emoji: '🔵', accentHex: '#3b82f6', secondaryHex: '#b91c1c', jerseyNumber: '8', subtitle: 'MAESTRO' },
  { key: 'zidane', name: 'Zidane Legend Banner', kind: 'BANNER', cost: 3000000n, rotationSlot: 0, emoji: '🖼️', accentHex: '#f59e0b', secondaryHex: '#1e3a8a', jerseyNumber: '10', subtitle: 'ZIZOU • ICON' },
  { key: 'maldini', name: 'Maldini Iron Banner', kind: 'BANNER', cost: 3000000n, rotationSlot: 0, emoji: '🖼️', accentHex: '#dc2626', secondaryHex: '#111827', jerseyNumber: '3', subtitle: 'IL CAPITANO' },
  { key: 'cr7', name: 'Cristiano Siuuu Banner', kind: 'BANNER', cost: 3000000n, rotationSlot: 0, emoji: '🖼️', accentHex: '#eab308', secondaryHex: '#0f172a', jerseyNumber: '7', subtitle: 'MR. CHAMPIONS' },
  { key: 'messi', name: 'Messi Magic Banner', kind: 'BANNER', cost: 3000000n, rotationSlot: 0, emoji: '🖼️', accentHex: '#60a5fa', secondaryHex: '#1e293b', jerseyNumber: '10', subtitle: 'LA PULGA • 10' },

  // Rotation B (Alternating month drop - 8 footballers)
  { key: 'vinicius', name: 'Vinicius Jr Edition', kind: 'AVATAR', cost: 750000n, rotationSlot: 1, emoji: '⚡', accentHex: '#facc15', secondaryHex: '#166534', jerseyNumber: '7', subtitle: 'BAILA VINI' },
  { key: 'musiala', name: 'Musiala Edition', kind: 'AVATAR', cost: 750000n, rotationSlot: 1, emoji: '🪄', accentHex: '#f43f5e', secondaryHex: '#881337', jerseyNumber: '42', subtitle: 'BAMBI' },
  { key: 'saliba', name: 'Saliba Edition', kind: 'AVATAR', cost: 750000n, rotationSlot: 1, emoji: '🛡️', accentHex: '#fb7185', secondaryHex: '#4c0519', jerseyNumber: '2', subtitle: 'ROLLS ROYCE' },
  { key: 'valverde', name: 'Valverde Edition', kind: 'AVATAR', cost: 750000n, rotationSlot: 1, emoji: '🦅', accentHex: '#38bdf8', secondaryHex: '#1e293b', jerseyNumber: '8', subtitle: 'EL HALCON' },
  { key: 'r9', name: 'R9 Fenomeno Banner', kind: 'BANNER', cost: 3000000n, rotationSlot: 1, emoji: '🖼️', accentHex: '#22c55e', secondaryHex: '#eab308', jerseyNumber: '9', subtitle: 'O FENOMENO' },
  { key: 'henry', name: 'Henry Invincible Banner', kind: 'BANNER', cost: 3000000n, rotationSlot: 1, emoji: '🖼️', accentHex: '#ef4444', secondaryHex: '#ca8a04', jerseyNumber: '14', subtitle: 'KING HENRY' },
  { key: 'ronaldinho', name: 'Ronaldinho Joga Banner', kind: 'BANNER', cost: 3000000n, rotationSlot: 1, emoji: '🖼️', accentHex: '#a855f7', secondaryHex: '#eab308', jerseyNumber: '10', subtitle: 'JOGA BONITO' },
  { key: 'iniesta', name: 'Iniesta Architect Banner', kind: 'BANNER', cost: 3000000n, rotationSlot: 1, emoji: '🖼️', accentHex: '#ef4444', secondaryHex: '#1d4ed8', jerseyNumber: '8', subtitle: 'DON ANDRES' }
];

export function getCurrentMonthKey(date = new Date()): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

export function getActiveMonthlyCosmetics(date = new Date()): CosmeticDef[] {
  const slot = date.getUTCMonth() % 2;
  return COSMETIC_CATALOG.filter(c => c.rotationSlot === slot);
}

export interface ProfileThemeDef {
  key: string;
  name: string;
  bgStart: string;
  bgEnd: string;
  accent: string;
  glow: string;
}

/**
 * 20 Generative Visual Stadium Backdrop Themes for -profile cards
 */
export const PROFILE_THEMES: ProfileThemeDef[] = [
  { key: 'obsidian', name: 'Obsidian Stadium', bgStart: '#090d16', bgEnd: '#1e293b', accent: '#38bdf8', glow: 'rgba(56, 189, 248, 0.25)' },
  { key: 'champions_gold', name: 'Champions Gold', bgStart: '#0b0904', bgEnd: '#261b07', accent: '#f59e0b', glow: 'rgba(245, 158, 11, 0.30)' },
  { key: 'emerald_pitch', name: 'Emerald Pitch', bgStart: '#04140d', bgEnd: '#0b2e1e', accent: '#10b981', glow: 'rgba(16, 185, 129, 0.28)' },
  { key: 'crimson_ultras', name: 'Crimson Ultras', bgStart: '#14060a', bgEnd: '#330b14', accent: '#ef4444', glow: 'rgba(239, 68, 68, 0.28)' },
  { key: 'cyber_cyan', name: 'Cyber Telemetry', bgStart: '#041219', bgEnd: '#0c2c3d', accent: '#06b6d4', glow: 'rgba(6, 182, 212, 0.30)' },
  { key: 'royal_cobalt', name: 'Royal Cobalt', bgStart: '#060c1f', bgEnd: '#132459', accent: '#3b82f6', glow: 'rgba(59, 130, 246, 0.28)' },
  { key: 'midnight_neon', name: 'Midnight Neon', bgStart: '#090418', bgEnd: '#1e0b42', accent: '#a855f7', glow: 'rgba(168, 85, 247, 0.30)' },
  { key: 'sunset_derby', name: 'Sunset Derby', bgStart: '#1a0905', bgEnd: '#3b150c', accent: '#f97316', glow: 'rgba(249, 115, 22, 0.30)' },
  { key: 'aurora_nordic', name: 'Nordic Aurora', bgStart: '#041315', bgEnd: '#0b2d30', accent: '#2dd4bf', glow: 'rgba(45, 212, 191, 0.26)' },
  { key: 'volcanic_flare', name: 'Volcanic Flare', bgStart: '#140606', bgEnd: '#380f0f', accent: '#fb7185', glow: 'rgba(251, 113, 133, 0.28)' },
  { key: 'arctic_frost', name: 'Arctic Frost', bgStart: '#0c1524', bgEnd: '#1e324d', accent: '#bae6fd', glow: 'rgba(186, 230, 253, 0.26)' },
  { key: 'galactic_violet', name: 'Galactic Violet', bgStart: '#12051c', bgEnd: '#2e0d47', accent: '#d946ef', glow: 'rgba(217, 70, 239, 0.28)' },
  { key: 'brazilian_samba', name: 'Samba Selecao', bgStart: '#06150a', bgEnd: '#1b3609', accent: '#facc15', glow: 'rgba(250, 204, 21, 0.28)' },
  { key: 'tokyo_drift', name: 'Tokyo Night', bgStart: '#110617', bgEnd: '#290d2e', accent: '#ec4899', glow: 'rgba(236, 72, 153, 0.30)' },
  { key: 'moroccan_atlas', name: 'Atlas Lions', bgStart: '#170607', bgEnd: '#072415', accent: '#22c55e', glow: 'rgba(34, 197, 94, 0.28)' },
  { key: 'azteca_jade', name: 'Azteca Jade', bgStart: '#041612', bgEnd: '#0c382c', accent: '#34d399', glow: 'rgba(52, 211, 153, 0.26)' },
  { key: 'wembley_arch', name: 'Wembley Night', bgStart: '#0c0c14', bgEnd: '#1f2338', accent: '#f43f5e', glow: 'rgba(244, 63, 94, 0.26)' },
  { key: 'san_siro', name: 'San Siro Derby', bgStart: '#080e1a', bgEnd: '#260b10', accent: '#e11d48', glow: 'rgba(225, 29, 72, 0.28)' },
  { key: 'bernabeu_white', name: 'Bernabeu Crown', bgStart: '#0f131f', bgEnd: '#242b42', accent: '#fbbf24', glow: 'rgba(251, 191, 36, 0.28)' },
  { key: 'maracana_glow', name: 'Maracana Lights', bgStart: '#07141f', bgEnd: '#102d47', accent: '#38bdf8', glow: 'rgba(250, 204, 21, 0.28)' }
];

export interface AuctionRelicDef {
  itemKey: string;
  itemName: string;
  emoji: string;
  description: string;
  startingPrice: bigint;
}

export const AUCTION_RELIC_POOL: AuctionRelicDef[] = [
  {
    itemKey: 'worldcup_replica',
    itemName: '1970 Jules Rimet Replica',
    emoji: '<:worldcup:1574454369338925219>',
    description: 'Solid gold-plated vintage World Cup collector trophy for the cabinet.',
    startingPrice: 2500000n
  },
  {
    itemKey: 'golden_boot_relic',
    itemName: 'Brass Vintage Golden Boot',
    emoji: '<:goldenboot:1574453765698879639>',
    description: 'Hand-cast scorer relic honoring legendary hat-trick heroes.',
    startingPrice: 1500000n
  },
  {
    itemKey: 'signed_matchball',
    itemName: 'Signed 1998 Final Matchball',
    emoji: '⚽',
    description: 'Authenticated leather matchball signed by championship captains.',
    startingPrice: 750000n
  },
  {
    itemKey: 'ballon_trophy',
    itemName: 'Crystal Ballon Statuette',
    emoji: '<:motm:1574453801287557251>',
    description: 'Ultra-rare ceremonial gala trophy recognizing generational brilliance.',
    startingPrice: 2000000n
  },
  {
    itemKey: 'captain_armband',
    itemName: 'Champion Silk Armband',
    emoji: '🎖️',
    description: 'Match-worn embroidery armband worn in a Continental Final.',
    startingPrice: 600000n
  },
  {
    itemKey: 'legacy_shirt',
    itemName: 'Framed #10 Legacy Jersey',
    emoji: '👕',
    description: 'Numbered collectors kit sealed in museum glass.',
    startingPrice: 1000000n
  },
  {
    itemKey: 'donor_crown',
    itemName: 'Founder Patron Crest',
    emoji: '💎',
    description: 'Honorary prestige insignia celebrating dedicated supporters & high-rollers.',
    startingPrice: 1800000n
  }
];
