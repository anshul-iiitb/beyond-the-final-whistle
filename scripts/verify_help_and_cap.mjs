import { buildHelpMenuPayload, TOTAL_HELP_PAGES } from '../dist/commands/helpCommand.js';

async function main() {
  console.log('🧪 Starting Paginated Help Menu & Team Roles Verification...\n');

  // 1. Verify TOTAL_HELP_PAGES
  console.log(`Total Help Pages: ${TOTAL_HELP_PAGES}`);
  if (TOTAL_HELP_PAGES !== 6) throw new Error(`Expected 6 help pages, got ${TOTAL_HELP_PAGES}`);

  // 2. Test each page generation
  for (let p = 1; p <= TOTAL_HELP_PAGES; p++) {
    const payload = buildHelpMenuPayload(p);
    console.log(`✅ Page ${p} generated: "${payload.embed.data.title}"`);
    if (!payload.embed.data.title) throw new Error(`Page ${p} missing title`);
    if (!payload.components || payload.components.length === 0) throw new Error(`Page ${p} missing components`);

    const buttons = payload.components[0].components;
    console.log(`   - Components: ${buttons.length} buttons (${buttons[0].data.label}, ${buttons[1].data.label}, ${buttons[2].data.label})`);

    // Verify button disabled states
    if (p === 1 && !buttons[0].data.disabled) throw new Error('Page 1 Prev button should be disabled');
    if (p === TOTAL_HELP_PAGES && !buttons[2].data.disabled) throw new Error(`Page ${TOTAL_HELP_PAGES} Next button should be disabled`);
    if (p > 1 && p < TOTAL_HELP_PAGES) {
      if (buttons[0].data.disabled || buttons[2].data.disabled) throw new Error(`Page ${p} Prev and Next buttons should both be enabled`);
    }
  }

  // 3. Test bounding logic (page 0 -> 1, page 99 -> 6)
  const minBound = buildHelpMenuPayload(0);
  if (minBound.embed.data.title !== buildHelpMenuPayload(1).embed.data.title) {
    throw new Error('Page 0 should clamp to Page 1');
  }
  const maxBound = buildHelpMenuPayload(99);
  if (maxBound.embed.data.title !== buildHelpMenuPayload(6).embed.data.title) {
    throw new Error('Page 99 should clamp to Page 6');
  }
  console.log('✅ Clamping tests passed (0 clamped to 1, 99 clamped to 6).');

  console.log('\n🎉 ALL PAGINATED HELP & ROLES VERIFICATIONS PASSED SUCCESSFULLY!');
  process.exit(0);
}

main().catch(err => {
  console.error('❌ Verification failed:', err);
  process.exit(1);
});
