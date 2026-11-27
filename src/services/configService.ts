import { prisma } from '../database/prisma.js';
import { AUCTION_RELIC_POOL, COSMETIC_CATALOG, VEHICLE_CATALOG } from '../config/constants.js';

export const DEFAULT_MARKET_PRICES: Record<'sd' | 'strika' | 'passa' | 'bully', bigint> = {
  sd: 100000n,
  strika: 500000n,
  passa: 500000n,
  bully: 500000n,
};

export interface AuctionAutomationConfig {
  autoEnabled: boolean;
  lotsPerDrop: number;
  durationHours: number;
  minBidIncrement: bigint;
  antiSnipeMinutes: number;
}

const DEFAULT_AUCTION_CONFIG: AuctionAutomationConfig = {
  autoEnabled: true,
  lotsPerDrop: 2,
  durationHours: 22,
  minBidIncrement: 50000n,
  antiSnipeMinutes: 2,
};

const PRICE_PREFIX = 'price:';
const AUCTION_CFG_KEY = 'auction:automation';

let initialized = false;
const priceOverrides = new Map<string, bigint>();
let auctionConfig: AuctionAutomationConfig = { ...DEFAULT_AUCTION_CONFIG };

function parseBigIntSafe(raw: string, fallback: bigint): bigint {
  try {
    const val = BigInt(raw);
    return val > 0n ? val : fallback;
  } catch {
    return fallback;
  }
}

export async function loadConfigCache(force = false): Promise<void> {
  if (initialized && !force) return;
  try {
    const rows = await prisma.botSetting.findMany();
    priceOverrides.clear();
    auctionConfig = { ...DEFAULT_AUCTION_CONFIG };

    for (const row of rows) {
      if (row.key.startsWith(PRICE_PREFIX)) {
        const itemKey = row.key.slice(PRICE_PREFIX.length);
        const parsed = parseBigIntSafe(row.value, 0n);
        if (parsed > 0n) priceOverrides.set(itemKey, parsed);
      } else if (row.key === AUCTION_CFG_KEY) {
        try {
          const obj = JSON.parse(row.value);
          auctionConfig = {
            autoEnabled: typeof obj.autoEnabled === 'boolean' ? obj.autoEnabled : DEFAULT_AUCTION_CONFIG.autoEnabled,
            lotsPerDrop: Number.isFinite(Number(obj.lotsPerDrop)) ? Math.max(1, Math.min(4, Math.round(Number(obj.lotsPerDrop)))) : DEFAULT_AUCTION_CONFIG.lotsPerDrop,
            durationHours: Number.isFinite(Number(obj.durationHours)) ? Math.max(1, Math.min(72, Number(obj.durationHours))) : DEFAULT_AUCTION_CONFIG.durationHours,
            minBidIncrement: obj.minBidIncrement ? parseBigIntSafe(String(obj.minBidIncrement), DEFAULT_AUCTION_CONFIG.minBidIncrement) : DEFAULT_AUCTION_CONFIG.minBidIncrement,
            antiSnipeMinutes: Number.isFinite(Number(obj.antiSnipeMinutes)) ? Math.max(0, Math.min(15, Math.round(Number(obj.antiSnipeMinutes)))) : DEFAULT_AUCTION_CONFIG.antiSnipeMinutes,
          };
        } catch {
          auctionConfig = { ...DEFAULT_AUCTION_CONFIG };
        }
      }
    }
    initialized = true;
  } catch {
    // Keep defaults cleanly if table isn't ready yet
  }
}

export function getEffectivePrice(key: string, fallbackCost: bigint): bigint {
  return priceOverrides.get(key.toLowerCase()) ?? fallbackCost;
}

export function getMarketItemPrice(key: 'sd' | 'strika' | 'passa' | 'bully'): bigint {
  return getEffectivePrice(key, DEFAULT_MARKET_PRICES[key]);
}

export function getAuctionAutomationConfig(): AuctionAutomationConfig {
  return { ...auctionConfig };
}

export function listConfigurablePriceTargets(): Array<{
  key: string;
  label: string;
  category: 'Market Gear' | 'Vehicles' | 'Avatars' | 'Banners' | 'Auction Relics';
  defaultPrice: bigint;
  effectivePrice: bigint;
  isOverridden: boolean;
}> {
  const out: Array<{
    key: string;
    label: string;
    category: 'Market Gear' | 'Vehicles' | 'Avatars' | 'Banners' | 'Auction Relics';
    defaultPrice: bigint;
    effectivePrice: bigint;
    isOverridden: boolean;
  }> = [];

  for (const [k, defCost] of Object.entries(DEFAULT_MARKET_PRICES)) {
    const eff = getEffectivePrice(k, defCost);
    out.push({
      key: k,
      label: k === 'sd' ? 'Sports Drink (+50 Stamina)' : `${k.toUpperCase()} Boots`,
      category: 'Market Gear',
      defaultPrice: defCost,
      effectivePrice: eff,
      isOverridden: eff !== defCost,
    });
  }

  for (const v of VEHICLE_CATALOG) {
    const eff = getEffectivePrice(v.key, v.cost);
    out.push({ key: v.key, label: v.name, category: 'Vehicles', defaultPrice: v.cost, effectivePrice: eff, isOverridden: eff !== v.cost });
  }

  for (const c of COSMETIC_CATALOG) {
    const eff = getEffectivePrice(c.key, c.cost);
    out.push({
      key: c.key,
      label: c.name,
      category: c.kind === 'AVATAR' ? 'Avatars' : 'Banners',
      defaultPrice: c.cost,
      effectivePrice: eff,
      isOverridden: eff !== c.cost,
    });
  }

  for (const r of AUCTION_RELIC_POOL) {
    const eff = getEffectivePrice(r.itemKey, r.startingPrice);
    out.push({ key: r.itemKey, label: `${r.itemName} (Start Bid)`, category: 'Auction Relics', defaultPrice: r.startingPrice, effectivePrice: eff, isOverridden: eff !== r.startingPrice });
  }

  return out;
}

