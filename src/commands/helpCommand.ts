import { Message, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, Guild } from 'discord.js';
import { getEmoji } from '../utils/emojiHelper.js';
import { THEME_COLORS, UI, subtext } from '../utils/themeHelper.js';

export const TOTAL_HELP_PAGES = 6;

export function buildHelpMenuPayload(page: number, guild?: Guild | null, client?: any) {
  const safePage = Math.max(1, Math.min(TOTAL_HELP_PAGES, page));

  const coin = getEmoji(guild, 'coin');
  const tp = getEmoji(guild, 'tp');
  const stamina = getEmoji(guild, 'stamina');
  const followers = getEmoji(guild, 'followers');
  const worldcup = getEmoji(guild, 'worldcup');

  let title = '';
  let color: number = THEME_COLORS.COBALT;
  let description = '';
  const fields: Array<{ name: string; value: string }> = [];

  switch (safePage) {
    case 1:
      title = '📖 Master Guide (1/6) — 🔰 Induction & Career Hub';
      color = THEME_COLORS.PRIMARY;
      description =
        `> *Welcome to Beyond The Final Whistle! Start your career, level up your player card, and climb the world rankings.*\n\n` +
        `**Prefix:** \`-\` • **Quick Page Jump:** \`-help <1-6>\` (e.g. \`-help 3\`, \`-help 6\`)\n` +
        `${UI.DIVIDER}`;
      fields.push(
        {
          name: '🔰 Mandatory Rookie Onboarding (2 Steps)',
          value:
            '• `-playstyle [choice|list]` (`-styles`) — Step 1: Choose from **18 playstyles** (or view directory & matrix) to unlock `#training-center` (`tc`).\n' +
            `• \`-joinnation <alias>\` — Step 2: Sign for an open National Team to claim **+100k ${coin} + 100k ${followers}** and unlock full campus access.`
        },
        {
          name: '👤 Player Profile & Career Dossier',
          value:
            '• `-profile [@user]` (`-p`) — Complete Player Dossier (`Overview`, `Match Telemetry`, `Biomechanics` Radar).\n' +
            `• \`-daily\` — Daily matchday check-in streak (**Day 7 Bonus:** +50k ${coin} & +2 ${tp} TP!).\n` +
            '• `-cd` (`-cooldowns`) — Unified personal timer dashboard for travel, drills, recovery, and sponsors.\n' +
            '• `-setdesc <text>` (`-bio`) — Set custom personal biography on your profile card.\n' +
            '• `-lb [category]` — Interactive leaderboards (`ovr`, `goals`, `wealth`, `followers`).\n' +
            `• \`-give @user <amount>\` — Transfer coins to another player (\`50k\`, \`500k\`, \`2.5m\`).\n` +
            '• `-referral [@user]` — Credit your recruiter upon earning 50 TP to grant them **7 Days of VIP Access** (or check referral status).'
        }
      );
      break;

    case 2:
      title = '📖 Master Guide (2/6) — 🏟️ Campus, Training & Recovery';
      color = THEME_COLORS.EMERALD;
      description =
        `> *The spatial campus connects 7 football facilities. Commands are strictly locked to their respective facility channels!*\n\n` +
        `**Tip:** Use luxury vehicles to slash travel cooldowns from 20 minutes down to 1 minute!\n` +
        `${UI.DIVIDER}`;
      fields.push(
        {
          name: '🚗 Spatial Campus Travel (-locations)',
          value:
            '• `-locations` (`-locs`) — Directory of the 7 unified campus facilities.\n' +
            '• `-travel <alias>` (`-t`) — Fast travel between hubs:\n' +
            '  `tc` Training Center • `rf` Research Lab • `ch` Player Clubhouse\n' +
            '  `gm` Global Market • `ph` Photoshoot Hall • `ih` Intel Hub • `ah` Auction House'
        },
        {
          name: '🏋️ Training Center (`tc` • #training-center)',
          value:
            '• `-train` — Interactive training session menu:\n' +
            `  🟢 \`Normal Drills\` — +2 to +4 ${tp} TP (1h cooldown, 5 ${stamina})\n` +
            `  🔵 \`👑 VIP 6h Masterclass\` — +6 ${tp} TP (6h cooldown, 5 ${stamina})\n` +
            `  🔴 \`⚡ VIP 20h Endurance\` — +20 ${tp} TP (20h cooldown, 50 ${stamina})`
        },
        {
          name: '🔬 Biomechanics Research Lab (`rf` • #research-lab)',
          value:
            '• `-sptrain [attr]` — Upgrade 15 granular attributes with TP (**15% TP discount on your 3 Key Stats!**).\n' +
            '• `-convert [style]` — Retrain into any of the 18 tactical playstyles (7-day cooldown).'
        },
        {
          name: '🧖 Player Clubhouse (`ch` • #clubhouse)',
          value:
            `• \`-recovery\` (\`-sauna\`) — Cryo sauna stamina recovery (+30 standard / **+100 full recharge** for 👑 VIP).\n` +
            `• \`-coaching\` — Coach academy youth (+50k ${coin}, 2h cooldown).\n` +
            `• \`-meetgreet\` — Fan autograph signing session (+50k ${followers}, 2h cooldown).`
        }
      );
      break;

    case 3:
      title = '📖 Master Guide (3/6) — 🛍️ Market, Vehicles & Boutique';
      color = THEME_COLORS.GOLD;
      description =
        `> *Equip professional gear, collect luxury supercars, and customize your footballer's studio presentation.*\n\n` +
        `**Location:** Visit the **Global Market** (\`-travel gm\`) to buy gear, cars, and cosmetics.\n` +
        `${UI.DIVIDER}`;
      fields.push(
        {
          name: '🛒 Global Market Consumables & Gear (`gm`)',
          value:
            `• \`-buy sd [qty]\` & \`-use sd [qty]\` — Stackable Sports Drinks (+50 ${stamina}, 100k ${coin}, drink anywhere!).\n` +
            `• \`-buy <strika|passa|bully>\` — Position-matched Boots (+10 ATK/MID/DEF bonus).`
        },
        {
          name: '🏎️ Luxury Dealership & Hypercars (`gm`)',
          value:
            '• `-showroom [1-3]` (`-dealership`) — Inspect **16 luxury supercars** across 3 performance tiers.\n' +
            '• `-vehiclebuy <alias>` (`-buycar`) — Purchase car to slash travel cooldowns from 20m down to 1m!'
        },
        {
          name: '🎨 Collector Boutique & Studio (`gm`)',
          value:
            '• `-avatar [1|2]` — Browse monthly limited collector avatars & stadium backdrops.\n' +
            '• `-avatarbuy <alias>` — Purchase boutique avatar or banner with coins.\n' +
            '• `-avatarclaim <alias>` — 👑 VIP monthly free cosmetic claim pass.\n' +
            '• `-inv [@user]` — Inspect personal cosmetic inventory & garage.\n' +
            '• `-equip <avatar|banner> <alias|none>` — Equip cosmetics to your `-profile` card.\n' +
            '• `-theme [alias]` — Apply one of **20 custom stadium backdrop themes**.'
        }
      );
      break;

    case 4:
      title = '📖 Master Guide (4/6) — 🌍 Nations, Clubs & Tactics';
      color = THEME_COLORS.GOLD;
      description =
        `> *Lead your International Federation or Club Franchise to tournament glory through tactical masterclasses.*\n\n` +
        `**Squad Governance:** Captains and Vice-Captains set starting lineups and set-piece specialists.\n` +
        `${UI.DIVIDER}`;
      fields.push(
        {
          name: '🌍 International Federations',
          value:
            '• `-intteam [alias]` (`-team`) — View Captain, VC, starting lineup, specialists & match record.\n' +
            '• `-joinnation <alias>` — Sign for an open national squad (8 active nations available).\n' +
            '• `-intset <cap|vc|atk|mid|def|fk|corner|pen> @player` — Designate Captain 👑, VC 🎖️, Starting XI & Specialists!\n' +
            '• `-roster <alias>` — Quick squad lineup view.'
        },
        {
          name: '🛡️ Football Clubs & Stadium Infrastructure',
          value:
            '• `-joinclub <alias>` — Sign for a professional football club (enforces roster limits).\n' +
            '• `-clubset <cap|vc|atk|mid|def|fk|corner|pen> @player` — Designate club leadership, starting slots & specialists.\n' +
            '• `-stadium [upgrade|name]` — Upgrade Club Stadium (Levels 1-5, +15k to 90k capacity, +home advantage).\n' +
            '• `-teamlimits` — View active squad roster counts & limits across all nations & clubs.'
        },
        {
          name: '🧠 Interactive Tactical Playbook',
          value:
            '• `-tactics [team]` — Open interactive Tactical Playbook (Attack & Defence boards):\n' +
            '  *Mentality, Passing Focus, Directness, Counter, Pressing, Tackling, Marking, Offside Trap.*'
        }
      );
      break;

    case 5:
      title = '📖 Master Guide (5/6) — ⚽ Matches, Friendlies & Sportsbook';
      color = THEME_COLORS.SCARLET;
      description =
        `> *Experience 90-minute AI-simulated matches, place sportsbook wagers, and grow your social influence.*\n\n` +
        `**Friendly Ground:** Head to \`#friendly-matches\` for zero-risk exhibitions with MOTM boosts!\n` +
        `${UI.DIVIDER}`;
      fields.push(
        {
          name: '⚽ Match Engines & VIP Exhibitions',
          value:
            '• `-match [@user|team1 team2]` / `-match live [team1 team2]` — 90m tactical simulation or live broadcast (e.g. `-match por esp` or `-match live por esp`).\n' +
            '• `-friendly [@user|team1 team2]` — 👑 **VIP Exhibition** (zero stat loss, +1-2 MOTM boost). Kick off direct Nation/Club clash (e.g. `-friendly por esp`) or challenge rival players in `#friendly-matches`!\n' +
            '• `-intel` (`-scout`) — Tactical scouting report on upcoming opponents (+1 to +6 roll boost).\n' +
            '• `-intstats [@user]` / `-clubstats [@user]` — Tournament and club career telemetry.\n' +
            '• `-potw` (`-form`) — Player of the Week race tracked from matchday performance.'
        },
        {
          name: '🎲 Algorithmic Sportsbook',
          value:
            '• `-fixtures` (`-schedule`) — View scheduled official league & international matches.\n' +
            '• `-odds [fixture#]` — Deep algorithmic odds factoring player OVR, boots, TP, and stadiums.\n' +
            `• \`-bet <fixture#> <pick> <amt>\` — Place matchday wager (Strict 50k limit, closes 30m prior).\n` +
            '• `-bets` (`-slips`) — Inspect active and settled betting slips.'
        },
        {
          name: '📸 Commercial Sponsorships & TwitFeed',
          value:
            '• `-advert [brand]` — Sign 6 commercial brand endorsements at Photoshoot Hall (`ph`).\n' +
            '• `-tweet <text>` (`-chirp`) — Post to read-only `#twitter` with 👍/👎 follower votes & 👥 voter inspection.'
        }
      );
      break;

    case 6:
      title = '📖 Master Guide (6/6) — 👑 VIP Privileges, Auctions & Admin';
      color = THEME_COLORS.PURPLE;
      description =
        `> *VIP perks, live collectible auctions, and complete server administration commands.*\n\n` +
        `**Tip:** Boost the Discord server or earn referrals to unlock VIP status!\n` +
        `${UI.DIVIDER}`;
      fields.push(
        {
          name: '👑 VIP Footballer Programme',
          value:
            '• `-vip [perks]` — Inspect the 6 VIP Super-Perks or view personal VIP status countdown.\n' +
            '• `-vip give @user <days>` — Grant timed VIP duration (or `-vip remove @user`).\n' +
            '• 6 Super-Perks: VIP Drills, Cryo Sauna 100%, Friendly MOTM boost, 300k Ad, Gold Dossier, #vip-lounge.'
        },
        {
          name: '🏷️ Auction House (`ah` • #auction-house)',
          value:
            '• `-ah` / `-bid <amt> [lot#]` — View active live lots & bid on rare collectibles.\n' +
            '• `-seedauction [n] [hrs]` — Seed automatic randomized auction lots.\n' +
            '• `-auctionstart` / `-ahstart` — Create custom auction lot.\n' +
            '• `-auctionhalt` / `-auctionresume [lot#]` — Freeze and unfreeze active auctions.\n' +
            '• `-auctionend` / `-auctioncancel <lot#>` — Settle or cancel auction lot.'
        },
        {
          name: '⚙️ Admin & Server Governance',
          value:
            '• `-setup` — Automatically construct campus channels, friendly ground & VIP lounge.\n' +
            '• `-setupmod` — Configure Match Moderator role (locks out rival team rooms, enables admin chat).\n' +
            '• `-setupemojis` — Auto-install 14 custom BTFW server emojis.\n' +
            '• `-setcaptain <nation|club> <alias> @player` — Appoint team captain for any nation or club.\n' +
            '• `-setlimit <nation|club> <alias|all> <limit>` • `-teamlimits` — Squad roster limits.\n' +
            '• `-locknation <alias>` • `-unlocknation <alias>` — Lock/unlock nations from player registration.\n' +
            '• `-setprice <item|boots|cars|reset> <amt>` — Live dynamic pricing control.\n' +
            `• \`-additem <symbol> @user\` (${worldcup}) • \`-addvar <var> <val> @user\` • \`-devfund <amt> [@user]\`\n` +
            '• `-gitpull` / `-gitpullback` — Hot-reload code updates directly from GitHub.'
        }
      );
      break;
  }

  const embed = new EmbedBuilder()
    .setColor(color)
    .setTitle(title)
    .setDescription(description)
    .addFields(fields)
    .setFooter({
      text: `Page ${safePage} of ${TOTAL_HELP_PAGES} • Tip: Run -help <1-6> to jump directly to any page • BTFW Guide`,
      iconURL: client?.user?.displayAvatarURL?.() || undefined
    })
    .setTimestamp();

  const prevPage = safePage > 1 ? safePage - 1 : 1;
  const nextPage = safePage < TOTAL_HELP_PAGES ? safePage + 1 : TOTAL_HELP_PAGES;

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`help_page_${prevPage}`)
      .setLabel('◀ Prev')
      .setStyle(ButtonStyle.Primary)
      .setDisabled(safePage === 1),
    new ButtonBuilder()
      .setCustomId('help_indicator')
      .setLabel(`Page ${safePage} / ${TOTAL_HELP_PAGES}`)
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(true),
    new ButtonBuilder()
      .setCustomId(`help_page_${nextPage}`)
      .setLabel('Next ▶')
      .setStyle(ButtonStyle.Primary)
      .setDisabled(safePage === TOTAL_HELP_PAGES)
  );

  return { embed, components: [row] };
}

export async function handleHelpCommand(message: Message, args: string[] = []) {
  let targetPage = 1;
  if (args[0]) {
    const parsed = parseInt(args[0], 10);
    if (!isNaN(parsed)) {
      targetPage = Math.max(1, Math.min(TOTAL_HELP_PAGES, parsed));
    }
  }

  const payload = buildHelpMenuPayload(targetPage, message.guild, message.client);
  await message.reply({ embeds: [payload.embed], components: payload.components });
}
