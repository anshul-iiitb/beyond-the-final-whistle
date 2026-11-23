const { 
  Client, 
  GatewayIntentBits, 
  ChannelType, 
  EmbedBuilder 
} = require('discord.js');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
dotenv.config();

const token = process.env.LEAGUE_MASTER_TOKEN || process.env.DISCORD_TOKEN;
const GUILD_ID = '1574068651915743272';

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildExpressions,
    GatewayIntentBits.GuildMessages,
  ]
});

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
  // STEP 1: UPLOAD MISSING / UPDATED EMOJIS TO GUILD
  // ==========================================
  console.log('\n--- 1. SYNCING SERVER EMOJIS ---');
  const emojisDir = path.resolve(__dirname, '../assets/emojis');
  const emojiFiles = fs.readdirSync(emojisDir).filter(f => f.endsWith('.png'));

  let existingEmojis = await guild.emojis.fetch();
  console.log(`Initial guild emojis count: ${existingEmojis.size}`);

  // Check worldcup emoji: if old, delete and replace with authentic transparent one
  const oldWorldCup = existingEmojis.find(e => e.name === 'worldcup');
  if (oldWorldCup) {
    try {
      console.log('Replacing existing worldcup emoji with authentic transparent trophy...');
      await oldWorldCup.delete('Updating with high-res authentic FIFA World Cup trophy');
      await sleep(500);
      existingEmojis = await guild.emojis.fetch();
    } catch (e) {
      console.warn('Could not delete old worldcup:', e.message);
    }
  }

  for (const file of emojiFiles) {
    const emojiName = path.basename(file, '.png').toLowerCase();
    const filePath = path.join(emojisDir, file);
    const existing = existingEmojis.find(e => e.name?.toLowerCase() === emojiName);

    if (!existing) {
      try {
        const created = await guild.emojis.create({
          attachment: filePath,
          name: emojiName,
          reason: 'Adding server emoji for League Master and BTFW'
        });
        console.log(`  + Created server emoji: :${emojiName}: -> ${created.toString()}`);
        await sleep(500); // Respect rate limit
      } catch (err) {
        console.error(`  x Error creating :${emojiName}:`, err.message);
      }
    } else {
      console.log(`  = Server emoji exists: :${emojiName}: -> ${existing.toString()}`);
    }
  }

  // Refresh guild emoji cache
  const finalEmojis = await guild.emojis.fetch();
  console.log(`\n✅ Total Guild Emojis: ${finalEmojis.size}`);

  // Build a resolver dictionary
  const getGuildEmoji = (name, fallback = '') => {
    const found = finalEmojis.find(e => e.name?.toLowerCase() === name.toLowerCase());
    return found ? found.toString() : fallback;
  };

  const E = {
    coin: getGuildEmoji('coin', '🪙'),
    stamina: getGuildEmoji('stamina', '⚡'),
    tp: getGuildEmoji('tp', '🤹‍♂️'),
    followers: getGuildEmoji('followers', '👤'),
    worldcup: getGuildEmoji('worldcup', '🏆'),
    strika: getGuildEmoji('strika', '⚡'),
    passa: getGuildEmoji('passa', '👟'),
    bully: getGuildEmoji('bully', '🛡️'),
    sd: getGuildEmoji('sd', '🧪'),
    car: getGuildEmoji('car', '🏎️'),
    goldenboot: getGuildEmoji('goldenboot', '✨'),
    goldmedal: getGuildEmoji('goldmedal', '🥇'),
    silvermedal: getGuildEmoji('silvermedal', '🥈'),
    motm: getGuildEmoji('motm', '👑'),
    adidas: getGuildEmoji('adidas', '👟'),
    heineken: getGuildEmoji('heineken', '🍺'),
    cocacola: getGuildEmoji('cocacola', '🥤'),
    netflix: getGuildEmoji('netflix', '🎬'),
    nike: getGuildEmoji('nike', '✔️'),
    hcfront: getGuildEmoji('hcfront', '🚗'),
    hcback: getGuildEmoji('hcback', ''),
    tsfront: getGuildEmoji('tsfront', '🏎️'),
    tsback: getGuildEmoji('tsback', ''),
    p911front: getGuildEmoji('p911front', '🏎️'),
    p911back: getGuildEmoji('p911back', ''),
    ngtrfront: getGuildEmoji('ngtrfront', '🏎️'),
    ngtrback: getGuildEmoji('ngtrback', ''),
    ar8front: getGuildEmoji('ar8front', '🏎️'),
    ar8back: getGuildEmoji('ar8back', ''),
    lhfront: getGuildEmoji('lhfront', '🏎️'),
    lhback: getGuildEmoji('lhback', ''),
    rrgfront: getGuildEmoji('rrgfront', '🏎️'),
    rrgback: getGuildEmoji('rrgback', ''),
    ffront: getGuildEmoji('ffront', '🏎️'),
    fback: getGuildEmoji('fback', ''),
    bcfront: getGuildEmoji('bcfront', '🏎️'),
    bcback: getGuildEmoji('bcback', ''),
  };

  // ==========================================
  // STEP 2: CLEAR OLD MESSAGES & REPOST EMBEDS
  // ==========================================
  console.log('\n--- 2. REPOSTING EMBEDS IN INFO & LOCATION CHANNELS ---');

  const channels = await guild.channels.fetch();

  async function clearAndPost(channelNameSubstr, embeds) {
    const ch = channels.find(c => c && c.name.toLowerCase().includes(channelNameSubstr));
    if (!ch || !ch.isTextBased()) {
      console.warn(`Channel matching "${channelNameSubstr}" not found!`);
      return;
    }

    try {
      // Fetch up to 20 messages and delete any bot messages
      const msgs = await ch.messages.fetch({ limit: 20 });
      for (const m of msgs.values()) {
        try {
          await m.delete();
          await sleep(250);
        } catch (err) {
          // ignore
        }
      }

      await ch.send({ embeds });
      console.log(`  ✓ Reposted ${embeds.length} embed(s) in #${ch.name}`);
      await sleep(400);
    } catch (err) {
      console.error(`  x Error reposting in #${channelNameSubstr}:`, err.message);
    }
  }

  // 1. RULES
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

  await clearAndPost('rules', [rulesEmbed]);

  // 2. DOCUMENTATION
  const docEmbed1 = new EmbedBuilder()
    .setColor('#10b981')
    .setTitle(`📚 BTFW Player Handbook — Part 1: Career Starting Stats & Attributes`)
    .setDescription(
      `**Beyond The Final Whistle (BTFW)** is a deep tactical football career simulation MMORPG.\n` +
      `You create and develop your player from rookie status to world champion.\n\n` +
      `**🌟 Rookie Starting Stats:**\n` +
      `• **Attack:** 50\n` +
      `• **Midfield:** 50\n` +
      `• **Defence:** 50\n` +
      `• **Stamina:** 100 / 100 ${E.stamina}\n` +
      `• **Money:** 0 ${E.coin}\n` +
      `• **Followers:** 0 ${E.followers}\n` +
      `• **Training Points:** 0 ${E.tp}\n\n` +
      `🎁 **Welcome Bonus:** Joining a National Team gives you an instant **100k ${E.coin} + 100k ${E.followers}** signing bonus!`
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
    .setTitle(`📚 BTFW Player Handbook — Part 2: Spatial Campus & Match Simulations`)
    .setDescription(
      `**🏟️ The 8 Campus Facilities:**\n` +
      `Move between facilities using \`-travel <alias>\`. Base cooldown is 20 minutes (shortened by vehicles).\n\n` +
      `• \`tc\` — **Training Center:** Drill sessions to earn Training Points ${E.tp}.\n` +
      `• \`gm\` — **Global Market:** Purchase stamina drinks ${E.sd} & matchday stat boots ${E.strika} ${E.passa} ${E.bully}.\n` +
      `• \`vs\` — **Vehicle Showroom:** Buy exotic supercars down to 1-minute travel cooldown ${E.car}.\n` +
      `• \`ph\` — **Photoshoot Hall:** Commercial endorsements with ${E.heineken} ${E.adidas} ${E.netflix}.\n` +
      `• \`rf\` — **Research Facility:** Biomechanics lab to convert playstyles and upgrade individual attributes.\n` +
      `• \`ps\` — **Player Sauna:** Recover stamina (12h cooldown).\n` +
      `• \`ih\` — **Intel Hub:** Tactical match scouting (+1 to +6 free matchday bonus).\n` +
      `• \`lc\` — **Local Club:** Youth coaching (+50k coins) and fan meet & greets (+50k fans).\n\n` +
      `**⚽ The Match Simulation Engine:**\n` +
      `Each 90-minute simulation calculates 20-34 granular events (buildup, tactical tackles, VAR checks, half-time tactical shifts, penalties). Position ratings and boots determine scoring odds, while Man of the Match earns **+2 attribute points** and lowest performer receives **-1 point**.`
    )
    .setFooter({ text: 'Beyond The Final Whistle • Complete Game Documentation' });

  await clearAndPost('documentation', [docEmbed1, docEmbed2]);

  // 3. BEGINNER GUIDE
  const guideEmbed = new EmbedBuilder()
    .setColor('#6366f1')
    .setTitle('🔰 Rookie Footballer Onboarding Guide — Start Your Journey')
    .setDescription(
      `Welcome rookie! Follow this 5-step checklist to launch your football career:\n\n` +
      `**Step 1: Join a National Team**\n` +
      `Head to <#${channels.find(c => c && c.name.includes('roles'))?.id || 'roles'}> or use \`-joinnation <alias>\` (` +
      `\`ger\`, \`por\`, \`esp\`, \`fra\`, \`eng\`, \`bra\`, \`arg\`, \`ned\`).\n` +
      `*Instantly unlock your National locker room and receive **100k ${E.coin} + 100k ${E.followers}** signing bonus!*\n\n` +
      `**Step 2: Choose Your Tactical Playstyle**\n` +
      `Travel to the Training Center using \`-travel tc\`, then run \`-train\`. You will be prompted to pick your role on the pitch.\n\n` +
      `**Step 3: Complete Daily Training Drills**\n` +
      `Run \`-train\` every 30 minutes to accumulate Training Points (${E.tp}). When stamina drops, visit the Player Sauna (\`-travel ps\`) and run \`-recovery\`.\n\n` +
      `**Step 4: Earn Follower Clout & Commercial Deals**\n` +
      `Post regular updates in <#${channels.find(c => c && c.name.includes('twitter'))?.id || 'twitter'}> using \`-tweet <text>\` to get 👍 fan likes. At 100k+ followers, travel to the Photoshoot Hall (\`-travel ph\`) and run \`-advert\` for big cash payouts!\n\n` +
      `**Step 5: Prepare for Matchday**\n` +
      `Visit the Intel Hub (\`-travel ih\`) for free \`-intel\`, buy boots at the Global Market (\`-travel gm\`), and challenge other players using \`-match @player\`!`
    )
    .setFooter({ text: 'Beyond The Final Whistle • Rookie Onboarding' });

  await clearAndPost('beginner-guide', [guideEmbed]);

  // 4. WHAT IS VIP
  const vipEmbed = new EmbedBuilder()
    .setColor('#fbbf24')
    .setTitle('👑 VIP Status — Benefits, Boosts & Referrals')
    .setDescription(
      `VIP status elevates your football career with enhanced training options and accelerated development.\n\n` +
      `**✨ VIP Perks:**\n` +
      `• **VIP Training:** Run \`-train\` and select VIP mode for **+6 Training Points ${E.tp}** (6h cooldown).\n` +
      `• **No Effort Training:** Instant **+20 TP** (+50 TP for Premium) once per day!\n` +
      `• **Sauna Full Recharge:** \`-recovery\` restores **100% full stamina ${E.stamina}** up to max cap!\n` +
      `• **Exclusive Role:** Golden \`@👑 VIP Footballer\` hoisted role.\n\n` +
      `**🎟️ How to Acquire VIP:**\n` +
      `1. **Server Boost:** Boost our Discord server for instant VIP duration.\n` +
      `2. **Player Referral:** Invite friends using \`-referral @you\` once they earn 50 TP.\n` +
      `3. **Staff Rewards:** Earn VIP through tournaments, MOTM awards ${E.motm}, or donation.`
    )
    .setFooter({ text: 'Beyond The Final Whistle • VIP Club' });

  await clearAndPost('what-is-vip', [vipEmbed]);

  // 5. GLOBAL MARKET
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
        name: `${E.sd} Sports Drink`,
        value: `• **Alias:** \`sd\`\n• **Item info:** Recovers 50 stamina ${E.stamina} (up to 100 max)\n• **Price:** 100k ${E.coin}`
      },
      {
        name: `${E.strika} Strika Boots`,
        value: `• **Alias:** \`strika\`\n• **Item info:** Gives an additional +10 attack boost for one match.\n• **Price:** 500k ${E.coin}`
      },
      {
        name: `${E.passa} Passa Boots`,
        value: `• **Alias:** \`passa\`\n• **Item info:** Gives an additional +10 midfield boost for one match.\n• **Price:** 500k ${E.coin}`
      },
      {
        name: `${E.bully} Bully Boots`,
        value: `• **Alias:** \`bully\`\n• **Item info:** Gives an additional +10 defence boost for one match.\n• **Price:** 500k ${E.coin}`
      }
    )
    .setFooter({ text: 'Beyond The Final Whistle • Global Market' });

  await clearAndPost('global-market', [marketEmbed]);

  // 6. VEHICLE SHOWROOM
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
        value: `• **Alias:** \`basic\`\n• **Item info:** Decreases travelling cooldown to 16 minutes.\n• **Price:** 700k ${E.coin}`
      },
      {
        name: `${E.hcfront}${E.hcback} Honda Civic Type R`,
        value: `• **Alias:** \`honda\`\n• **Item info:** Decreases travelling cooldown to 14 minutes.\n• **Price:** 1M ${E.coin}`
      },
      {
        name: `${E.tsfront}${E.tsback} Toyota Supra GR`,
        value: `• **Alias:** \`toyota\`\n• **Item info:** Decreases travelling cooldown to 10 minutes.\n• **Price:** 3M ${E.coin}`
      },
      {
        name: `${E.p911front}${E.p911back} Porsche 911 GT3`,
        value: `• **Alias:** \`porsche\`\n• **Item info:** Decreases travelling cooldown to 7 minutes.\n• **Price:** 5.35M ${E.coin}`
      },
      {
        name: `${E.ngtrfront}${E.ngtrback} Nissan GT-R Nismo`,
        value: `• **Alias:** \`nissan\`\n• **Item info:** Decreases travelling cooldown to 4 minutes.\n• **Price:** 6.75M ${E.coin}`
      },
      {
        name: `${E.ar8front}${E.ar8back} Audi R8 V10 Performance`,
        value: `• **Alias:** \`audi\`\n• **Item info:** Decreases travelling cooldown to 4 minutes.\n• **Price:** 6.75M ${E.coin}`
      },
      {
        name: `${E.lhfront}${E.lhback} Lamborghini Huracán`,
        value: `• **Alias:** \`lamborghini\`\n• **Item info:** Decreases travelling cooldown to 3 minutes.\n• **Price:** 8.4M ${E.coin}`
      },
      {
        name: `${E.rrgfront}${E.rrgback} Rolls Royce Ghost`,
        value: `• **Alias:** \`rollsroyce\`\n• **Item info:** Decreases travelling cooldown to 2 minutes.\n• **Price:** 10.25M ${E.coin}`
      },
      {
        name: `${E.ffront}${E.fback} Ferrari LaFerrari`,
        value: `• **Alias:** \`ferrari\`\n• **Item info:** Decreases travelling cooldown to 1 minute.\n• **Price:** 17.7M ${E.coin}`
      },
      {
        name: `${E.bcfront}${E.bcback} Bugatti Chiron Super Sport`,
        value: `• **Alias:** \`bugatti\`\n• **Item info:** Decreases travelling cooldown to 1 minute.\n• **Price:** 20.5M ${E.coin}`
      }
    )
    .setFooter({ text: 'Beyond The Final Whistle • Dealership' });

  await clearAndPost('vehicle-showroom', [showroomEmbed]);

  // 7. PHOTOSHOOT HALL
  const photoEmbed = new EmbedBuilder()
    .setColor('#a855f7')
    .setTitle('📸 Commercial Brand Sponsorship Deals — Photoshoot Hall')
    .setDescription(
      `Choose a brand partner matching your follower clout! Use \`-advert\` to trigger the deal menu.\n\n` +
      `Cooldown: 2 hours between campaigns.`
    )
    .addFields(
      {
        name: `${E.heineken} Heineken Commercial`,
        value: `• **Command:** \`-advert heineken\`\n• **Min Followers:** 100k ${E.followers}\n• **Stamina Cost:** 5 ${E.stamina}\n• **Reward:** +100k ${E.coin} • Followers Change: -50k ${E.followers}`
      },
      {
        name: `${E.adidas} Adidas Global Campaign`,
        value: `• **Command:** \`-advert adidas\`\n• **Min Followers:** 1M ${E.followers}\n• **Stamina Cost:** 10 ${E.stamina}\n• **Reward:** +200k ${E.coin} • Followers Change: 0`
      },
      {
        name: `${E.cocacola} Coca-Cola Summer Splash`,
        value: `• **Command:** \`-advert cocacola\`\n• **Min Followers:** 5M ${E.followers}\n• **Stamina Cost:** 10 ${E.stamina}\n• **Reward:** +300k ${E.coin} • Followers Change: -200k ${E.followers}`
      },
      {
        name: `${E.netflix} Netflix Docuseries`,
        value: `• **Command:** \`-advert netflix\`\n• **Min Followers:** 6M ${E.followers}\n• **Stamina Cost:** 30 ${E.stamina}\n• **Reward:** +300k ${E.coin} • Followers Change: +50k ${E.followers}`
      },
      {
        name: `${E.nike} Nike Athlete Endorsement`,
        value: `• **Command:** \`-advert nike\`\n• **Min Followers:** 8M ${E.followers}\n• **Stamina Cost:** 30 ${E.stamina}\n• **Reward:** +500k ${E.coin} • Followers Change: +100k ${E.followers}`
      }
    )
    .setFooter({ text: 'Beyond The Final Whistle • Commercial Partnerships' });

  await clearAndPost('photoshoot-hall', [photoEmbed]);

  // 8. ROLES
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
      `*Joining a nation immediately grants access to your nation's private locker room and credits a **100k ${E.coin} + 100k ${E.followers}** signing bonus!*`
    )
    .setFooter({ text: 'Beyond The Final Whistle • International Registration' });

  await clearAndPost('roles', [rolesEmbed]);

  // 9. INFORMATION
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
      `Matches are scheduled regularly throughout the season. Check <#${channels.find(c => c && c.name.includes('schedule'))?.id || 'schedule'}> for upcoming match times!`
    )
    .setFooter({ text: 'Beyond The Final Whistle • Official Hub' });

  await clearAndPost('information', [infoEmbed]);

  console.log('\n==================================================');
  console.log('🎉 GUILD EMOJIS SYNCED & ALL EMBEDS REPOSTED!');
  console.log('==================================================');

  process.exit(0);
});

client.login(token);
