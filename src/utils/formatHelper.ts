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
 * Returns player's national team flag or football fallback
 */
export function getNationFlag(nation?: { flag?: string | null } | null): string {
  if (nation?.flag && nation.flag.trim().length > 0) {
    return nation.flag.trim();
  }
  return '⚽';
}
