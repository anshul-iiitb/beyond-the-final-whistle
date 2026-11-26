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
    description: 'Premier football training ground with state-of-the-art pitch and drills.',
    activities: [
      '-train (Earn Training Points, 30m cooldown)',
      '-train vip (VIP drill: +6 TP, 6h cooldown)',
      '-train noeffort (VIP: +20 TP, 1/day)'
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
  gm: {
    id: 'gm',
    name: 'Global Market',
    alias: 'gm',
    channelName: 'global-market',
    emoji: '🛍️',
    description: 'Global athletic gear shop for energy drinks and matchday performance boots.',
    activities: [
      '-buy sd (Sports Drink: +50 Stamina, 100k coins)',
      '-buy strika (Strika Boots: +10 ATK next match, 500k coins)',
      '-buy passa (Passa Boots: +10 MID next match, 500k coins)',
      '-buy bully (Bully Boots: +10 DEF next match, 500k coins)'
    ]
  },
  ph: {
    id: 'ph',
    name: 'Photoshooting Hall',
    alias: 'ph',
    channelName: 'photoshoot-hall',
    emoji: '📸',
    description: 'Commercial studio to sign lucrative brand sponsorship contracts.',
    activities: [
      '-advert (Sign commercial deals: Heineken, Adidas, Coca-Cola, Netflix, 2h cooldown)'
    ]
  },
  ps: {
    id: 'ps',
    name: 'Player Sauna',
    alias: 'ps',
    channelName: 'player-sauna',
    emoji: '🧖',
    description: 'Cryotherapy and steam sauna to soothe fatigue and restore stamina.',
    activities: [
      '-recovery (Free stamina recovery: +30 Regular, +100 VIP, 12h cooldown)'
    ]
  },
  lc: {
    id: 'lc',
    name: 'Local Club',
    alias: 'lc',
    channelName: 'local-club',
    emoji: '🏟️',
    description: 'Community football club for youth grassroots coaching and autograph sessions.',
    activities: [
      '-coaching (+50k coins, 10 stamina, 2h cooldown)',
      '-meetgreet (+50k followers, 10 stamina, 2h cooldown)'
    ]
  },
  vs: {
    id: 'vs',
    name: 'Vehicle Showroom',
    alias: 'vs',
    channelName: 'showroom',
    emoji: '🏎️',
    description: 'Luxury automotive dealership featuring superbikes, grand tourers, and hypercars.',
    activities: [
      '-showroom (Inspect exotic vehicles catalog)',
      '-vehiclebuy <alias> (Purchase vehicle to slash campus travel cooldowns)'
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
  }
};

export const BASE_TRAVEL_COOLDOWN_MINUTES = 20;

export interface VehicleDef {
  key: string;
  name: string;
  cost: bigint;
  cooldownMinutes: number;
  emoji: string;
}

export const VEHICLE_CATALOG: VehicleDef[] = [
  // Tier 1: Starter Roadsters (16m - 14m)
  { key: 'basic', name: 'Basic Car', cost: 700000n, cooldownMinutes: 16, emoji: '🚗' },
  { key: 'mini', name: 'Mini Cooper', cost: 850000n, cooldownMinutes: 16, emoji: '🚗' },
  { key: 'honda', name: 'Honda Civic', cost: 1000000n, cooldownMinutes: 14, emoji: '<:hcfront:1574441090503938158><:hcback:1574441085294616640>' },

  // Tier 2: Mid-Range Sports & Sedans (10m - 7m)
  { key: 'toyota', name: 'Toyota Supra', cost: 3000000n, cooldownMinutes: 10, emoji: '<:tsfront:1574441146850082917><:tsback:1574441142022570014>' },
  { key: 'bmwm3', name: 'BMW M3', cost: 3800000n, cooldownMinutes: 9, emoji: '🚙' },
  { key: 'porsche', name: 'Porsche 911', cost: 5350000n, cooldownMinutes: 7, emoji: '<:p911front:1574441127464014015><:p911back:1574441122716065923>' },

  // Tier 3: Track Weapons & Classic Muscle (4m)
  { key: 'corvettec8', name: 'Corvette C8', cost: 6500000n, cooldownMinutes: 4, emoji: '🏎️' },
  { key: 'nissan', name: 'Nissan GTR', cost: 6750000n, cooldownMinutes: 4, emoji: '<:ngtrfront:1574441117662052483><:ngtrback:1574441112632958999>' },
  { key: 'audi', name: 'Audi R8', cost: 6750000n, cooldownMinutes: 4, emoji: '<:ar8front:1574441060116074632><:ar8back:1574441055099813898>' },
  { key: 'shelbymustang', name: 'Shelby Mustang', cost: 6900000n, cooldownMinutes: 4, emoji: '🏎️' },
  { key: 'jaguartype', name: 'Jaguar E-Type', cost: 7250000n, cooldownMinutes: 4, emoji: '🏎️' },

  // Tier 4: Ultra-Luxury & Grand Tourers (3m - 2m)
  { key: 'lamborghini', name: 'Lamborghini Huracan', cost: 8400000n, cooldownMinutes: 3, emoji: '<:lhfront:1574441105301315615><:lhback:1574441100280602727>' },
  { key: 'bentley', name: 'Bentley Bentayga', cost: 9200000n, cooldownMinutes: 3, emoji: '🚙' },
  { key: 'rollsroyce', name: 'Rolls Royce Ghost', cost: 10250000n, cooldownMinutes: 2, emoji: '<:rrgfront:1574441137098195125><:rrgback:1574441132413292725>' },

  // Tier 5: Pinnacle Hypercars (1m)
  { key: 'ferrari', name: 'Ferrari La Ferrari', cost: 17700000n, cooldownMinutes: 1, emoji: '<:ffront:1574441080403787816><:fback:1574441075366564000>' },
  { key: 'mclarenf1', name: 'McLaren F1', cost: 19500000n, cooldownMinutes: 1, emoji: '🏎️' },
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
}

export const SPONSORS: SponsorDef[] = [
  { key: 'heineken', name: 'Heineken', emoji: '<:heineken:1574441095511937045>', minFollowers: 100000n, staminaCost: 5, rewardCoins: 100000n, followerDelta: -50000n },
  { key: 'adidas', name: 'Adidas', emoji: '<:adidas:1574453812675088515>', minFollowers: 1000000n, staminaCost: 10, rewardCoins: 200000n, followerDelta: 0n },
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
