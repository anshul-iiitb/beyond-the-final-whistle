const { 
  Client, 
  GatewayIntentBits, 
  ChannelType, 
  PermissionFlagsBits, 
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} = require('discord.js');

const fs = require('fs');
const dotenv = require('dotenv');
dotenv.config();

const token = process.env.LEAGUE_MASTER_TOKEN || process.env.DISCORD_TOKEN;
const GUILD_ID = '1574068651915743272';

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
  ]
});

// Custom application emojis
const EMOJIS = {
  coin: '<:coin:1574133021601177641>',
  stamina: '<:stamina:1574133087745609899>',
  tp: '<:tp:1574133098361393293>',
  followers: '<:followers:1574133027313946634>',
  worldcup: '<:worldcup:1574136906508271828>',
  strika: '<:strika:1574133093193744474>',
  passa: '<:passa:1574133072150921327>',
  bully: '<:bully:1574133090869643434>',
  sd: '<:sd:1574133077008187564>',
  hcfront: '<:hcfront:1574145982218637443>',
  hcback: '<:hcback:1574145991353966643>',
  tsfront: '<:tsfront:1574146000724033697>',
  tsback: '<:tsback:1574146010345775265>',
  p911front: '<:p911front:1574146019740885033>',
  p911back: '<:p911back:1574146028884463857>',
  ngtrfront: '<:ngtrfront:1574146038296617141>',
  ngtrback: '<:ngtrback:1574146047499047014>',
  ar8front: '<:ar8front:1574146057233760256>',
  ar8back: '<:ar8back:1574146066180345996>',
  lhfront: '<:lhfront:1574146075101499583>',
  lhback: '<:lhback:1574146085767876669>',
  rrgfront: '<:rrgfront:1574146094797955122>',
  rrgback: '<:rrgback:1574146104113496237>',
  ffront: '<:ffront:1574146113232179303>',
  fback: '<:fback:1574146122472095798>',
  bcfront: '<:bcfront:1574146131578060930>',
  bcback: '<:bcback:1574146142613012530>'
};

// Helper sleep function to respect rate limits
const sleep = (ms) => new Promise(res => setTimeout(res, ms));

