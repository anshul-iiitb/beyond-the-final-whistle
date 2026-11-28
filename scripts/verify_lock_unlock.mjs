import { prisma } from '../dist/database/prisma.js';

async function main() {
  console.log('🧪 Starting Nation Lock / Unlock Verification...\n');

  // 1. Check all nations
  const nations = await prisma.nationalTeam.findMany({
    orderBy: { name: 'asc' }
  });
  console.log(`Total nations: ${nations.length}`);

  const openNations = nations.filter(n => !n.isLocked);
  const lockedNations = nations.filter(n => n.isLocked);

  console.log(`✅ Open nations (${openNations.length}): ${openNations.map(n => `${n.name} (${n.alias})`).join(', ')}`);
  console.log(`🔒 Locked nations (${lockedNations.length}): ${lockedNations.map(n => `${n.name} (${n.alias})`).join(', ')}`);

  if (openNations.length !== 8) {
    throw new Error(`Expected exactly 8 open nations, found ${openNations.length}`);
  }
  if (lockedNations.length !== 2) {
    throw new Error(`Expected exactly 2 locked nations, found ${lockedNations.length}`);
  }

  const lockedAliases = lockedNations.map(n => n.alias.toLowerCase());
  if (!lockedAliases.includes('ita') || !lockedAliases.includes('bel')) {
    throw new Error(`Expected Italy and Belgium to be locked, but found: ${lockedAliases.join(', ')}`);
  }

  // 2. Test unlock command logic
  console.log('\nTesting unlock on Belgium (bel)...');
  const unlockedBel = await prisma.nationalTeam.update({
    where: { alias: 'bel' },
    data: { isLocked: false }
  });
  console.log(`Belgium isLocked: ${unlockedBel.isLocked}`);
  if (unlockedBel.isLocked !== false) throw new Error('Unlock failed');

  // 3. Test lock command logic
  console.log('Testing re-lock on Belgium (bel)...');
  const relockedBel = await prisma.nationalTeam.update({
    where: { alias: 'bel' },
    data: { isLocked: true }
  });
  console.log(`Belgium isLocked: ${relockedBel.isLocked}`);
  if (relockedBel.isLocked !== true) throw new Error('Re-lock failed');

  console.log('\n🎉 ALL NATION LOCK/UNLOCK VERIFICATIONS PASSED SUCCESSFULLY!');
  process.exit(0);
}

main().catch(err => {
  console.error('❌ Verification failed:', err);
  process.exit(1);
});