export function resolvePriceTargetKeys(rawTarget: string): { keys: string[]; label: string } | null {
  const clean = rawTarget.trim().toLowerCase();
  if (!clean) return null;

  if (clean === 'boots' || clean === 'all_boots') {
    return { keys: ['strika', 'passa', 'bully'], label: 'All Performance Boots (strika, passa, bully)' };
  }
  if (clean === 'avatars' || clean === 'all_avatars') {
    return { keys: COSMETIC_CATALOG.filter(c => c.kind === 'AVATAR').map(c => c.key), label: 'All 5 Custom Avatars' };
  }
  if (clean === 'banners' || clean === 'all_banners') {
    return { keys: COSMETIC_CATALOG.filter(c => c.kind === 'BANNER').map(c => c.key), label: 'All 5 Legend Banners' };
  }
  if (clean === 'cars' || clean === 'vehicles' || clean === 'all_cars') {
    return { keys: VEHICLE_CATALOG.map(v => v.key), label: 'All 16 Showroom Vehicles' };
  }
  if (clean === 'sportsdrink' || clean === 'drink') {
    return { keys: ['sd'], label: 'Sports Drink (sd)' };
  }

  const allTargets = listConfigurablePriceTargets();
  const normalizedCar = clean === 'shelbymustang' ? 'mustang' : clean;
  const exact = allTargets.find(t => t.key.toLowerCase() === normalizedCar);
  if (exact) return { keys: [exact.key], label: `${exact.label} (\`${exact.key}\`)` };

  const partial = allTargets.find(t => t.label.toLowerCase().includes(clean));
  if (partial) return { keys: [partial.key], label: `${partial.label} (\`${partial.key}\`)` };

  return null;
}

export async function setItemPriceOverrides(keys: string[], newPrice: bigint): Promise<void> {
  for (const k of keys) {
    const lower = k.toLowerCase();
    await prisma.botSetting.upsert({
      where: { key: `${PRICE_PREFIX}${lower}` },
      update: { value: newPrice.toString() },
      create: { key: `${PRICE_PREFIX}${lower}`, value: newPrice.toString() },
    });
    priceOverrides.set(lower, newPrice);
  }
  initialized = true;
}

export async function resetItemPriceOverrides(keys?: string[]): Promise<number> {
  if (!keys || keys.length === 0) {
    const res = await prisma.botSetting.deleteMany({
      where: { key: { startsWith: PRICE_PREFIX } },
    });
    priceOverrides.clear();
    return res.count;
  }

  const dbKeys = keys.map(k => `${PRICE_PREFIX}${k.toLowerCase()}`);
  const res = await prisma.botSetting.deleteMany({
    where: { key: { in: dbKeys } },
  });
  for (const k of keys) priceOverrides.delete(k.toLowerCase());
  return res.count;
}

export async function updateAuctionAutomationConfig(
  patch: Partial<AuctionAutomationConfig>
): Promise<AuctionAutomationConfig> {
  await loadConfigCache();
  const next: AuctionAutomationConfig = {
    autoEnabled: patch.autoEnabled ?? auctionConfig.autoEnabled,
    lotsPerDrop: patch.lotsPerDrop !== undefined ? Math.max(1, Math.min(4, Math.round(patch.lotsPerDrop))) : auctionConfig.lotsPerDrop,
    durationHours: patch.durationHours !== undefined ? Math.max(1, Math.min(72, patch.durationHours)) : auctionConfig.durationHours,
    minBidIncrement: patch.minBidIncrement !== undefined && patch.minBidIncrement > 0n ? patch.minBidIncrement : auctionConfig.minBidIncrement,
    antiSnipeMinutes: patch.antiSnipeMinutes !== undefined ? Math.max(0, Math.min(15, Math.round(patch.antiSnipeMinutes))) : auctionConfig.antiSnipeMinutes,
  };

  await prisma.botSetting.upsert({
    where: { key: AUCTION_CFG_KEY },
    update: {
      value: JSON.stringify({
        autoEnabled: next.autoEnabled,
        lotsPerDrop: next.lotsPerDrop,
        durationHours: next.durationHours,
        minBidIncrement: next.minBidIncrement.toString(),
        antiSnipeMinutes: next.antiSnipeMinutes,
      }),
    },
    create: {
      key: AUCTION_CFG_KEY,
      value: JSON.stringify({
        autoEnabled: next.autoEnabled,
        lotsPerDrop: next.lotsPerDrop,
        durationHours: next.durationHours,
        minBidIncrement: next.minBidIncrement.toString(),
        antiSnipeMinutes: next.antiSnipeMinutes,
      }),
    },
  });

  auctionConfig = next;
  initialized = true;
  return { ...auctionConfig };
}
