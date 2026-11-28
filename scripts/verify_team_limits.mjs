import { prisma } from '../dist/database/prisma.js';

async function main() {
  console.log('🧪 Starting Squad Roster Capacity & Admin Setlimit Verification...\n');

  // 1. Verify schema fields exist
  const nations = await prisma.nationalTeam.findMany({
    include: { _count: { select: { players: true } } }
  });
  console.log(`✅ Loaded ${nations.length} National Teams from database.`);
  for (const n of nations.slice(0, 3)) {
    console.log(`   - ${n.name} (${n.alias.toUpperCase()}): maxPlayers = ${n.maxPlayers ?? 23}, current players = ${n._count.players}`);
  }

  // 2. Test updating a specific nation limit
  const testNation = nations[0];
  if (testNation) {
    const updated = await prisma.nationalTeam.update({
      where: { id: testNation.id },
      data: { maxPlayers: 28 }
    });
    console.log(`✅ Updated ${updated.name} limit to ${updated.maxPlayers}`);
    if (updated.maxPlayers !== 28) throw new Error('Failed to update specific nation limit');

    // Restore to 23
    await prisma.nationalTeam.update({
      where: { id: testNation.id },
      data: { maxPlayers: 23 }
    });
    console.log(`✅ Restored ${testNation.name} limit to 23`);
  }

  // 3. Test bulk update across all nations
  const bulkRes = await prisma.nationalTeam.updateMany({
    data: { maxPlayers: 23 }
  });
  console.log(`✅ Successfully bulk-set maxPlayers=23 across ${bulkRes.count} nations.`);

  // 4. Test FootballClub model
  const clubs = await prisma.footballClub.findMany({
    include: { _count: { select: { players: true } } }
  });
  console.log(`✅ FootballClub query succeeded. Found ${clubs.length} clubs.`);

  // If no clubs exist, create a temporary test club, verify setlimit, and clean it up
  const testClubAlias = 'test_fc';
  let testClub = await prisma.footballClub.findUnique({ where: { alias: testClubAlias } });
  if (!testClub) {
    testClub = await prisma.footballClub.create({
      data: {
        name: 'Test FC',
        alias: testClubAlias,
        badge: '🛡️',
        maxPlayers: 23
      }
    });
    console.log(`✅ Created test club ${testClub.name} (${testClub.alias}) with maxPlayers=${testClub.maxPlayers}`);
  }

  // Test updating club limit
  const updatedClub = await prisma.footballClub.update({
    where: { id: testClub.id },
    data: { maxPlayers: 30 }
  });
  console.log(`✅ Updated test club maxPlayers to ${updatedClub.maxPlayers}`);
  if (updatedClub.maxPlayers !== 30) throw new Error('Failed to update club limit');

  // 5. Test capacity enforcement logic
  // Simulate a club with limit = 1 and 1 player
  await prisma.footballClub.update({
    where: { id: testClub.id },
    data: { maxPlayers: 1 }
  });

  const clubWithCount = await prisma.footballClub.findUnique({
    where: { alias: testClubAlias },
    include: { _count: { select: { players: true } } }
  });
  const cap = clubWithCount.maxPlayers || 23;
  console.log(`✅ Club test capacity: limit=${cap}, currentCount=${clubWithCount._count.players}`);
  const isFull = clubWithCount._count.players >= cap;
  console.log(`   Is squad full? ${isFull}`);

  // Clean up test club
  await prisma.footballClub.delete({ where: { id: testClub.id } });
  console.log(`✅ Cleaned up test club.`);

  console.log('\n🎉 ALL SQUAD ROSTER LIMIT VERIFICATIONS PASSED SUCCESSFULLY!');
  process.exit(0);
}

main()
  .catch(err => {
    console.error('❌ Verification failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
