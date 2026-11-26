/**
 * Formats numbers into WITS-style 'k' notation.
 * e.g. 50000 -> "50k", 100000 -> "100k", 3436000 -> "3436k"
 */
export function formatK(num: number | bigint): string {
  const n = typeof num === 'bigint' ? Number(num) : num;
  if (Math.abs(n) >= 1000) {
    const kVal = Math.round(n / 1000);
    return `${kVal}k`;
  }
  return n.toLocaleString();
}

/**
 * Parses shorthand coin/numeric strings like "500k", "1.5m", "2,500,000" into BigInt.
 */
export function parseCoinAmount(raw: string): bigint | null {
  const clean = raw.trim().toLowerCase().replace(/,/g, '');
  if (!clean) return null;
  const match = clean.match(/^(\d+(?:\.\d+)?)(k|m|b)?$/);
  if (!match) return null;
  const num = parseFloat(match[1]);
  if (!isFinite(num) || num <= 0) return null;
  const mult = match[2] === 'b' ? 1_000_000_000 : match[2] === 'm' ? 1_000_000 : match[2] === 'k' ? 1_000 : 1;
  return BigInt(Math.round(num * mult));
}

/**
 * Returns player's national team flag or football fallback
 */
export function getNationFlag(nation?: { flag?: string | null } | null): string {
  if (nation?.flag && nation.flag.trim().length > 0) {
    return nation.flag.trim();
  }
  return '⚽';
}
