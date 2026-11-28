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
        name: '👤 Player Career & Studio Customization',
        value:
          '• `-profile [@user]` — Profile Dossier (`Overview` + equipped bottom Banner + custom Avatar thumbnail, `Match Telemetry`, `Biomechanics` Radar).\n' +
          '• `-theme [alias]` — Browse/apply **20 stadium backdrop themes** for your `-profile` card.\n' +
          '• `-setdesc <text>` • `-lb [category]` — Interactive visual leaderboard (`goals`, `wealth`, `followers`, `ovr`).\n' +
          '• `-give @user <amount>` — Transfer coins (`500k`, `2.5m` supported).\n' +
          `• \`-joinnation <alias>\` — Join a National Team (**100k ${coin} + 100k ${followers}** bonus!).`
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
          `  🟢 \`Normal\` (+1-2 ${tp} TP, 30m, 5 ${stamina}) • 🔵 \`👑 VIP 6h\` (+6 ${tp}, 6h, 5 ${stamina}) • 🔴 \`👑 20h Endurance\` (+20 ${tp}, 20h CD, 50 ${stamina})\n` +
          `• \`-sptrain [attr]\` / \`-convert [style]\` — Open Research Lab TP/Stamina menu & upgrade stats (` +
          '`3–15` ' + `${tp}, \`50\` ${stamina}) or swap role at \`rf\`.\n` +
          `• \`-recovery\` / \`-coaching\` / \`-meetgreet\` — Inside **🏡 Player Clubhouse (\`-travel ch\`)**: recover +30/+100 ${stamina}, earn +50k ${coin}, or +50k ${followers}!`
      },
      {
        name: '🛍️ Global Market, Vehicles & Boutiques (-gm)',
        value:
          `• \`-gm\` / \`-buy <item>\` — **Matchday Gear**: \`sd\` (+50 ${stamina}, 100k ${coin}) & \`strika\`/\`passa\`/\`bully\` (+10 stat boots, 500k ${coin}).\n` +
          '• `-showroom [1-3]` & `-vehiclebuy <alias>` — **16 Cars** paginated across 3 tiers (5/6/5) inside `gm` (`mini`, `bmwm3`, `corvettec8`, `mustang`, `jaguartype`, `bentley`, `mclarenf1`, + full fleet).\n' +
          '• `-avatar [1|2]` / `-avatarbuy <alias>` / `-avatarclaim <alias>` — Showroom-style **Cosmetic Boutique** (**5 Avatars @ 750k**, **5 Banners @ 3M**; VIPs get 1 free monthly claim!).\n' +
          '• `-inv [@user]` (`-inventory`) & `-equip [avatar|banner] <alias|none>` — Inspect your owned Avatars, Banners, Cars & Trophies, and equip them on `-profile`.'
      },
      {
        name: '🏛️ Auction House & Scouting (-ah, -ih)',
        value:
          '• `-ah` / `-auction` — View automated collector relic auctions w/ live Refresh (`+2m` anti-snipe under `60s`).\n' +
          `• \`-bid <amount> [lot#]\` — Place escrowed bids inside \`ah\` (instant outbid refunds + DM alerts!).\n` +
          '• `-prices` — Inspect live Market, Vehicle, Cosmetic & Relic pricing.\n' +
          '• `-intel` — Claim scouting report at **🛰️ Intel Hub (`-travel ih`)** for +1 to +6 match boost.'
      },
      {
        name: '📸 Sponsorships & TwitFeed (-advert, -tweet)',
        value:
          '• `-advert` — 6 Brand Endorsements at `ph`:\n' +
          `  ${heineken} Heineken (100k) • ${adidas} Adidas (1M) • 👑 **VIP Signature** (+300k ${coin} @ 1M fans) • ${cocacola} Coca-Cola (5M) • ${netflix} Netflix (6M) • ${nike} Nike (8M)\n` +
          `• \`-tweet <text>\` / \`-chirp\` — Run from any channel; bot posts directly to read-only \`#twitter\` w/ 👍/👎 votes (\`+100k\` / \`-50k\` ${followers}, \`+5k\` ${coin}/vote + DMs).`
      },
      {
        name: '⚽ Match Engines & VIP Exhibitions',
        value:
          '• `-match [@user]` / `-livematch [full]` / `-batchmatch [N]` — AI 90m matches, live 20–30s commentary (`#live-match`), charts & `#news` Gazette.\n' +
          '• `-friendly [@user]` / `-match friendly` — 👑 **VIP All-Star Exhibition** (zero stat drops + permanent `+1–2` MOTM boost).\n' +
          '• `-tactics [team]` • `-intstats` • `-clubstats` • `-roster <alias>`.'
      },
      {
        name: '👑 Admin, VIP & DevOps',
        value:
          '• `-setup` • `-setupemojis` • `-vip give @user <days>` / `-vip remove @user` • `-testmatch <o1> <o2> <on|off> <on|off>`\n' +
          '• `-setprice <item|boots|avatars|banners|cars|reset> <amt>` • `-devfund <amt> [@user]`\n' +
          '• `-seedauction [n] [hrs]` • `-auctionstart` • `-auctionconfig` • `-auctionhalt`/`-auctionresume [lot#]` • `-auctionend`/`-auctioncancel <lot#>`\n' +
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
