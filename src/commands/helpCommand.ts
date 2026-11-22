import { Message, EmbedBuilder } from 'discord.js';

export async function handleHelpCommand(message: Message) {
  const embed = new EmbedBuilder()
    .setColor('#3b82f6')
    .setTitle('📖 Beyond The Final Whistle (BTFW) — Master Command Guide')
    .setDescription(
      `Welcome to **Beyond The Final Whistle**, an immersive multiplayer Football Career simulation MMORPG!\n\n` +
      `You are a rising football prodigy called up to the international stage. Train on the spatial campus, sign commercial brand deals, purchase supercars, and dominate AI-simulated matches!`
    )
    .addFields(
      {
        name: '👤 Player Profile & Career',
        value:
          '• `-profile [@user]` — View your complete player card, derived ATK/MID/DEF, 15 attributes, and stats.\n' +
          '• `-setdesc <text>` — Set your personal bio (up to 100 characters).\n' +
          '• `-lb [category]` — View server leaderboards (`goals`, `assists`, `motm`, `coins`, `followers`, `tp`, `matches`).\n' +
          '• `-give @user <amount>` — Transfer funds to a teammate.\n' +
          '• `-joinnation <alias>` — Join a National Team (`ger`, `por`, `esp`, `fra`, `eng`, `bra`, etc.).'
      },
      {
        name: '🏟️ Spatial Football Campus (-locations)',
        value:
          '• `-travel <alias>` — Move between facilities (20m cooldown, reduced by cars).\n' +
          '  `tc`: Training Center • `rf`: Research Facility • `gm`: Global Market\n' +
          '  `ph`: Photoshoot Hall • `ps`: Player Sauna • `lc`: Local Club\n' +
          '  `vs`: Showroom • `ih`: Intel Hub\n' +
          '• `-showroom` — Inspect exotic vehicles catalog.\n' +
          '• `-vehiclebuy <alias>` — Purchase supercars (slashes travel cooldown down to 1m).'
      },
      {
        name: '🏋️ Training & Biomechanics Development',
        value:
          '• `-train` — Pitch drills at Training Center (+1-2 TP, 30m cooldown, 10 stamina).\n' +
          '• `-train vip` — VIP masterclass (+6 TP, 6h cooldown, 15 stamina).\n' +
          '• `-train noeffort` — Instant daily TP (+20 VIP, +50 Premium).\n' +
          '• `-sptrain <attr>` / `-upgrade` — Permanently boost attribute at Research Lab (costs 50 stamina & 3-15 dynamic TP).\n' +
          '• `-convert <playstyle>` — Change tactical role at Research Lab (7-day cooldown).\n' +
          '• `-recovery` — Relax in Sauna to recover +30 stamina (+100 for VIP, 12h cooldown).'
      },
      {
        name: '🛍️ Market & Matchday Gear',
        value:
          '• `-buy sd` — Drink Sports Drink to recover +50 stamina (100k 🪙).\n' +
          '• `-buy strika` — Equips Strika Boots (+10 ATK next match, 500k 🪙).\n' +
          '• `-buy passa` — Equips Passa Boots (+10 MID next match, 500k 🪙).\n' +
          '• `-buy bully` — Equips Bully Boots (+10 DEF next match, 500k 🪙).\n' +
          '• `-intel` — Claim opposition scouting report at Intel Hub (+1 to +6 match bonus).'
      },
      {
        name: '📸 Sponsorships & Fan Socials',
        value:
          '• `-advert [brand]` — Sign commercial deals at Photoshoot Hall (Heineken, Adidas, Coca-Cola, Netflix, 2h cooldown).\n' +
          '• `-coaching` — Coach academy youth at Local Club (+50k coins, 2h cooldown).\n' +
          '• `-meetgreet` — Sign autographs at Local Club (+50k followers, 2h cooldown).\n' +
          '• `-chirp <text>` / `-tweet` — Post to TwitFeed (reactions: 👍 +100k fans, 👎 -50k fans).'
      },
      {
        name: '⚽ AI Match Simulations & Newspaper',
        value:
          '• `-match [@user]` — Triggers high-octane 90-minute match simulation with play-by-play commentary & AI newspaper article.\n' +
          '• `-intstats [@user]` — View full international caps, goals, and cards.\n' +
          '• `-clubstats [@user]` — View franchise club record.\n' +
          '• `-roster <alias>` — Inspect team squad lineups.'
      },
      {
        name: '👑 Admin & Server Management',
        value:
          '• `-setup` — Automatically build the 8 Campus channels with bracket logos.\n' +
          '• `-vip add invite/boost @user` — Grant 30 days of VIP status.\n' +
          '• `-additem <item> @user` — Award collectible trophies.\n' +
          '• `-addvar <var> <val> @user` — Adjust player attributes/coins/stamina.\n' +
          '• `-gitpull` — Hot-pull latest commit from GitHub and reload.\n' +
          '• `-gitpullback` — Emergency restore to previous stable commit.'
      }
    )
    .setFooter({ text: 'Beyond The Final Whistle • Prefix: -' })
    .setTimestamp();

  await message.reply({ embeds: [embed] });
}
