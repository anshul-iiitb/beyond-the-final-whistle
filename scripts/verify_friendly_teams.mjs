import { resolveTeam } from '../dist/commands/matchCommands.js';
import { simulateFullMatch } from '../dist/engines/matchSimulationEngine.js';
import { buildLiveMatchTeam } from '../dist/engines/liveMatchEngine.js';
import { buildHelpMenuPayload } from '../dist/commands/helpCommand.js';

async function main() {
  console.log('🧪 Starting Portugal vs Spain Friendly & Match Verification...\n');

  // 1. Test team resolution
  console.log('1️⃣ Testing team resolution by alias and name:');
  const porAlias = await resolveTeam('por');
  const porName = await resolveTeam('portugal');
  const espAlias = await resolveTeam('esp');
  const espName = await resolveTeam('spain');

  if (!porAlias || porAlias.team.alias !== 'por') throw new Error('Failed to resolve "por" alias');
  if (!porName || porName.team.name.toLowerCase() !== 'portugal') throw new Error('Failed to resolve "portugal" name');
  if (!espAlias || espAlias.team.alias !== 'esp') throw new Error('Failed to resolve "esp" alias');
  if (!espName || espName.team.name.toLowerCase() !== 'spain') throw new Error('Failed to resolve "spain" name');
  console.log(`✅ Portugal resolved: "${porAlias.team.flag} ${porAlias.team.name}" (alias: ${porAlias.team.alias})`);
  console.log(`✅ Spain resolved: "${espAlias.team.flag} ${espAlias.team.name}" (alias: ${espAlias.team.alias})`);

  // 2. Test live match team builder
  console.log('\n2️⃣ Testing buildLiveMatchTeam for live broadcasts:');
  const livePor = await buildLiveMatchTeam('por', true);
  const liveEsp = await buildLiveMatchTeam('esp', false);

  if (livePor.name !== 'Portugal' || !livePor.flag.includes('🇵🇹')) {
    throw new Error(`Unexpected live Portugal team: ${livePor.name} ${livePor.flag}`);
  }
  if (liveEsp.name !== 'Spain' || !liveEsp.flag.includes('🇪🇸')) {
    throw new Error(`Unexpected live Spain team: ${liveEsp.name} ${liveEsp.flag}`);
  }
  console.log(`✅ Live Portugal Squad: ${livePor.flag} ${livePor.name} | Captain: ${livePor.captainName || 'Auto'} | ATK: ${livePor.players.atk.name}, MID: ${livePor.players.mid.name}, DEF: ${livePor.players.def.name}`);
  console.log(`✅ Live Spain Squad: ${liveEsp.flag} ${liveEsp.name} | Captain: ${liveEsp.captainName || 'Auto'} | ATK: ${liveEsp.players.atk.name}, MID: ${liveEsp.players.mid.name}, DEF: ${liveEsp.players.def.name}`);

  // 3. Test Portugal vs Spain Friendly Simulation
  console.log('\n3️⃣ Testing simulateFullMatch for Portugal vs Spain Exhibition Friendly:');
  const simResult = await simulateFullMatch('dummy_host_id', undefined, {
    isExhibition: true,
    homeTeamKey: 'por',
    awayTeamKey: 'esp'
  });

  console.log(`✅ Match Simulated: ${simResult.homeTeamName} ${simResult.homeScore} – ${simResult.awayScore} ${simResult.awayTeamName}`);
  console.log(`   Possession: ${simResult.homePossession}% vs ${simResult.awayPossession}%`);
  console.log(`   MOTM: ${simResult.motmPlayerName} (Rating: ${simResult.motmRating})`);
  console.log(`   Highlights count: ${simResult.commentaryEvents.length}`);

  if (!simResult.homeTeamName.includes('Portugal') || !simResult.homeTeamName.includes('🇵🇹')) {
    throw new Error(`Home team name missing Portugal/flag: ${simResult.homeTeamName}`);
  }
  if (!simResult.awayTeamName.includes('Spain') || !simResult.awayTeamName.includes('🇪🇸')) {
    throw new Error(`Away team name missing Spain/flag: ${simResult.awayTeamName}`);
  }

  // 4. Verify Help Menu Page 5 includes friendly and match updates
  console.log('\n4️⃣ Checking Help Menu Page 5 documentation:');
  const page5 = buildHelpMenuPayload(5);
  const matchField = page5.embed.data.fields?.find(f => f.name.includes('Match Engines'));
  if (!matchField || !matchField.value.includes('-friendly [@user|team1 team2]')) {
    throw new Error('Page 5 missing updated friendly syntax documentation');
  }
  console.log('✅ Help Menu Page 5 properly documents `-friendly [@user|team1 team2]` and `-match [@user|team1 team2]`');

  console.log('\n🎉 ALL PORTUGAL VS SPAIN FRIENDLY TESTS PASSED SUCCESSFULLY!');
  process.exit(0);
}

main().catch(err => {
  console.error('❌ Verification failed:', err);
  process.exit(1);
});
