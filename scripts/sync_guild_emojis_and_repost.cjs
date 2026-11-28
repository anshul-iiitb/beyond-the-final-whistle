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

  const DIVIDER = '━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
  const SUB_DIVIDER = '───────────────────────────';

  // ==========================================
  // STEP 2: CLEAR OLD MESSAGES & REPOST EMBEDS
  // ==========================================
  console.log('\n--- REPOSTING THEMED EMBEDS IN INFO & LOCATION CHANNELS ---');

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
      console.log(`  ✓ Reposted ${embeds.length} themed embed(s) in #${ch.name}`);
      await sleep(400);
    } catch (err) {
      console.error(`  x Error reposting in #${channelNameSubstr}:`, err.message);
    }
  }

  // 1. RULES
  const rulesEmbed = new EmbedBuilder()
    .setColor('#2563eb') // Cobalt Blue
    .setTitle('📜 Beyond The Final Whistle — Official Server & Fair Play Charter')
    .setDescription(
      `> *Welcome to the premier multiplayer football simulation server! To maintain an engaging, fair, and immersive experience for all players, managers, and clubs, please adhere to these core regulations.*\n\n` +
      `### 1️⃣ Respect & Sportsmanship\n` +
      `• Harassment, hate speech, toxicity, and targeted griefing will not be tolerated.\n` +
      `• Respect all club captains, match officials, and administrators.\n\n` +
      `### 2️⃣ Fair Play & Anti-Exploit Policy\n` +
      `• Macro scripts, auto-clickers, and automated multi-account farming are strictly prohibited.\n` +
      `• Any economic loop or game bug discovered must be reported in \`#suggestions\` or to staff.\n` +
      `• Exploiting glitches will result in a stat reset and permanent blacklist.\n\n` +
      `### 3️⃣ Channel Discipline & Command Etiquette\n` +
      `• Keep bot commands (\`-profile\`, \`-train\`, \`-buy\`, \`-advert\`) inside designated campus channels or \`#bot-cmds\`.\n` +
      `• Keep general chat channels reserved for community conversation.\n\n` +
      `### 4️⃣ Match & Transfer Integrity\n` +
      `• Match-fixing, intentional bench throwing, or collusive match feeding is strictly penalized.\n` +
      `• Club captains must honor signed player contracts and payouts via \`-teampay\`.\n\n` +
      `### 5️⃣ Discord Terms of Service\n` +
      `• All members must adhere to Discord's official Community Guidelines and Terms of Service.\n\n` +
      `${DIVIDER}\n` +
      `-# ⚖️ Enforced by the Beyond The Final Whistle Fair Play Committee.`
    )
    .setFooter({ text: 'Beyond The Final Whistle • Fair Play Charter' })
    .setTimestamp();

  await clearAndPost('rules', [rulesEmbed]);

  // 2. DOCUMENTATION
  const docEmbed1 = new EmbedBuilder()
    .setColor('#0ea5e9') // Sky Blue
    .setTitle(`📚 BTFW Player Handbook — Part 1: Career Starting Stats & Biometrics`)
    .setDescription(
      `> *Beyond The Final Whistle (BTFW) is a deep tactical football career simulation MMORPG. You create and develop your player from rookie status to world champion.*\n\n` +
      `### 🌟 ROOKIE BASELINE ATTRIBUTES\n` +
      `• **Base Position Ratings:** ATK: \`50\` • MID: \`50\` • DEF: \`50\`\n` +
      `• **Starting Stamina:** \`100/100\` ${E.stamina} • Training Points: \`0 TP\` ${E.tp}\n` +
      `• **Starting Finances:** \`0\` ${E.coin} • Starting Followers: \`0\` ${E.followers}\n\n` +
      `🎁 **International Signing Bonus:**\n` +
      `Joining a National Team immediately grants you an instant **100k ${E.coin} + 100k ${E.followers}** bonus!\n\n` +
      `### 🎯 15 BIOMECHANICAL ATTRIBUTES\n` +
      `• **Attacking:** \`FIN\` (Finishing), \`POW\` (Shot Power), \`HEA\` (Heading)\n` +
      `• **Technical:** \`PAS\` (Passing), \`VIS\` (Vision), \`CRO\` (Crossing), \`DRI\` (Dribbling)\n` +
      `• **Defending:** \`TCK\` (Tackling), \`INT\` (Interceptions), \`MRK\` (Marking)\n` +
      `• **Physical & Mental:** \`PAC\` (Pace), \`PHY\` (Physicality), \`CMP\` (Composure), \`AGI\` (Agility), \`WRK\` (Work Rate)\n\n` +
      `### ⚽ TACTICAL PLAYSTYLES\n` +
      `• **Attacker:** 🎯 *Poacher* (Box predator), ⚡ *Speedster* (Counter runner), 🦘 *Target Man* (Aerial anchor)\n` +
      `• **Midfielder:** 🪄 *Playmaker* (Vision & passing), 🔋 *Box-to-Box* (Work rate engine), 🛡️ *Anchor* (Screen)\n` +
      `• **Defender:** 🛑 *Stopper* (Physical enforcer), 🧹 *Sweeper* (Pace & recovery), 🧠 *Ball-Playing Defender* (Distribution)\n\n` +
      `${DIVIDER}\n` +
      `-# 💡 Upgrade attributes at the Research Facility (-travel rf ➔ -sptrain <attr>).`
    )
    .setFooter({ text: 'Beyond The Final Whistle • Player Handbook Part 1' })
    .setTimestamp();

  const docEmbed2 = new EmbedBuilder()
    .setColor('#06b6d4') // Cyan
    .setTitle(`📚 BTFW Player Handbook — Part 2: Spatial Campus & Match Simulations`)
    .setDescription(
      `> *Explore 8 campus facilities and compete in realistic 90-minute AI simulated football matches.*\n\n` +
      `### 🏟️ SPATIAL CAMPUS FACILITIES\n` +
      `Move between facilities using \`-travel <alias>\`. Base cooldown is 20 minutes (slashed by cars down to 1m).\n\n` +
      `• \`tc\` — **Training Center:** Drill sessions to earn Training Points ${E.tp}.\n` +
      `• \`gm\` — **Global Market:** Purchase stamina drinks ${E.sd} & matchday stat boots ${E.strika} ${E.passa} ${E.bully}.\n` +
      `• \`vs\` — **Vehicle Showroom:** Buy exotic supercars down to 1-minute travel cooldown ${E.car}.\n` +
      `• \`ph\` — **Photoshoot Hall:** Commercial endorsements with ${E.heineken} ${E.adidas} ${E.netflix}.\n` +
      `• \`rf\` — **Research Facility:** Biomechanics lab to convert playstyles and upgrade individual attributes.\n` +
      `• \`ps\` — **Player Sauna:** Recover stamina (12h cooldown).\n` +
      `• \`ih\` — **Intel Hub:** Tactical match scouting (+1 to +6 free matchday bonus).\n` +
      `• \`lc\` — **Local Club:** Youth coaching (+50k coins) and fan meet & greets (+50k fans).\n\n` +
      `### ⚽ THE MATCH SIMULATION ENGINE\n` +
      `Each 90-minute simulation calculates 20-34 granular events (buildup, tackles, VAR, set pieces, half-time tactical shifts, penalties). Position ratings and active boots determine match performance. Man of the Match earns **+2 attribute points** and lowest performer receives **-1 point**.\n\n` +
      `${DIVIDER}\n` +
      `-# 💡 Challenge players anytime using: -match @opponent`
    )
    .setFooter({ text: 'Beyond The Final Whistle • Player Handbook Part 2' })
    .setTimestamp();

  await clearAndPost('documentation', [docEmbed1, docEmbed2]);

  // 3. BEGINNER GUIDE
  const guideEmbed = new EmbedBuilder()
    .setColor('#6366f1') // Indigo
    .setTitle('🔰 Rookie Footballer Onboarding Guide — Launch Your Legacy')
    .setDescription(
      `> *Welcome rookie! Follow this 5-step checklist to kickstart your professional football career:*\n\n` +
      `### 1️⃣ Join a National Team\n` +
      `Head to <#${channels.find(c => c && c.name.includes('roles'))?.id || 'roles'}> or run \`-joinnation <alias>\` (\`ger\`, \`por\`, \`esp\`, \`fra\`, \`eng\`, \`bra\`, \`arg\`, \`ned\`).\n` +
      `*Instantly unlock your private Locker Room and receive **100k ${E.coin} + 100k ${E.followers}** signing bonus!*\n\n` +
      `### 2️⃣ Choose Your Tactical Playstyle\n` +
      `Travel to the Training Center using \`-travel tc\`, then run \`-train\`. Select your on-pitch tactical identity.\n\n` +
      `### 3️⃣ Complete Daily Training Drills\n` +
      `Run \`-train\` every 30 minutes to accumulate Training Points (${E.tp}). When stamina drops, visit the Player Sauna (\`-travel ps\`) and run \`-recovery\`.\n\n` +
      `### 4️⃣ Build Fan Clout & Sign Brand Deals\n` +
      `Run \`-tweet <text>\` in any channel — the bot publishes it to locked <#${channels.find(c => c && c.name.includes('twitter'))?.id || 'twitter'}> for 👍 fan likes! At 100k+ followers, visit the Photoshoot Hall (\`-travel ph\`) and run \`-advert\` for big cash payouts!\n\n` +
      `### 5️⃣ Matchday Preparation & Tactical Intel\n` +
      `Visit the Intel Hub (\`-travel ih\`) for free \`-intel\`, buy performance boots at the Global Market (\`-travel gm\`), and challenge players using \`-match @player\`!\n\n` +
      `${DIVIDER}\n` +
      `-# 💡 Type -help anywhere for the full master command directory.`
    )
    .setFooter({ text: 'Beyond The Final Whistle • Rookie Onboarding' })
    .setTimestamp();

  await clearAndPost('beginner-guide', [guideEmbed]);

  // 4. WHAT IS VIP (HIGH-END LUXURY GOLD THEME)
  const vipEmbed = new EmbedBuilder()
    .setColor('#f59e0b') // Vibrant Champions Gold
    .setTitle('👑 VIP FOOTBALLER CLUB — PRIVILEGES & BOOSTS')
    .setDescription(
      `> *VIP status elevates your football career with accelerated development, priority facility recovery, and exclusive status within the international federation.*\n\n` +
      `### 🌟 EXCLUSIVE VIP PRIVILEGES\n` +
      `• **VIP Training Sessions:** Run \`-train\` and select VIP mode for **+6 Training Points ${E.tp}** (6h cooldown).\n` +
      `• **No-Effort Daily Drill:** Instant **+20 TP ${E.tp}** once per day for busy matchdays!\n` +
      `• **Sauna Cryo Recharge:** \`-recovery\` restores **100% full stamina ${E.stamina}** up to max capacity!\n` +
      `• **Hoisted Discord Status:** Golden <@&1574438929975869532> hoisted role & badge on your \`-profile\` card.\n\n` +
      `### 🎟️ HOW TO ACQUIRE VIP STATUS\n` +
      `**1️⃣ Server Boost:** Boost our Discord server for instant VIP duration.\n` +
      `**2️⃣ Player Referral:** Invite football friends using \`-referral @you\` once they reach 50 TP.\n` +
      `**3️⃣ Tournament & Event Trophies:** Win competitive matches, MOTM awards ${E.motm}, or seasonal league titles.\n\n` +
      `${DIVIDER}\n` +
      `-# 🌟 Elevated training, priority sauna recovery, and elite prestige on the pitch.`
    )
    .setFooter({ text: 'Beyond The Final Whistle • VIP Club & Player Excellence' })
    .setTimestamp();

  await clearAndPost('what-is-vip', [vipEmbed]);

  // 5. GLOBAL MARKET (EMERALD MARKET THEME)
  const marketEmbed = new EmbedBuilder()
    .setColor('#10b981') // Emerald Market Green
    .setTitle('🛍️ GLOBAL MARKETPLACE — MATCH GEAR & HYDRATION')
    .setDescription(
      `> *Official equipment store providing professional performance boots and stamina recovery potions to maximize matchday ratings.*\n\n` +
      `${E.sd} **SPORTS DRINK** \`[ alias: sd ]\`\n` +
      `> *Immediate bio-electrolyte rehydration formula.*\n` +
      `• **Restores:** \`+50\` ${E.stamina} Stamina (up to 100 max)\n` +
      `• **Cost:** \`100k\` ${E.coin}\n\n` +
      `${E.strika} **STRIKA BOOTS** \`[ alias: strika ]\`\n` +
      `> *Precision carbon-plate cleats engineered for clinical finishing and shot power.*\n` +
      `• **Match Boost:** \`+10 Attack\` (Applied next match as Attacker)\n` +
      `• **Cost:** \`500k\` ${E.coin}\n\n` +
      `${E.passa} **PASSA BOOTS** \`[ alias: passa ]\`\n` +
      `> *Textured micro-grip boots engineered for pinpoint ball distribution and vision.*\n` +
      `• **Match Boost:** \`+10 Midfield\` (Applied next match as Midfielder)\n` +
      `• **Cost:** \`500k\` ${E.coin}\n\n` +
      `${E.bully} **BULLY BOOTS** \`[ alias: bully ]\`\n` +
      `> *Reinforced composite studs for dominating physical challenges and winning tackles.*\n` +
      `• **Match Boost:** \`+10 Defence\` (Applied next match as Defender)\n` +
      `• **Cost:** \`500k\` ${E.coin}\n\n` +
      `${DIVIDER}\n` +
      `-# 💡 Purchase Command: -buy <alias> (e.g. -buy sd). Boots apply for one match and reset afterwards.`
    )
    .setFooter({ text: 'Beyond The Final Whistle • Global Market' })
    .setTimestamp();

  await clearAndPost('global-market', [marketEmbed]);

  // 6. VEHICLE SHOWROOM (RACING SCARLET THEME)
  const showroomEmbed = new EmbedBuilder()
    .setColor('#ef4444') // Racing Scarlet Red
    .setTitle('🏎️ LUXURY DEALERSHIP & HYPERCAR SHOWROOM')
    .setDescription(
      `> *Acquire high-performance supercars and grand tourers to slash travel cooldowns between campus facilities down to 1 minute!*\n\n` +
      `🚗 **Basic Car** \`[ basic ]\`\n` +
      `• **Campus Cooldown:** \`16 mins\` ⏱️   •   **Price:** \`700k\` ${E.coin}\n\n` +
      `${E.hcfront}${E.hcback} **Honda Civic Type R** \`[ honda ]\`\n` +
      `• **Campus Cooldown:** \`14 mins\` ⏱️   •   **Price:** \`1M\` ${E.coin}\n\n` +
      `${E.tsfront}${E.tsback} **Toyota Supra GR** \`[ toyota ]\`\n` +
      `• **Campus Cooldown:** \`10 mins\` ⏱️   •   **Price:** \`3M\` ${E.coin}\n\n` +
      `${E.p911front}${E.p911back} **Porsche 911 GT3** \`[ porsche ]\`\n` +
      `• **Campus Cooldown:** \`7 mins\` ⏱️   •   **Price:** \`5.35M\` ${E.coin}\n\n` +
      `${E.ngtrfront}${E.ngtrback} **Nissan GT-R Nismo** \`[ nissan ]\`\n` +
      `• **Campus Cooldown:** \`4 mins\` ⏱️   •   **Price:** \`6.75M\` ${E.coin}\n\n` +
      `${E.ar8front}${E.ar8back} **Audi R8 V10 Performance** \`[ audi ]\`\n` +
      `• **Campus Cooldown:** \`4 mins\` ⏱️   •   **Price:** \`6.75M\` ${E.coin}\n\n` +
      `${E.lhfront}${E.lhback} **Lamborghini Huracán** \`[ lamborghini ]\`\n` +
      `• **Campus Cooldown:** \`3 mins\` ⏱️   •   **Price:** \`8.4M\` ${E.coin}\n\n` +
      `${E.rrgfront}${E.rrgback} **Rolls Royce Ghost** \`[ rollsroyce ]\`\n` +
      `• **Campus Cooldown:** \`2 mins\` ⏱️   •   **Price:** \`10.25M\` ${E.coin}\n\n` +
      `${E.ffront}${E.fback} **Ferrari LaFerrari** \`[ ferrari ]\`\n` +
      `• **Campus Cooldown:** \`1 min\` ⏱️   •   **Price:** \`17.7M\` ${E.coin}\n\n` +
      `${E.bcfront}${E.bcback} **Bugatti Chiron Super Sport** \`[ bugatti ]\`\n` +
      `• **Campus Cooldown:** \`1 min\` ⏱️   •   **Price:** \`20.5M\` ${E.coin}\n\n` +
      `${DIVIDER}\n` +
      `-# 💡 Purchase Command: -vehiclebuy <alias> (e.g. -vehiclebuy toyota). Fastest vehicle applies automatically.`
    )
    .setFooter({ text: 'Beyond The Final Whistle • Dealership' })
    .setTimestamp();

  await clearAndPost('vehicle-showroom', [showroomEmbed]);

  // 7. PHOTOSHOOT HALL (GLAMOUR VIOLET THEME)
  const photoEmbed = new EmbedBuilder()
    .setColor('#a855f7') // Luxury Violet
    .setTitle('📸 COMMERCIAL BRAND SPONSORSHIPS — PHOTOSHOOT HALL')
    .setDescription(
      `> *Monetize your global footballing clout! Sign corporate campaigns with world-renowned brands for massive cash prizes and follower expansion.*\n\n` +
      `${E.heineken} **HEINEKEN CAMPAIGN** \`[ -advert heineken ]\`\n` +
      `• **Minimum Fans:** \`100k\` ${E.followers}   •   **Stamina:** \`5\` ${E.stamina}\n` +
      `• **Earnings:** \`+100k\` ${E.coin}   •   **Follower Shift:** \`-50k\` ${E.followers}\n\n` +
      `${E.adidas} **ADIDAS GLOBAL CAMPAIGN** \`[ -advert adidas ]\`\n` +
      `• **Minimum Fans:** \`1M\` ${E.followers}   •   **Stamina:** \`10\` ${E.stamina}\n` +
      `• **Earnings:** \`+200k\` ${E.coin}   •   **Follower Shift:** \`0\` ${E.followers}\n\n` +
      `${E.cocacola} **COCA-COLA SUMMER SPLASH** \`[ -advert cocacola ]\`\n` +
      `• **Minimum Fans:** \`5M\` ${E.followers}   •   **Stamina:** \`10\` ${E.stamina}\n` +
      `• **Earnings:** \`+300k\` ${E.coin}   •   **Follower Shift:** \`-200k\` ${E.followers}\n\n` +
      `${E.netflix} **NETFLIX DOCUSERIES** \`[ -advert netflix ]\`\n` +
      `• **Minimum Fans:** \`6M\` ${E.followers}   •   **Stamina:** \`30\` ${E.stamina}\n` +
      `• **Earnings:** \`+300k\` ${E.coin}   •   **Follower Shift:** \`+50k\` ${E.followers}\n\n` +
      `${E.nike} **NIKE ATHLETE ENDORSEMENT** \`[ -advert nike ]\`\n` +
      `• **Minimum Fans:** \`8M\` ${E.followers}   •   **Stamina:** \`30\` ${E.stamina}\n` +
      `• **Earnings:** \`+500k\` ${E.coin}   •   **Follower Shift:** \`+100k\` ${E.followers}\n\n` +
      `${DIVIDER}\n` +
      `-# 💡 Tip: Run -advert in photoshoot-hall to open the interactive sponsorship dashboard. 2-hour cooldown.`
    )
    .setFooter({ text: 'Beyond The Final Whistle • Commercial Partnerships' })
    .setTimestamp();

  await clearAndPost('photoshoot-hall', [photoEmbed]);

  // 8. ROLES (INTERNATIONAL SKY BLUE THEME)
  const rolesEmbed = new EmbedBuilder()
    .setColor('#0284c7') // Sky Blue
    .setTitle('🎭 National Team Selection & International Registration')
    .setDescription(
      `> *Welcome to the International Federation! Choose your national team to unlock your private national locker room and receive exclusive welcome bonuses.*\n\n` +
      `### 🌍 HOW TO JOIN A NATIONAL SQUAD\n` +
      `Run \`-joinnation <alias>\` in this channel or in \`#bot-cmds\`:\n\n` +
      `• 🇳🇱 **Netherlands:** \`-joinnation ned\`\n` +
      `• 🇩🇪 **Germany:** \`-joinnation ger\`\n` +
      `• 🇵🇹 **Portugal:** \`-joinnation por\`\n` +
      `• 🇪🇸 **Spain:** \`-joinnation esp\`\n` +
      `• 🇫🇷 **France:** \`-joinnation fra\`\n` +
      `• 🏴󠁧󠁢󠁥󠁮󠁧󠁿 **England:** \`-joinnation eng\`\n` +
      `• 🇧🇷 **Brazil:** \`-joinnation bra\`\n` +
      `• 🇦🇷 **Argentina:** \`-joinnation arg\`\n\n` +
      `${DIVIDER}\n` +
      `🎁 **Welcome Signing Bonus:** Joining a nation immediately grants access to your private team locker room and credits **+100k ${E.coin}** and **+100k ${E.followers}**!`
    )
    .setFooter({ text: 'Beyond The Final Whistle • International Registration' })
    .setTimestamp();

  await clearAndPost('roles', [rolesEmbed]);

  // 9. INFORMATION (ROYAL BLUE THEME)
  const infoEmbed = new EmbedBuilder()
    .setColor('#2563eb') // Royal Blue
    .setTitle('ℹ️ Beyond The Final Whistle — Server & Game Overview')
    .setDescription(
      `> *Beyond The Final Whistle (BTFW) is an advanced multiplayer football role-playing simulation where you develop an international football prodigy.*\n\n` +
      `### 🌐 SERVER NAVIGATION & SHORTCUTS\n` +
      `• **Bot Prefix:** \`-\`\n` +
      `• **Master Help Directory:** \`-help\`\n` +
      `• **Campus Facility Map:** \`-locations\`\n` +
      `• **Global Leaderboards:** \`-lb\`\n\n` +
      `### 🏟️ THE SPATIAL CAMPUS SYSTEM\n` +
      `Each channel under the **Campus Facilities** category functions as a physical building on the campus grounds. Fast-travel between them using \`-travel <alias>\` to access drills, market items, recovery, and commercial contracts.\n\n` +
      `### 🏆 TOURNAMENTS & MATCHDAYS\n` +
      `Matches are simulated and broadcast live. Check <#${channels.find(c => c && c.name.includes('schedule'))?.id || 'schedule'}> for upcoming competitive match fixtures!\n\n` +
      `${DIVIDER}\n` +
      `-# ⚽ Begin your career by typing -profile in #bot-cmds.`
    )
    .setFooter({ text: 'Beyond The Final Whistle • Official Hub' })
    .setTimestamp();

  await clearAndPost('information', [infoEmbed]);

  console.log('\n==================================================');
  console.log('🎉 ALL THEMED EMBEDS REPOSTED SUCCESSFULLY!');
  console.log('==================================================');

  process.exit(0);
});

client.login(token);
