import { handleSetCaptainCommand } from '../dist/commands/adminCommands.js';
import { prisma } from '../dist/database/prisma.js';

async function testSetCaptain() {
  console.log('🧪 Testing handleSetCaptainCommand...\n');

  let lastReply = '';
  const mockMessage = {
    author: { id: '478599245276905495', username: 'MasterAdmin' },
    member: { permissions: { has: () => true } },
    mentions: { users: { first: () => ({ id: '1213724764435255337', username: 'balthazarnapoleon' }) } },
    reply: async (content) => {
      lastReply = typeof content === 'string' ? content : JSON.stringify(content);
      console.log('Bot Reply:', lastReply);
      return mockMessage;
    }
  };

  // 1. Test running `-setcaptain nation por <@1213724764435255337>`
  await handleSetCaptainCommand(mockMessage, ['nation', 'por', '<@1213724764435255337>']);
  if (!lastReply.includes('Team Captain Appointed!')) {
    throw new Error('Expected successful captain appointment reply');
  }

  // 2. Verify in DB
  const por = await prisma.nationalTeam.findUnique({ where: { alias: 'por' } });
  if (por?.captainId !== '1213724764435255337') {
    throw new Error(`Expected Portugal captainId to be 1213724764435255337, got ${por?.captainId}`);
  }
  console.log('✅ DB Verified: Portugal captainId is now 1213724764435255337');

  // 3. Test running with auto-detect: `-setcaptain por <@1213724764435255337>`
  await handleSetCaptainCommand(mockMessage, ['por', '<@1213724764435255337>']);
  if (!lastReply.includes('Team Captain Appointed!')) {
    throw new Error('Expected auto-detection of nation to succeed');
  }
  console.log('✅ Auto-detect alias verified successfully');

  // 4. Test unauthorized caller
  const unauthorizedMsg = {
    ...mockMessage,
    author: { id: '999999999999999999', username: 'Rando' },
    member: { permissions: { has: () => false } }
  };
  await handleSetCaptainCommand(unauthorizedMsg, ['por', '<@1213724764435255337>']);
  if (!lastReply.includes('Unauthorized')) {
    throw new Error('Expected Unauthorized error for non-admin');
  }
  console.log('✅ Unauthorized check verified');

  console.log('\n🎉 ALL SETCAPTAIN VERIFICATIONS PASSED SUCCESSFULLY!');
  process.exit(0);
}

testSetCaptain().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
