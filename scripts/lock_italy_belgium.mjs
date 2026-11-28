import { prisma } from '../dist/database/prisma.js';

async function main() {
  const nations = await prisma.nationalTeam.findMany({
    select: { id: true, name: true, alias: true, isLocked: true }
  });
  console.log('All nations:', nations.map(n => `${n.name} (${n.alias}) - Locked: ${n.isLocked}`));

  const result = await prisma.nationalTeam.updateMany({
    where: { alias: { in: ['ita', 'bel'] } },
    data: { isLocked: true }
  });
  console.log(`Updated ${result.count} nations to isLocked = true.`);

  const after = await prisma.nationalTeam.findMany({
    select: { id: true, name: true, alias: true, isLocked: true }
  });
  const openNations = after.filter(n => !n.isLocked);
  const lockedNations = after.filter(n => n.isLocked);
  console.log(`Open nations (${openNations.length}):`, openNations.map(n => n.name).join(', '));
  console.log(`Locked nations (${lockedNations.length}):`, lockedNations.map(n => n.name).join(', '));

  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
