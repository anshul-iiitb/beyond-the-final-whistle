import { Message, EmbedBuilder } from 'discord.js';
import { getEmoji } from '../utils/emojiHelper.js';
import { THEME_COLORS, UI, subtext } from '../utils/themeHelper.js';

export async function handleHelpCommand(message: Message) {
  const guild = message.guild;
  const coin = getEmoji(guild, 'coin');
  const tp = getEmoji(guild, 'tp');
  const stamina = getEmoji(guild, 'stamina');
  const followers = getEmoji(guild, 'followers');
  const sd = getEmoji(guild, 'sd');
  const strika = getEmoji(guild, 'strika');
  const passa = getEmoji(guild, 'passa');
  const bully = getEmoji(guild, 'bully');
  const worldcup = getEmoji(guild, 'worldcup');
  const heineken = getEmoji(guild, 'heineken');
  const adidas = getEmoji(guild, 'adidas');
  const cocacola = getEmoji(guild, 'cocacola');
  const netflix = getEmoji(guild, 'netflix');
  const nike = getEmoji(guild, 'nike');

  const embed = new EmbedBuilder()
    .setColor(THEME_COLORS.COBALT)
    .setTitle('📖 Beyond The Final Whistle (BTFW) — Master Command Directory')
    .setDescription(
      `> *Multiplayer football career MMORPG! Train on the spatial campus, sign lucrative commercial brand sponsorships, collect supercars, and dominate AI-simulated matches!*\n\n` +
      `**Prefix:** \`-\` • **Target Server:** Beyond The Final Whistle\n` +
      `${UI.DIVIDER}`
    )
    .addFields(
      {
        name: '🔰 Mandatory Rookie Induction (2 Steps)',
        value:
          '• **Step 1:** `-playstyle [choice|list]` — Choose starting playstyle (or view **18 roles** directory & tactical counters) to unlock the Training Center (`tc`).\n' +
          `• **Step 2:** \`-joinnation <alias>\` — Sign for a National Team to claim **100k ${coin} + 100k ${followers}** and unlock full campus access.`
      },
      {
        name: '👤 Player Career & Studio Customization',
        value:
          '• `-profile [@user]` — Profile Dossier (`Overview` + bottom Banner + Avatar, `Match Telemetry`, `Biomechanics` Radar).\n' +
          '• `-playstyle [choice|list]` (`-styles`) — Directory of 18 tactical roles, Key Stats & Tactical Matrix infographic (15% TP discount).\n' +
          '• `-theme [alias]` — Browse/apply **20 stadium backdrop themes** for your `-profile` card.\n' +
          '• `-daily` — Daily matchday check-in streak (earns progressive coins, Day 7 milestone bonus +50k & +2 TP).\n' +
          '• `-cd` (`-cooldowns`) — Unified personal timer dashboard for travel, drills, recovery, and sponsors.\n' +
          '• `-setdesc <text>` • `-lb [category]` — Interactive visual leaderboard (`goals`, `wealth`, `followers`, `ovr`).\n' +
          '• `-give @user <amount>` — Transfer coins (`50k`, `500k`, `2.5m` supported).\n' +
          `• \`-joinnation <alias>\` — Join National Team (**100k ${coin} + 100k ${followers}**; locked after 3 official caps).`
      },
      {
        name: '🏟️ Streamlined Football Campus (-locations)',
        value:
          '• `-travel <alias>` — Fast-travel between **7 campus hubs** (20m base CD, cars cut down to 1m). Facility commands only work in their channel:\n' +
          '  `tc` Training Center (`-train`) • `rf` Research Lab (`-sptrain`, `-convert`)\n' +
          '  `ch` Player Clubhouse (`-recovery`, `-coaching`, `-meetgreet`)\n' +
          '  `gm` Global Market (`-buy`, `-showroom`, `-avatar`) • `ph` Photoshoot Hall (`-advert`)\n' +
          '  `ih` Intel Hub (`-intel`) • `ah` Auction House (`-ah`, `-bid`).'
      },
      {
        name: '🏋️ Training & Clubhouse Recovery (-ch)',
        value:
          '• `-train` — Interactive pitch drills at `tc`:\n' +
          `  🟢 \`Normal\` (+2-4 ${tp} TP, 1h, 5 ${stamina}) • 🔵 \`👑 VIP 6h\` (+6 ${tp}, 6h, 5 ${stamina}) • 🔴 \`👑 20h Endurance\` (+20 ${tp}, 20h CD, 50 ${stamina})\n` +
          `• \`-sptrain [attr]\` / \`-convert [style]\` — Research Lab upgrades (**15% TP discount on your 3 Key Stats!**) or swap between **18 tactical roles** at \`rf\`.\n` +
          `• \`-recovery\` / \`-coaching\` / \`-meetgreet\` — Recover +30/+100 ${stamina}, earn +50k ${coin}, or +50k ${followers}!`
      },
      {
        name: '🛍️ Global Market, Gear & Consumables (-gm)',
        value:
          `• \`-buy sd [qty]\` & \`-use sd [qty]\` — Stackable Sports Drinks (+50 ${stamina}, 100k ${coin}, drink anywhere!).\n` +
          `• \`-buy <strika|passa|bully>\` — Matchday Boots (+10 ATK/MID/DEF, matched position bonus only!).\n` +
          '• `-showroom [1-3]` & `-vehiclebuy <alias>` — **16 Cars** cutting travel cooldowns down to 1m.\n' +
          '• `-avatar [1|2]` / `-avatarbuy <alias>` / `-avatarclaim <alias>` — Collector Avatars & Banners.\n' +
          '• `-inv [@user]` & `-equip [avatar|banner] <alias|none>` — Inspect and equip cosmetics.'
      },
      {
        name: '🎲 Algorithmic Sportsbook & Matchday Calendar',
        value:
          '• `-fixtures` — Browse scheduled league and international matches.\n' +
          '• `-odds [fixture#]` — Deep algorithmic odds factoring player OVR, matched boots, TP boosts, intel & stadiums.\n' +
          '• `-bet <fixture#> <home|draw|away> <amount>` — Place wager (Max 50k strictly enforced, closes 30m prior to kickoff).\n' +
          '• `-bets` — View active sportsbook slips and settlement history.\n' +
          '• Matchday Lockout: All economy/training/transfers frozen from T-30m before kickoff until T+15m after full-time.'
      },
      {
        name: '🌍 National Teams, Stadiums & Awards',
        value:
          '• `-intteam [alias]` — View National Team Captain, VC, starting lineup, specialists & interactive tactics.\n' +
          '  *(Rival scouts see lineup and squad; set-piece takers & tactics are secret!)*\n' +
          '• `-intset <vc|atk|mid|def|fk|corner|pen> @player` — Assign national roles and specialists.\n' +
          '• `-stadium [upgrade|name]` — Upgrade Club Stadium (Levels 1-5, +15k to 90k capacity, +home advantage).\n' +
          '• `-potw` — Player of the Week race based on matchday telemetry (Sunday +100k & trophy reward).'
      },
      {
        name: '📸 Sponsorships & TwitFeed (-advert, -tweet)',
        value:
          '• `-advert` — 6 Brand Endorsements at `ph` (Heineken, Adidas, VIP 300k, Coca-Cola, Netflix, Nike).\n' +
          `• \`-tweet <text>\` / \`-chirp\` — Post to read-only \`#twitter\` w/ 👍/👎 votes + 👥 \`Voters\` inspection button.`
      },
      {
        name: '⚽ Match Engines & VIP Exhibitions',
        value:
          '• `-match [@user]` / `-livematch [full]` / `-batchmatch [N]` — 90m tactical matches w/ halftime box scores, fair MOTM tie-breakers & AI Gazette.\n' +
          '• `-friendly [@user]` — 👑 **VIP All-Star Exhibition** (zero stat drops + permanent `+1–2` MOTM boost).\n' +
          '• `-tactics [team]` • `-intstats` • `-clubstats` • `-roster <alias>`.'
      },
      {
        name: '👑 Admin, VIP & DevOps',
        value:
          '• `-setup` • `-setupemojis` • `-vip give @user <days>` • `-fixture <add|start> ...`\n' +
          '• `-setprice <item|boots|avatars|banners|cars|reset> <amt>` • `-devfund <amt> [@user]`\n' +
          '• `-seedauction [n] [hrs]` • `-auctionstart` • `-auctionhalt`/`-auctionresume [lot#]` • `-auctionend`/`-auctioncancel <lot#>`\n' +
          `• \`-additem <symbol> @user\` (${worldcup}) • \`-addvar <var> <val> @user\` • \`-gitpull\` / \`-gitpullback\``
      }
    )
    .setFooter({
      text: 'Beyond The Final Whistle • Complete Player Guide',
      iconURL: message.client?.user?.displayAvatarURL?.() || undefined
    })
    .setTimestamp();

  await message.reply({ embeds: [embed] });
}
