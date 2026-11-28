import assert from 'node:assert';
import { calculateDerivedRatings } from '../dist/engines/matchSimulationEngine.js';
import { MAX_BET_AMOUNT } from '../dist/engines/bettingEngine.js';
import { MATCHDAY_LOCKOUT_WHITELIST } from '../dist/engines/fixtureEngine.js';

console.log('🧪 Starting BTFW New Feature Verification Tests...\n');

// 1. Verify Max Bet Limit
console.log('1️⃣ Checking Maximum Sportsbook Bet Limit...');
assert.strictEqual(MAX_BET_AMOUNT, 50000n, 'MAX_BET_AMOUNT must strictly be 50,000 coins (50k)');
console.log('   ✅ Max bet limit is strictly enforced at 50,000 coins (50k).');

// 2. Verify Capped TP Boost & Position-Linked Boots
console.log('\n2️⃣ Checking Position-Linked Boots, Intel & Capped +10 TP Stat Boosts...');

const mockAttacker = {
  // Stats yielding raw Atk: 56, Mid: 53, Def: 51
  fin: 56, pow: 56, hea: 56, pac: 56,
  pas: 53, vis: 53, cro: 53, dri: 53, cmp: 53,
  tck: 51, int: 51, mrk: 51, phy: 51, agi: 50, wrk: 50,
  position: 'ATT',
  activeBoots: null,
  trainingPoints: 0,
  intelBonus: 0
};

// Base with 0 TP, no boots
const baseRatings = calculateDerivedRatings(mockAttacker, 'ATK');
console.log(`   Base Ratings (0 TP, no boots): ATK ${baseRatings.atk} | MID ${baseRatings.mid} | DEF ${baseRatings.def}`);
assert.strictEqual(baseRatings.atk, 56);
assert.strictEqual(baseRatings.mid, 53);
assert.strictEqual(baseRatings.def, 51);

// Attacker with 40 TP: +10 ATK boost
const with40Tp = calculateDerivedRatings({ ...mockAttacker, trainingPoints: 40 }, 'ATK');
console.log(`   With 40 TP (playing ATK): ATK ${with40Tp.atk} | MID ${with40Tp.mid} | DEF ${with40Tp.def}`);
assert.strictEqual(with40Tp.atk, 66, '40 TP must provide +10 boost to played position');
assert.strictEqual(with40Tp.mid, 53, 'MID must NOT receive ATK boost');
assert.strictEqual(with40Tp.def, 51, 'DEF must NOT receive ATK boost');

// Attacker with 80 TP: strictly capped at +10 max boost!
const with80Tp = calculateDerivedRatings({ ...mockAttacker, trainingPoints: 80 }, 'ATK');
console.log(`   With 80 TP (cap check): ATK ${with80Tp.atk} | MID ${with80Tp.mid} | DEF ${with80Tp.def}`);
assert.strictEqual(with80Tp.atk, 66, 'TP stat boost must strictly be hard-capped at +10 max');

// Attacker with 40 TP + STRIKA boots (+10 ATK)
const withStrika = calculateDerivedRatings({ ...mockAttacker, trainingPoints: 40, activeBoots: 'strika' }, 'ATK');
console.log(`   With 40 TP + STRIKA boots (matched): ATK ${withStrika.atk} | MID ${withStrika.mid} | DEF ${withStrika.def}`);
assert.strictEqual(withStrika.atk, 76, 'Matched strika boots must provide +10 to ATK');

// Attacker with 40 TP + PASSA boots (mismatched, must give +0!)
const withPassa = calculateDerivedRatings({ ...mockAttacker, trainingPoints: 40, activeBoots: 'passa' }, 'ATK');
console.log(`   With 40 TP + PASSA boots (mismatched for ATK): ATK ${withPassa.atk} | MID ${withPassa.mid} | DEF ${withPassa.def}`);
assert.strictEqual(withPassa.atk, 66, 'Mismatched passa boots must provide +0 to ATK');

// Playing Defender with BULLY boots (matched)
const defender = { ...mockAttacker, position: 'DEF', activeBoots: 'bully', trainingPoints: 20 }; // +5 TP boost
const defRatings = calculateDerivedRatings(defender, 'DEF');
console.log(`   Defender with 20 TP + BULLY boots: ATK ${defRatings.atk} | MID ${defRatings.mid} | DEF ${defRatings.def}`);
assert.strictEqual(defRatings.def, 51 + 5 + 10, 'Defender must get +5 TP boost and +10 bully boot bonus');
assert.strictEqual(defRatings.atk, 56, 'ATK must remain unboosted when playing DEF');

console.log('   ✅ Capped TP Boost (+10 max) and Position-Locked Boots fully verified.');

// 3. Matchday Lockout Whitelist
console.log('\n3️⃣ Checking Matchday Lockout Whitelist...');
assert.ok(MATCHDAY_LOCKOUT_WHITELIST.has('tweet'), 'Tweet must be whitelisted during matchday lockout');
assert.ok(MATCHDAY_LOCKOUT_WHITELIST.has('tactics'), 'Tactics must be whitelisted during matchday lockout');
assert.ok(MATCHDAY_LOCKOUT_WHITELIST.has('intteam'), 'Intteam must be whitelisted during matchday lockout');
assert.ok(!MATCHDAY_LOCKOUT_WHITELIST.has('train'), 'Training must be blocked during matchday lockout');
assert.ok(!MATCHDAY_LOCKOUT_WHITELIST.has('bet'), 'Betting must be blocked during matchday lockout');
assert.ok(!MATCHDAY_LOCKOUT_WHITELIST.has('buy'), 'Market purchases must be blocked during matchday lockout');
console.log('   ✅ Matchday Lockout permissions correctly whitelisted/blacklisted.');

console.log('\n🎉 ALL NEW FEATURE TESTS PASSED SUCCESSFULLY!\n');
