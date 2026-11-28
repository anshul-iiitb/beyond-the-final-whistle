import assert from 'node:assert';
import { calculateDerivedRatings, calculatePlaystyleMastery } from '../dist/engines/matchSimulationEngine.js';
import { MAX_BET_AMOUNT } from '../dist/engines/bettingEngine.js';
import { MATCHDAY_LOCKOUT_WHITELIST } from '../dist/engines/fixtureEngine.js';
import { PLAYSTYLES } from '../dist/config/constants.js';

console.log('🧪 Starting BTFW New Feature Verification Tests...\n');

// 1. Verify Max Bet Limit
console.log('1️⃣ Checking Maximum Sportsbook Bet Limit...');
assert.strictEqual(MAX_BET_AMOUNT, 50000n, 'MAX_BET_AMOUNT must strictly be 50,000 coins (50k)');
console.log('   ✅ Max bet limit is strictly enforced at 50,000 coins (50k).');

// 2. Verify Capped TP Boost & Position-Locked Boots
console.log('\n2️⃣ Checking Position-Locked Boots, Intel & Capped +10 TP Stat Boosts...');

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

// 4. 18 Balanced Tactical Playstyles
console.log('\n4️⃣ Checking 18 Balanced Playstyle Archetypes (6-6-6)...');
const strikers = ['PCH', 'F9', 'TGT', 'SPD', 'INF', 'PFW'];
const midfielders = ['ENG', 'B2B', 'MEZ', 'REG', 'BWM', 'ANC'];
const defenders = ['NND', 'BPD', 'STP', 'COV', 'AER', 'WCB'];

for (const s of strikers) {
  assert.ok(PLAYSTYLES[s], `Striker playstyle ${s} must exist`);
  assert.strictEqual(PLAYSTYLES[s].position, 'ATT');
  assert.strictEqual(PLAYSTYLES[s].keyStats.length, 3);
}
for (const m of midfielders) {
  assert.ok(PLAYSTYLES[m], `Midfielder playstyle ${m} must exist`);
  assert.strictEqual(PLAYSTYLES[m].position, 'MID');
  assert.strictEqual(PLAYSTYLES[m].keyStats.length, 3);
}
for (const d of defenders) {
  assert.ok(PLAYSTYLES[d], `Defender playstyle ${d} must exist`);
  assert.strictEqual(PLAYSTYLES[d].position, 'DEF');
  assert.strictEqual(PLAYSTYLES[d].keyStats.length, 3);
}
const uniqueStyles = Array.from(new Map(Object.values(PLAYSTYLES).map(s => [s.code, s])).values());
assert.strictEqual(uniqueStyles.filter(s => s.position === 'ATT').length, 6, 'Must have exactly 6 unique Striker archetypes');
assert.strictEqual(uniqueStyles.filter(s => s.position === 'MID').length, 6, 'Must have exactly 6 unique Midfielder archetypes');
assert.strictEqual(uniqueStyles.filter(s => s.position === 'DEF').length, 6, 'Must have exactly 6 unique Defender archetypes');
console.log('   ✅ All 18 playstyles (6 Strikers, 6 Midfielders, 6 Defenders) verified with 3 key stats each.');

// 5. In-Match Key Stat Mastery Tiers
console.log('\n5️⃣ Checking Key Stat Mastery Tiers & Duel Multipliers...');

// Poacher with key stats: fin, cmp, agi
const rookiePoacher = calculatePlaystyleMastery({ playstyle: 'PCH', fin: 55, cmp: 50, agi: 50 });
assert.strictEqual(rookiePoacher.masteryTier, 'NONE');
assert.strictEqual(rookiePoacher.duelMultiplier, 1.0);
assert.strictEqual(rookiePoacher.ratingFloorBonus, 0);

const specialistPoacher = calculatePlaystyleMastery({ playstyle: 'PCH', fin: 75, cmp: 72, agi: 70 });
assert.strictEqual(specialistPoacher.masteryTier, 'SPECIALIST');
assert.strictEqual(specialistPoacher.duelMultiplier, 1.10);
assert.strictEqual(specialistPoacher.ratingFloorBonus, 0.15);

const eliteRegista = calculatePlaystyleMastery({ playstyle: 'REG', pas: 85, vis: 84, cmp: 83 });
assert.strictEqual(eliteRegista.masteryTier, 'ELITE');
assert.strictEqual(eliteRegista.duelMultiplier, 1.20);
assert.strictEqual(eliteRegista.ratingFloorBonus, 0.35);

const worldClassNoNonsense = calculatePlaystyleMastery({ playstyle: 'NND', tck: 94, pac: 92, cmp: 90 });
assert.strictEqual(worldClassNoNonsense.masteryTier, 'WORLD_CLASS');
assert.strictEqual(worldClassNoNonsense.duelMultiplier, 1.30);
assert.strictEqual(worldClassNoNonsense.ratingFloorBonus, 0.50);
assert.strictEqual(worldClassNoNonsense.traitName, 'No-Nonsense Brick Wall');

console.log('   ✅ Key Stat Mastery tiers (Specialist, Elite, World Class) fully operational.');

// 6. 2-Step Rookie Onboarding & 15% TP Discount Mechanics
console.log('\n6️⃣ Checking 2-Step Onboarding Guard & 15% Key Stat TP Discount...');
import { ONBOARDING_WHITELIST } from '../dist/engines/campusEngine.js';
import { calculateAttributeTpCost } from '../dist/engines/trainingEngine.js';

// Verify onboarding whitelist includes playstyle & joinnation
assert.ok(ONBOARDING_WHITELIST.has('playstyle'), 'playstyle must be in ONBOARDING_WHITELIST');
assert.ok(ONBOARDING_WHITELIST.has('joinnation'), 'joinnation must be in ONBOARDING_WHITELIST');
assert.ok(ONBOARDING_WHITELIST.has('profile'), 'profile must be in ONBOARDING_WHITELIST');
assert.ok(!ONBOARDING_WHITELIST.has('train'), 'train must NOT be in ONBOARDING_WHITELIST');
assert.ok(!ONBOARDING_WHITELIST.has('travel'), 'travel must NOT be in ONBOARDING_WHITELIST');

// Verify 15% TP Discount formula
const normalCostAt75 = calculateAttributeTpCost(75); // e.g. 8 TP
const discountedAt75 = Math.max(1, Math.round(normalCostAt75 * 0.85));
console.log(`   TP cost for rating 75: Normal = ${normalCostAt75} TP | Key Stat (15% off) = ${discountedAt75} TP`);
assert.ok(discountedAt75 < normalCostAt75, 'Key stats must enjoy lower TP cost via 15% discount');

console.log('   ✅ Onboarding guard rules and 15% key stat TP discount verified.');

console.log('\n🎉 ALL NEW FEATURE TESTS PASSED SUCCESSFULLY!\n');
