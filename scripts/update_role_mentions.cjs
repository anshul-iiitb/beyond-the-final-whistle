const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const dotenv = require('dotenv');
dotenv.config();

const token = process.env.LEAGUE_MASTER_TOKEN || process.env.DISCORD_TOKEN;
const GUILD_ID = '1574068651915743272';

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildExpressions,
  ]
});

client.once('clientReady', async () => {
  const g = client.guilds.cache.get(GUILD_ID);
  if (!g) process.exit(1);

  const tpEmoji = g.emojis.cache.find(e => e.name === 'tp')?.toString() || '🤹‍♂️';
  const stamEmoji = g.emojis.cache.find(e => e.name === 'stamina')?.toString() || '⚡';
  const motmEmoji = g.emojis.cache.find(e => e.name === 'motm')?.toString() || '👑';
  const coinEmoji = g.emojis.cache.find(e => e.name === 'coin')?.toString() || '🪙';
  const fansEmoji = g.emojis.cache.find(e => e.name === 'followers')?.toString() || '👤';

  // 1. UPDATE #what-is-vip
  const vipChannel = g.channels.cache.find(c => c.name.includes('what-is-vip'));
  if (vipChannel && vipChannel.isTextBased()) {
    const msgs = await vipChannel.messages.fetch({ limit: 10 });
    for (const m of msgs.values()) {
      await m.delete().catch(() => {});
    }

    const vipEmbed = new EmbedBuilder()
      .setColor('#fbbf24')
      .setTitle('👑 VIP Status — Benefits, Boosts & Referrals')
      .setDescription(
        'VIP status elevates your football career with enhanced training options and accelerated development.\n\n' +
        '**✨ VIP Perks:**\n' +
        `• **VIP Training:** Run \`-train\` and select VIP mode for **+6 Training Points ${tpEmoji}** (6h cooldown).\n` +
        `• **No Effort Training:** Instant **+20 TP ${tpEmoji}** once per day!\n` +
        `• **Sauna Full Recharge:** \`-recovery\` restores **100% full stamina ${stamEmoji}** up to max cap!\n` +
        '• **Exclusive Role:** Golden <@&1574438929975869532> hoisted role.\n\n' +
        '**🎟️ How to Acquire VIP:**\n' +
        '1. **Server Boost:** Boost our Discord server for instant VIP duration.\n' +
        '2. **Player Referral:** Invite friends using `-referral @you` once they earn 50 TP.\n' +
        `3. **Staff Rewards:** Earn VIP through tournaments, MOTM awards ${motmEmoji}, or community events.`
      )
      .setFooter({ text: 'Beyond The Final Whistle • VIP Club' });

    await vipChannel.send({ embeds: [vipEmbed] });
    console.log('✓ Successfully updated #what-is-vip with clickable <@&1574438929975869532>!');
  }

  // 2. UPDATE #roles
  const rolesChannel = g.channels.cache.find(c => c.name.includes('roles'));
  if (rolesChannel && rolesChannel.isTextBased()) {
    const msgs = await rolesChannel.messages.fetch({ limit: 10 });
    for (const m of msgs.values()) {
      await m.delete().catch(() => {});
    }

    const rolesEmbed = new EmbedBuilder()
      .setColor('#38bdf8')
      .setTitle('🎭 National Team Selection & Notification Roles')
      .setDescription(
        `Welcome to the International Federation! Choose your national team to unlock your private team room, and claim your signing bonus.\n\n` +
        `🌍 **Join a National Team:**\n` +
        'Run `-joinnation <alias>` in this channel or `#bot-cmds`:\n\n' +
        `• <@&1574438940025561119> — \`-joinnation ned\`\n` +
        `• <@&1574438943544311968> — \`-joinnation ger\`\n` +
        `• <@&1574438947315126512> — \`-joinnation por\`\n` +
        `• <@&1574438950674890934> — \`-joinnation esp\`\n` +
        `• <@&1574438954881781870> — \`-joinnation fra\`\n` +
        `• <@&1574438958455070761> — \`-joinnation eng\`\n` +
        `• <@&1574438961806581780> — \`-joinnation bra\`\n` +
        `• <@&1574438966147547309> — \`-joinnation arg\`\n\n` +
        `*Joining a nation automatically assigns your nation's role, unlocks your locker room, and awards a **100k ${coinEmoji} + 100k ${fansEmoji}** signing bonus!*`
      )
      .setFooter({ text: 'Beyond The Final Whistle • International Registration' });

    await rolesChannel.send({ embeds: [rolesEmbed] });
    console.log('✓ Successfully updated #roles with clickable nation role pills!');
  }

  process.exit(0);
});

client.login(token);