client.once('clientReady', async () => {
  console.log(`🤖 Logged in as ${client.user.tag}`);
  const guild = client.guilds.cache.get(GUILD_ID);
  if (!guild) {
    console.error('❌ Guild not found!');
    process.exit(1);
  }

  console.log(`🏰 Target Server: "${guild.name}" (${guild.id})`);

  // ==========================================
  // PHASE 1: CREATE ROLES HIERARCHY
  // ==========================================
  console.log('\n--- 1. SETTING UP ROLES HIERARCHY ---');
  const roleDefs = [
    // Staff & Authority
    { name: '👑 Founder & Executive', color: '#f59e0b', hoist: true, mentionable: true },
    { name: '🛡️ Head Administrator', color: '#ef4444', hoist: true, mentionable: true },
    { name: '⚔️ Match Moderator', color: '#3b82f6', hoist: true, mentionable: true },
    
    // Trophies & Prestige
    { name: '🏆 World Champion', color: '#ffd700', hoist: true, mentionable: false },
    { name: '⭐ Ballon d\'Or Winner', color: '#fef08a', hoist: true, mentionable: false },
    { name: '💎 Premium Footballer', color: '#c084fc', hoist: true, mentionable: false },
    { name: '👑 VIP Footballer', color: '#fbbf24', hoist: true, mentionable: false },
    { name: '👟 Pro Footballer', color: '#10b981', hoist: true, mentionable: false },
    { name: '⚽ Rookie Footballer', color: '#94a3b8', hoist: true, mentionable: false },

    // National Teams (Role Gates)
    { name: '🇳🇱 Netherlands', color: '#f97316', hoist: false, mentionable: false },
    { name: '🇩🇪 Germany', color: '#eab308', hoist: false, mentionable: false },
    { name: '🇵🇹 Portugal', color: '#dc2626', hoist: false, mentionable: false },
    { name: '🇪🇸 Spain', color: '#ea580c', hoist: false, mentionable: false },
    { name: '🇫🇷 France', color: '#2563eb', hoist: false, mentionable: false },
    { name: '🏴󠁧󠁢󠁥󠁮󠁧󠁿 England', color: '#f43f5e', hoist: false, mentionable: false },
    { name: '🇧🇷 Brazil', color: '#16a34a', hoist: false, mentionable: false },
    { name: '🇦🇷 Argentina', color: '#0284c7', hoist: false, mentionable: false },
    { name: '🇮🇹 Italy', color: '#0ea5e9', hoist: false, mentionable: false },
    { name: '🇧🇪 Belgium', color: '#b91c1c', hoist: false, mentionable: false },

    // Notifications Pings
    { name: '📢 Announcements Ping', color: '#64748b', hoist: false, mentionable: true },
    { name: '⚽ Match Ping', color: '#64748b', hoist: false, mentionable: true },
    { name: '📰 News Ping', color: '#64748b', hoist: false, mentionable: true },
    { name: '🎁 Giveaways Ping', color: '#64748b', hoist: false, mentionable: true },
  ];

  const createdRoles = {};
  const existingRoles = await guild.roles.fetch();

  for (const def of roleDefs) {
    let role = existingRoles.find(r => r.name.toLowerCase() === def.name.toLowerCase());
    if (!role) {
      try {
        role = await guild.roles.create({
          name: def.name,
          color: def.color,
          hoist: def.hoist,
          mentionable: def.mentionable,
          reason: 'Beyond The Final Whistle WITS Server Hierarchy Setup'
        });
        console.log(`  + Created role: "${role.name}"`);
        await sleep(350);
      } catch (err) {
        console.error(`  x Failed to create role "${def.name}":`, err.message);
      }
    } else {
      console.log(`  = Role exists: "${role.name}"`);
    }
    if (role) {
      createdRoles[def.name] = role;
    }
  }

  // ==========================================
  // PHASE 2: CLEAN UP OLD DEFAULT CHANNELS
  // ==========================================
  console.log('\n--- 2. CLEANING UP INITIAL CHANNELS ---');
  const currentChannels = await guild.channels.fetch();
  for (const [id, ch] of currentChannels) {
    if (!ch) continue;
    // Delete old default categories/channels if they match initial generic setup
    if (
      ch.name === 'Text Channels' || 
      ch.name === 'Voice Channels' || 
      ch.name === 'clips-and-highlights' ||
      (ch.name === 'general' && !ch.name.includes('๑'))
    ) {
      try {
        await ch.delete('Cleaning default channels for WITS structure');
        console.log(`  - Deleted initial channel: "${ch.name}"`);
        await sleep(300);
      } catch (err) {
        console.log(`  x Could not delete "${ch.name}":`, err.message);
      }
    }
  }

  // ==========================================
  // PHASE 3: CATEGORIES & CHANNELS ARCHITECTURE
  // ==========================================
  console.log('\n--- 3. CONSTRUCTING WITS CATEGORIES & CHANNELS ---');

  const staffRoleIds = [
    createdRoles['👑 Founder & Executive']?.id,
    createdRoles['🛡️ Head Administrator']?.id,
    createdRoles['⚔️ Match Moderator']?.id,
  ].filter(Boolean);

  const categoriesConfig = [
    {
      category: '*- 𝓔𝓼 Server Gate ໒꒱ -*',
      channels: [
        { name: '๑•\'🚪│welcome-and-leave', type: ChannelType.GuildText, readOnly: true, topic: 'Welcome to Beyond The Final Whistle! Player arrivals and departures.' }
      ]
    },
    {
      category: '*- 𝓔𝓼 Official ໒꒱ -*',
      channels: [
        { name: '๑•\'ℹ️│information', type: ChannelType.GuildText, readOnly: true, topic: 'Beyond The Final Whistle overview, official bot links, and server directory.' },
        { name: '๑•\'📜│rules', type: ChannelType.GuildText, readOnly: true, topic: 'Official server and fair play gameplay guidelines.' },
        { name: '๑•\'📢│announcements', type: ChannelType.GuildText, readOnly: true, topic: 'Official game announcements and server news.' },
        { name: '๑•\'📚│documentation', type: ChannelType.GuildText, readOnly: true, topic: 'Full WITS game mechanics, formulas, attributes, and gameplay systems.' },
        { name: '๑•\'🔰│beginner-guide', type: ChannelType.GuildText, readOnly: true, topic: 'Step-by-step onboarding walkthrough for rookie footballers.' },
        { name: '๑•\'👑│what-is-vip', type: ChannelType.GuildText, readOnly: true, topic: 'VIP benefits, boost perks, referrals, and exclusive commands.' },
        { name: '๑•\'🎭│roles', type: ChannelType.GuildText, readOnly: true, topic: 'Self-assignable roles, ping notifications, and nation selection.' },
        { name: '๑•\'🟢│bot-status', type: ChannelType.GuildText, readOnly: true, topic: 'Live bot telemetry, update patch notes, and latency status.' },
        { name: '๑•\'🤝│partners', type: ChannelType.GuildText, readOnly: true, topic: 'Official affiliate leagues and football sim partnerships.' }
      ]
    },
    {
      category: '*- 𝓔𝓼 Main ໒꒱ -*',
      channels: [
        { name: '๑•\'💬│general', type: ChannelType.GuildText, readOnly: false, topic: 'General community lounge, football banter, and chat.' },
        { name: '๑•\'🤖│bot-cmds', type: ChannelType.GuildText, readOnly: false, topic: 'Use general bot commands here: -profile, -lb, -give, -setdesc.' },
        { name: '๑•\'📷│media', type: ChannelType.GuildText, readOnly: false, topic: 'Showcase player cards, vehicles, trophies, and match clips.' },
        { name: '๑•\'💡│suggestions', type: ChannelType.GuildText, readOnly: false, topic: 'Post your ideas, improvements, and bot feedback.' },
        { name: '๑•\'🐦│twitter', type: ChannelType.GuildText, readOnly: false, topic: 'In-game TwitFeed! Use -tweet <text> to earn or lose followers with 👍/👎.' },
        { name: '๑•\'🔒│admin-only', type: ChannelType.GuildText, adminOnly: true, topic: 'Staff bot control panel: -vip, -additem, -addvar, -gitpull.' }
      ]
    },
    {
      category: '*- 𝓔𝓼 Transfers ໒꒱ -*',
      channels: [
        { name: '๑•\'📜│transfer-rules', type: ChannelType.GuildText, readOnly: true, topic: 'Official transfer window regulations, release clauses, and club contracts.' },
        { name: '๑•\'🔨│the-mega-auction', type: ChannelType.GuildText, readOnly: false, topic: 'Live player auctions and captain bidding wars.' },
        { name: '๑•\'🔄│transfer-market', type: ChannelType.GuildText, readOnly: false, topic: 'Club recruitment, free agent signings, and contract negotiations.' }
      ]
    },
    {
      category: '*- 𝓔𝓼 Match Zone ໒꒱ -* ',
      channels: [
        { name: '๑•\'⏱️│timeline', type: ChannelType.GuildText, readOnly: true, topic: 'Matchday fixtures, kickoff times, and competition schedule.' },
        { name: '๑•\'🏆│competitions', type: ChannelType.GuildText, readOnly: true, topic: 'Active tournaments, domestic leagues, and cup ladders.' },
        { name: '๑•\'⚽│live-match', type: ChannelType.GuildText, readOnly: false, topic: 'Simulated 90-minute live matches! Run -match [@user] for commentary.' },
        { name: '๑•\'📰│btfw-news', type: ChannelType.GuildText, readOnly: true, topic: 'Matchday newspapers, Man of the Match awards, and transfer headlines.' },
        { name: '๑•\'📺│sports-tv', type: ChannelType.GuildText, readOnly: true, topic: 'Broadcast studio match recaps and goal highlights.' },
        { name: '๑•\'🎙️│press-room', type: ChannelType.GuildText, readOnly: false, topic: 'Post-match press conferences and captain interviews.' },
        { name: '๑•\'🎖️│award-ceremony', type: ChannelType.GuildText, readOnly: true, topic: 'Ballon d\'Or gala, Golden Boot presentations, and team trophies.' },
        { name: '๑•\'🔴│live-stream', type: ChannelType.GuildText, readOnly: false, topic: 'Community match watch parties and special live events.' }
      ]
    },
    {
      category: '*- 𝓔𝓼 Football Manager Game ໒꒱ -*',
      channels: [
        { name: '๑•\'🏕️│fmworld', type: ChannelType.GuildText, readOnly: false, topic: 'Club tactics, starting lineups, formations, and set-piece taker setup.' },
        { name: '๑•\'💬│chat', type: ChannelType.GuildText, readOnly: false, topic: 'Tactical discussion, manager discussions, and match strategies.' }
      ]
    },
    {
      category: '*- 𝓔𝓼 World Cup ໒꒱ -*',
      channels: [
        { name: '๑•\'❗│updates', type: ChannelType.GuildText, readOnly: true, topic: 'World Cup draw, knockout brackets, and tournament updates.' },
        { name: '๑•\'📅│schedule', type: ChannelType.GuildText, readOnly: true, topic: 'World Cup fixture timetable and match slots.' },
        { name: '๑•\'📈│stats', type: ChannelType.GuildText, readOnly: true, topic: 'Tournament top scorers, assist leaders, and clean sheets.' },
        { name: '๑•\'🏆│results', type: ChannelType.GuildText, readOnly: true, topic: 'World Cup match scores, box scores, and MOTM awards.' },
        { name: '๑•\'📊│points-table', type: ChannelType.GuildText, readOnly: true, topic: 'Group stage tables, points, goal difference, and qualification.' },
        { name: '๑•\'⭐│history', type: ChannelType.GuildText, readOnly: true, topic: 'World Cup archive, all-time champion rosters, and records.' }
      ]
    },
    {
      category: '*- 𝓔𝓼 Locations ໒꒱ -*',
      channels: [
        { name: '๑•\'🏋️│training-center', type: ChannelType.GuildText, readOnly: false, topic: 'Use -train to earn Training Points (TP) and develop your attributes!' },
        { name: '๑•\'🛍️│global-market', type: ChannelType.GuildText, readOnly: false, topic: 'Use -buy <alias> for Sports Drinks (sd), Strika, Passa, and Bully boots.' },
        { name: '๑•\'🏎️│vehicle-showroom', type: ChannelType.GuildText, readOnly: false, topic: 'Use -showroom and -vehiclebuy <alias> to purchase exotic cars!' },
        { name: '๑•\'📸│photoshoot-hall', type: ChannelType.GuildText, readOnly: false, topic: 'Use -advert to sign commercial deals (Heineken, Adidas, Netflix).' },
        { name: '๑•\'🔬│research-facility', type: ChannelType.GuildText, readOnly: false, topic: 'Use -sptrain <attr> to upgrade attributes or -convert for playstyle.' },
        { name: '๑•\'🧖│player-sauna', type: ChannelType.GuildText, readOnly: false, topic: 'Use -recovery to restore stamina (+30 standard, +100 VIP).' },
        { name: '๑•\'🕵️│intel-hub', type: ChannelType.GuildText, readOnly: false, topic: 'Use -intel to scout opposition and get +1 to +6 matchday stat bonus.' },
        { name: '๑•\'⚽│local-club', type: ChannelType.GuildText, readOnly: false, topic: 'Use -coaching (+50k coins) or -meetgreet (+50k followers).' }
      ]
    },
    {
      category: '*- 𝓔𝓼 Nations ໒꒱ -*',
      channels: [
        { name: '๑•\'🇳🇱│netherlands', type: ChannelType.GuildText, nationRole: '🇳🇱 Netherlands', topic: 'Netherlands National Team private locker room.' },
        { name: '๑•\'🇩🇪│germany', type: ChannelType.GuildText, nationRole: '🇩🇪 Germany', topic: 'Germany National Team private locker room.' },
        { name: '๑•\'🇵🇹│portugal', type: ChannelType.GuildText, nationRole: '🇵🇹 Portugal', topic: 'Portugal National Team private locker room.' },
        { name: '๑•\'🇪🇸│spain', type: ChannelType.GuildText, nationRole: '🇪🇸 Spain', topic: 'Spain National Team private locker room.' },
        { name: '๑•\'🇫🇷│france', type: ChannelType.GuildText, nationRole: '🇫🇷 France', topic: 'France National Team private locker room.' },
        { name: '๑•\'🏴󠁧󠁢󠁥󠁮󠁧󠁿│england', type: ChannelType.GuildText, nationRole: '🏴󠁧󠁢󠁥󠁮󠁧󠁿 England', topic: 'England National Team private locker room.' },
        { name: '๑•\'🇧🇷│brazil', type: ChannelType.GuildText, nationRole: '🇧🇷 Brazil', topic: 'Brazil National Team private locker room.' },
        { name: '๑•\'🇦🇷│argentina', type: ChannelType.GuildText, nationRole: '🇦🇷 Argentina', topic: 'Argentina National Team private locker room.' }
      ]
    },
    {
      category: '*- 𝓔𝓼 Random Bots ໒꒱ -*',
      channels: [
        { name: '๑•\'👾│ballsdex', type: ChannelType.GuildText, readOnly: false, topic: 'BallsDex card collection and mini-game bot command area.' }
      ]
    },
    {
      category: '*- 𝓔𝓼 Voice Lounge ໒꒱ -*',
      channels: [
        { name: '🔊 Lobby', type: ChannelType.GuildVoice, topic: 'Casual voice lounge' },
        { name: '🎮 Gaming Lounge', type: ChannelType.GuildVoice, topic: 'Gaming voice room' },
        { name: '🏟️ Match Watch Party', type: ChannelType.GuildVoice, topic: 'Live match streaming voice channel' },
        { name: '🎙️ Press Conference VC', type: ChannelType.GuildVoice, topic: 'Post-match voice interviews' }
      ]
    }
  ];

  const createdChannelsMap = {};

  for (const catConf of categoriesConfig) {
    // Check if category already exists
    let cat = guild.channels.cache.find(c => c.type === ChannelType.GuildCategory && c.name === catConf.category);
    if (!cat) {
      cat = await guild.channels.create({
        name: catConf.category,
        type: ChannelType.GuildCategory,
        reason: 'WITS Category Setup'
      });
      console.log(`\n📁 Created Category: "${cat.name}"`);
      await sleep(350);
    } else {
      console.log(`\n📁 Category exists: "${cat.name}"`);
    }

    for (const chConf of catConf.channels) {
      let ch = guild.channels.cache.find(c => c.parentId === cat.id && c.name === chConf.name);
      if (!ch) {
        // Construct permission overwrites
        const overwrites = [
          {
            id: guild.roles.everyone.id,
            allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory],
            deny: []
          }
        ];

        // Read-only info channels: @everyone cannot send messages
        if (chConf.readOnly) {
          overwrites[0].deny.push(PermissionFlagsBits.SendMessages);
        }

        // Admin-only channel: hide from @everyone, allow staff
        if (chConf.adminOnly) {
          overwrites[0].deny.push(PermissionFlagsBits.ViewChannel);
          for (const sId of staffRoleIds) {
            overwrites.push({
              id: sId,
              allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory]
            });
          }
        }

        // Role-gated nation channels: hide from @everyone, allow specific nation role + staff
        if (chConf.nationRole && createdRoles[chConf.nationRole]) {
          overwrites[0].deny.push(PermissionFlagsBits.ViewChannel);
          overwrites.push({
            id: createdRoles[chConf.nationRole].id,
            allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory]
          });
          for (const sId of staffRoleIds) {
            overwrites.push({
              id: sId,
              allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory]
            });
          }
        }

        // Always allow League Master and BTFW bot roles full permissions
        const botRole = guild.roles.cache.find(r => r.name.toLowerCase().includes('whistle') || r.name.toLowerCase().includes('league'));
        if (botRole) {
          overwrites.push({
            id: botRole.id,
            allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks, PermissionFlagsBits.AttachFiles]
          });
        }

        try {
          ch = await guild.channels.create({
            name: chConf.name,
            type: chConf.type,
            parent: cat.id,
            topic: chConf.topic,
            permissionOverwrites: overwrites,
            reason: 'WITS Channel Setup'
          });
          console.log(`  # Created Channel: "${ch.name}"`);
          await sleep(350);
        } catch (err) {
          console.error(`  x Failed to create channel "${chConf.name}":`, err.message);
        }
      } else {
        console.log(`  = Channel exists: "${ch.name}"`);
      }

      if (ch) {
        createdChannelsMap[chConf.name] = ch;
      }
    }
  }

  // ==========================================
  // PHASE 4: POPULATE RICH INFORMATION EMBEDS
  // ==========================================
  console.log('\n--- 4. POSTING RICH INFORMATION EMBEDS ---');

  // 1. RULES EMBED
  const rulesChannel = createdChannelsMap['๑•\'📜│rules'];
  if (rulesChannel && rulesChannel.isTextBased()) {
    const rulesEmbed = new EmbedBuilder()
      .setColor('#3b82f6')
      .setTitle('📜 Beyond The Final Whistle — Official Server & Fair Play Rules')
      .setDescription(
        `Welcome to the premier multiplayer football simulation server! To maintain an engaging, fair, and immersive experience for all players, managers, and clubs, please adhere to these core regulations.\n\n` +
        `Violation of these rules will result in warnings, stat penalties, transfer bans, or server expulsion.`
      )
      .addFields(
        {
          name: '1️⃣ Respect & Sportsmanship',
          value: '• Harassment, hate speech, toxicity, and excessive targeted griefing will not be tolerated.\n• Respect all captains, referees, match officials, and server administrators.'
        },
        {
          name: '2️⃣ Fair Play & Anti-Exploit Policy',
          value: '• Alt accounts, macro scripts, auto-clickers, and automated botting are strictly prohibited.\n• Any bug or economic loop discovered must be immediately reported in `#suggestions` or to staff.\n• Abusing exploits will result in a complete stat reset and permanent blacklist.'
        },
        {
          name: '3️⃣ Channel Discipline & Command Etiquette',
          value: '• Keep bot commands (`-profile`, `-train`, `-buy`, `-advert`) inside their designated campus facilities or `#bot-cmds`.\n• Do not spam commands in `#general` or match broadcast channels.'
        },
        {
          name: '4️⃣ Match & Transfer Integrity',
          value: '• Match-fixing, intentional bench throwing, or collusive match feeding is strictly penalized.\n• Club captains must honor signed contracts and pay agreed team bonuses via `-teampay`.'
        },
        {
          name: '5️⃣ Discord Terms of Service',
          value: '• All members must adhere to Discord\'s official Terms of Service and Community Guidelines.'
        }
      )
      .setFooter({ text: 'Beyond The Final Whistle • Fair Play Committee' })
      .setTimestamp();

    await rulesChannel.send({ embeds: [rulesEmbed] });
    console.log('  ✓ Sent embed to #rules');
    await sleep(400);
  }

  // 2. DOCUMENTATION EMBED
  const docChannel = createdChannelsMap['๑•\'📚│documentation'];
  if (docChannel && docChannel.isTextBased()) {
    const docEmbed1 = new EmbedBuilder()
      .setColor('#10b981')
      .setTitle('📚 BTFW Player Handbook — Part 1: Career Starting Stats & Attributes')
      .setDescription(
        `**Beyond The Final Whistle (BTFW)** is a deep tactical football career simulation MMORPG.\n` +
        `You create and develop your player from rookie status to world champion.\n\n` +
        `**🌟 Rookie Starting Stats:**\n` +
        `• **Attack:** 50\n` +
        `• **Midfield:** 50\n` +
        `• **Defence:** 50\n` +
        `• **Stamina:** 100 / 100\n` +
        `• **Money:** 0 🪙\n` +
        `• **Followers:** 0 👤\n` +
        `• **Training Points:** 0 🤹‍♂️\n\n` +
        `🎁 **Welcome Bonus:** Joining a National Team gives you an instant **100k 🪙 + 100k 👤** signing bonus!`
      )
      .addFields(
        {
          name: '🎯 15 Player Attributes',
          value:
            '• **Attacking:** `FIN` (Finishing), `POW` (Shot Power), `HEA` (Heading)\n' +
            '• **Technical:** `PAS` (Passing), `VIS` (Vision), `CRO` (Crossing), `DRI` (Dribbling)\n' +
            '• **Defending:** `TCK` (Tackling), `INT` (Interceptions), `MRK` (Marking)\n' +
            '• **Physical & Mental:** `PAC` (Pace), `PHY` (Physicality), `CMP` (Composure), `AGI` (Agility), `WRK` (Work Rate)'
        },
        {
          name: '⚽ Tactical Playstyles',
          value:
            '• **Attacker:** 🎯 *Poacher* (Box predator), ⚡ *Speedster* (Counter runner), 🦘 *Target Man* (Aerial anchor)\n' +
            '• **Midfielder:** 🪄 *Playmaker* (Vision & passing), 🔋 *Box-to-Box* (Work rate engine), 🛡️ *Anchor* (Screen)\n' +
            '• **Defender:** 🛑 *Stopper* (Physical enforcer), 🧹 *Sweeper* (Pace & recovery), 🧠 *Ball-Playing Defender* (Interceptions & distribution)'
        }
      );

    const docEmbed2 = new EmbedBuilder()
      .setColor('#10b981')
      .setTitle('📚 BTFW Player Handbook — Part 2: Spatial Campus & Match Simulations')
      .setDescription(
        `**🏟️ The 8 Campus Facilities:**\n` +
        `Move between facilities using \`-travel <alias>\`. Base cooldown is 20 minutes (shortened by vehicles).\n\n` +
        `• \`tc\` — **Training Center:** Drill sessions to earn Training Points.\n` +
        `• \`gm\` — **Global Market:** Purchase stamina drinks & matchday stat boots.\n` +
        `• \`vs\` — **Vehicle Showroom:** Buy exotic supercars down to 1-minute travel cooldown.\n` +
        `• \`ph\` — **Photoshoot Hall:** Commercial endorsements with Heineken, Adidas, Netflix.\n` +
        `• \`rf\` — **Research Facility:** Biomechanics lab to convert playstyles and upgrade individual attributes.\n` +
        `• \`ps\` — **Player Sauna:** Recover stamina (12h cooldown).\n` +
        `• \`ih\` — **Intel Hub:** Tactical match scouting (+1 to +6 free matchday bonus).\n` +
        `• \`lc\` — **Local Club:** Youth coaching (+50k coins) and fan meet & greets (+50k fans).\n\n` +
        `**⚽ The Match Simulation Engine:**\n` +
        `Each 90-minute simulation calculates 20-34 granular events (buildup, tactical tackles, VAR checks, half-time tactical shifts, penalties). Position ratings and boots determine scoring odds, while Man of the Match earns **+2 attribute points** and lowest performer receives **-1 point**.`
      )
      .setFooter({ text: 'Beyond The Final Whistle • Complete Game Documentation' });

    await docChannel.send({ embeds: [docEmbed1, docEmbed2] });
    console.log('  ✓ Sent embed to #documentation');
    await sleep(400);
  }

  // 3. BEGINNER GUIDE EMBED
  const guideChannel = createdChannelsMap['๑•\'🔰│beginner-guide'];
  if (guideChannel && guideChannel.isTextBased()) {
    const guideEmbed = new EmbedBuilder()
      .setColor('#6366f1')
      .setTitle('🔰 Rookie Footballer Onboarding Guide — Start Your Journey')
      .setDescription(
        `Welcome rookie! Follow this 5-step checklist to launch your football career:\n\n` +
        `**Step 1: Join a National Team**\n` +
        `Head to <#${createdChannelsMap['๑•\'🎭│roles']?.id || 'roles'}> or use \`-joinnation <alias>\` (` +
        `\`ger\`, \`por\`, \`esp\`, \`fra\`, \`eng\`, \`bra\`, \`arg\`, \`ned\`).\n` +
        `*Instantly unlock your National locker room and receive **100k Coins + 100k Followers** signing bonus!*\n\n` +
        `**Step 2: Choose Your Tactical Playstyle**\n` +
        `Travel to the Training Center using \`-travel tc\`, then run \`-train\`. You will be prompted to pick your role on the pitch.\n\n` +
        `**Step 3: Complete Daily Training Drills**\n` +
        `Run \`-train\` every 30 minutes to accumulate Training Points (TP). When stamina drops, visit <#${createdChannelsMap['๑•\'🧖│player-sauna']?.id || 'player-sauna'}> and run \`-recovery\`.\n\n` +
        `**Step 4: Earn Follower Clout & Commercial Deals**\n` +
        `Post regular updates in <#${createdChannelsMap['๑•\'🐦│twitter']?.id || 'twitter'}> using \`-tweet <text>\` to get 👍 fan likes. At 100k+ followers, travel to the Photoshoot Hall (\`-travel ph\`) and run \`-advert\` for big cash payouts!\n\n` +
        `**Step 5: Prepare for Matchday**\n` +
        `Visit <#${createdChannelsMap['๑•\'🕵️│intel-hub']?.id || 'intel-hub'}> for free \`-intel\`, buy boots at <#${createdChannelsMap['๑•\'🛍️│global-market']?.id || 'global-market'}>, and challenge other players using \`-match @player\`!`
      )
      .setFooter({ text: 'Beyond The Final Whistle • Rookie Onboarding' });

    await guideChannel.send({ embeds: [guideEmbed] });
    console.log('  ✓ Sent embed to #beginner-guide');
    await sleep(400);
  }

  // 4. WHAT IS VIP EMBED
  const vipChannel = createdChannelsMap['๑•\'👑│what-is-vip'];
  if (vipChannel && vipChannel.isTextBased()) {
    const vipEmbed = new EmbedBuilder()
      .setColor('#fbbf24')
      .setTitle('👑 VIP Status — Benefits, Boosts & Referrals')
      .setDescription(
        `VIP status elevates your football career with enhanced training options and accelerated development.\n\n` +
        `**✨ VIP Perks:**\n` +
        `• **VIP Training:** Run \`-train\` and select VIP mode for **+6 Training Points** (6h cooldown).\n` +
        `• **No Effort Training:** Instant **+20 TP** (+50 TP for Premium) once per day!\n` +
        `• **Sauna Full Recharge:** \`-recovery\` restores **100% full stamina** up to max cap!\n` +
        `• **Exclusive Role:** Golden \`@👑 VIP Footballer\` hoisted role.\n\n` +
        `**🎟️ How to Acquire VIP:**\n` +
        `1. **Server Boost:** Boost our Discord server for instant VIP duration.\n` +
        `2. **Player Referral:** Invite friends using \`-referral @you\` once they earn 50 TP.\n` +
        `3. **Staff Rewards:** Earn VIP through tournaments, MOTM awards, or donation.`
      )
      .setFooter({ text: 'Beyond The Final Whistle • VIP Club' });

    await vipChannel.send({ embeds: [vipEmbed] });
    console.log('  ✓ Sent embed to #what-is-vip');
    await sleep(400);
  }

  // 5. GLOBAL MARKET CATALOG EMBED
  const marketChannel = createdChannelsMap['๑•\'🛍️│global-market'];
  if (marketChannel && marketChannel.isTextBased()) {
    const marketEmbed = new EmbedBuilder()
      .setColor('#ec4899')
      .setTitle('🛍️ Global Market — Official Equipment Catalog')
      .setDescription(
        `Welcome to the Global Market! Purchase matchday performance boots and stamina recovery potions.\n\n` +
        `*Use \`-buy <alias>\` to purchase items.*\n\n` +
        `⚠️ *Boots effects won\'t appear if you already have +10 boost in that position. Boots reset after matchday.*`
      )
      .addFields(
        {
          name: `${EMOJIS.sd} Sports Drink`,
          value: '• **Alias:** `sd`\n• **Item info:** Recovers 50 stamina (up to 100 max)\n• **Price:** 100k 🪙'
        },
        {
          name: `${EMOJIS.strika} Strika Boots`,
          value: '• **Alias:** `strika`\n• **Item info:** Gives an additional +10 attack boost for one match.\n• **Price:** 500k 🪙'
        },
        {
          name: `${EMOJIS.passa} Passa Boots`,
          value: '• **Alias:** `passa`\n• **Item info:** Gives an additional +10 midfield boost for one match.\n• **Price:** 500k 🪙'
        },
        {
          name: `${EMOJIS.bully} Bully Boots`,
          value: '• **Alias:** `bully`\n• **Item info:** Gives an additional +10 defence boost for one match.\n• **Price:** 500k 🪙'
        }
      )
      .setFooter({ text: 'Beyond The Final Whistle • Global Market' });

    await marketChannel.send({ embeds: [marketEmbed] });
    console.log('  ✓ Sent embed to #global-market');
    await sleep(400);
  }

  // 6. VEHICLE SHOWROOM CATALOG EMBED
  const showroomChannel = createdChannelsMap['๑•\'🏎️│vehicle-showroom'];
  if (showroomChannel && showroomChannel.isTextBased()) {
    const showroomEmbed = new EmbedBuilder()
      .setColor('#f97316')
      .setTitle('🏎️ Vehicle Showroom — Exotic Supercars Dealership')
      .setDescription(
        `Use \`-vehiclebuy <alias>\` to buy a vehicle.\n` +
        `Each vehicle reduces your travel cooldown across the spatial campus. Owning multiple vehicles applies the fastest one automatically!`
      )
      .addFields(
        {
          name: `🚗 Basic Car`,
          value: '• **Alias:** `basic`\n• **Item info:** Decreases travelling cooldown to 16 minutes.\n• **Price:** 700k 🪙'
        },
        {
          name: `${EMOJIS.hcfront}${EMOJIS.hcback} Honda Civic Type R`,
          value: '• **Alias:** `honda`\n• **Item info:** Decreases travelling cooldown to 14 minutes.\n• **Price:** 1M 🪙'
        },
        {
          name: `${EMOJIS.tsfront}${EMOJIS.tsback} Toyota Supra GR`,
          value: '• **Alias:** `toyota`\n• **Item info:** Decreases travelling cooldown to 10 minutes.\n• **Price:** 3M 🪙'
        },
        {
          name: `${EMOJIS.p911front}${EMOJIS.p911back} Porsche 911 GT3`,
          value: '• **Alias:** `porsche`\n• **Item info:** Decreases travelling cooldown to 7 minutes.\n• **Price:** 5.35M 🪙'
        },
        {
          name: `${EMOJIS.ngtrfront}${EMOJIS.ngtrback} Nissan GT-R Nismo`,
          value: '• **Alias:** `nissan`\n• **Item info:** Decreases travelling cooldown to 4 minutes.\n• **Price:** 6.75M 🪙'
        },
        {
          name: `${EMOJIS.ar8front}${EMOJIS.ar8back} Audi R8 V10 Performance`,
          value: '• **Alias:** `audi`\n• **Item info:** Decreases travelling cooldown to 4 minutes.\n• **Price:** 6.75M 🪙'
        },
        {
          name: `${EMOJIS.lhfront}${EMOJIS.lhback} Lamborghini Huracán`,
          value: '• **Alias:** `lamborghini`\n• **Item info:** Decreases travelling cooldown to 3 minutes.\n• **Price:** 8.4M 🪙'
        },
        {
          name: `${EMOJIS.rrgfront}${EMOJIS.rrgback} Rolls Royce Ghost`,
          value: '• **Alias:** `rollsroyce`\n• **Item info:** Decreases travelling cooldown to 2 minutes.\n• **Price:** 10.25M 🪙'
        },
        {
          name: `${EMOJIS.ffront}${EMOJIS.fback} Ferrari LaFerrari`,
          value: '• **Alias:** `ferrari`\n• **Item info:** Decreases travelling cooldown to 1 minute.\n• **Price:** 17.7M 🪙'
        },
        {
          name: `${EMOJIS.bcfront}${EMOJIS.bcback} Bugatti Chiron Super Sport`,
          value: '• **Alias:** `bugatti`\n• **Item info:** Decreases travelling cooldown to 1 minute.\n• **Price:** 20.5M 🪙'
        }
      )
      .setFooter({ text: 'Beyond The Final Whistle • Dealership' });

    await showroomChannel.send({ embeds: [showroomEmbed] });
    console.log('  ✓ Sent embed to #vehicle-showroom');
    await sleep(400);
  }

  // 7. PHOTOSHOOT HALL EMBED
  const photoChannel = createdChannelsMap['๑•\'📸│photoshoot-hall'];
  if (photoChannel && photoChannel.isTextBased()) {
    const photoEmbed = new EmbedBuilder()
      .setColor('#a855f7')
      .setTitle('📸 Commercial Brand Sponsorship Deals — Photoshoot Hall')
      .setDescription(
        `Choose a brand partner matching your follower clout! Use \`-advert\` to trigger the deal menu.\n\n` +
        `Cooldown: 2 hours between campaigns.`
      )
      .addFields(
        {
          name: '🍺 Heineken Commercial',
          value: '• **Command:** `-advert heineken`\n• **Min Followers:** 100k 👤\n• **Stamina Cost:** 5 ⚡\n• **Reward:** +100k 🪙 • Followers Change: -50k 👤'
        },
        {
          name: '👟 Adidas Global Campaign',
          value: '• **Command:** `-advert adidas`\n• **Min Followers:** 1M 👤\n• **Stamina Cost:** 10 ⚡\n• **Reward:** +200k 🪙 • Followers Change: 0'
        },
        {
          name: '🥤 Coca-Cola Summer Splash',
          value: '• **Command:** `-advert cocacola`\n• **Min Followers:** 5M 👤\n• **Stamina Cost:** 10 ⚡\n• **Reward:** +300k 🪙 • Followers Change: -200k 👤'
        },
        {
          name: '🎬 Netflix Docuseries',
          value: '• **Command:** `-advert netflix`\n• **Min Followers:** 6M 👤\n• **Stamina Cost:** 30 ⚡\n• **Reward:** +300k 🪙 • Followers Change: +50k 👤'
        },
        {
          name: '✔️ Nike Athlete Endorsement',
          value: '• **Command:** `-advert nike`\n• **Min Followers:** 8M 👤\n• **Stamina Cost:** 30 ⚡\n• **Reward:** +500k 🪙 • Followers Change: +100k 👤'
        }
      )
      .setFooter({ text: 'Beyond The Final Whistle • Commercial Partnerships' });

    await photoChannel.send({ embeds: [photoEmbed] });
    console.log('  ✓ Sent embed to #photoshoot-hall');
    await sleep(400);
  }

  // 8. ROLES ASSIGNMENT EMBED
  const rolesChannel = createdChannelsMap['๑•\'🎭│roles'];
  if (rolesChannel && rolesChannel.isTextBased()) {
    const rolesEmbed = new EmbedBuilder()
      .setColor('#38bdf8')
      .setTitle('🎭 National Team Selection & Notification Roles')
      .setDescription(
        `Welcome to the International Federation! Choose your national team and opt-in for match and announcement pings.\n\n` +
        `🌍 **Join a National Team:**\n` +
        'Run `-joinnation <alias>` in this channel or `#bot-cmds`:\n\n' +
        `• 🇳🇱 **Netherlands:** \`-joinnation ned\`\n` +
        `• 🇩🇪 **Germany:** \`-joinnation ger\`\n` +
        `• 🇵🇹 **Portugal:** \`-joinnation por\`\n` +
        `• 🇪🇸 **Spain:** \`-joinnation esp\`\n` +
        `• 🇫🇷 **France:** \`-joinnation fra\`\n` +
        `• 🏴󠁧󠁢󠁥󠁮󠁧󠁿 **England:** \`-joinnation eng\`\n` +
        `• 🇧🇷 **Brazil:** \`-joinnation bra\`\n` +
        `• 🇦🇷 **Argentina:** \`-joinnation arg\`\n\n` +
        `*Joining a nation immediately grants access to your nation's private locker room and credits a **100k 🪙 + 100k 👤** signing bonus!*`
      )
      .setFooter({ text: 'Beyond The Final Whistle • International Registration' });

    await rolesChannel.send({ embeds: [rolesEmbed] });
    console.log('  ✓ Sent embed to #roles');
    await sleep(400);
  }

  // 9. INFORMATION EMBED
  const infoChannel = createdChannelsMap['๑•\'ℹ️│information'];
  if (infoChannel && infoChannel.isTextBased()) {
    const infoEmbed = new EmbedBuilder()
      .setColor('#2563eb')
      .setTitle('ℹ️ Beyond The Final Whistle — Server & Game Information')
      .setDescription(
        `**Beyond The Final Whistle (BTFW)** is an advanced multiplayer football role-playing simulation.\n\n` +
        `**🌐 Server Overview:**\n` +
        `• **Bot Prefix:** \`-\`\n` +
        `• **Master Help:** \`-help\`\n` +
        `• **Campus Locations:** \`-locations\`\n` +
        `• **Leaderboards:** \`-lb\`\n\n` +
        `**🏟️ The Campus Ecosystem:**\n` +
        `Each facility on our server functions as a physical building on the campus. Players must travel between them to access specific facilities and activities.\n\n` +
        `**🏆 World Cup & Domestic Tournaments:**\n` +
        `Matches are scheduled regularly throughout the season. Check <#${createdChannelsMap['๑•\'📅│schedule']?.id || 'schedule'}> for upcoming match times!`
      )
      .setFooter({ text: 'Beyond The Final Whistle • Official Hub' });

    await infoChannel.send({ embeds: [infoEmbed] });
    console.log('  ✓ Sent embed to #information');
    await sleep(400);
  }

  console.log('\n==================================================');
  console.log('🎉 WITS SERVER LAYOUT SETUP COMPLETED SUCCESSFULLY!');
  console.log('==================================================');

  process.exit(0);
});

client.login(token);
